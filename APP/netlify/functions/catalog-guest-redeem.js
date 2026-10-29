import { adaptNetlifyHandler } from '../shared/adapt-netlify-handler.js';
import { isSameOrigin } from '../shared/admin-auth.js';
import {
  GUEST_DURATIONS,
  claimGuestToken,
  createGuestSession,
  getActiveGrant,
  getGrantExpiresAt,
  getGrantStore,
  getGuestSessionStore,
  getInvitationStore,
  getVerificationStore,
  hashToken,
  isGuestDuration,
  jsonResponse,
  parseBody
} from '../shared/catalog-guest-access.js';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const redeemInvitation = async (token, dependencies, now) => {
  const hash = hashToken(token);
  const invitationStore = await (dependencies.getInvitationStore || getInvitationStore)();
  const pointer = await invitationStore.get(`token:${hash}`, { type: 'json' });
  if (!pointer?.invitationId) return jsonResponse({ error: 'This invitation is invalid or has already been used.' }, 401);

  const invitationKey = `invitation:${pointer.invitationId}`;
  const invitation = await invitationStore.get(invitationKey, { type: 'json' });
  if (
    !invitation ||
    invitation.tokenHash !== hash ||
    invitation.status !== 'pending' ||
    invitation.usedAt ||
    !Number.isFinite(invitation.expiresAt) ||
    invitation.expiresAt <= now() ||
    !isGuestDuration(invitation.duration)
  ) return jsonResponse({ error: 'This invitation is invalid or has expired.' }, 401);

  if (!(await (dependencies.claimToken || claimGuestToken)(hash))) {
    return jsonResponse({ error: 'This invitation has already been used.' }, 409);
  }

  const redeemedAt = now();
  const grant = {
    id: invitation.grantId,
    invitationId: invitation.id,
    email: invitation.customerEmail,
    sharedBy: invitation.sharedBy,
    sharedByName: invitation.sharedByName || null,
    duration: invitation.duration,
    createdAt: redeemedAt,
    expiresAt: getGrantExpiresAt(invitation.duration, redeemedAt),
    revokedAt: null,
    status: 'active'
  };
  if (grant.expiresAt === undefined) return jsonResponse({ error: 'Invalid access duration.' }, 400);

  const grantStore = await (dependencies.getGrantStore || getGrantStore)();
  await grantStore.setJSON(`grant:${grant.id}`, grant);
  invitation.usedAt = redeemedAt;
  invitation.status = 'redeemed';
  await invitationStore.setJSON(invitationKey, invitation);
  await invitationStore.delete(`token:${hash}`);

  const { cookie } = await (dependencies.createSession || createGuestSession)(
    grant,
    { getSessionStore: dependencies.getGuestSessionStore || getGuestSessionStore, now }
  );
  return jsonResponse({
    authenticated: true,
    resource: 'catalog-guest',
    duration: GUEST_DURATIONS[grant.duration],
    expiresAt: grant.expiresAt,
    sharedBy: grant.sharedBy || null,
    sharedByName: grant.sharedByName || null
  }, 200, [cookie]);
};

const redeemVerification = async (token, dependencies, now) => {
  const hash = hashToken(token);
  const verificationStore = await (dependencies.getVerificationStore || getVerificationStore)();
  const pointer = await verificationStore.get(`token:${hash}`, { type: 'json' });
  if (!pointer?.grantId) return jsonResponse({ error: 'This verification link is invalid or has already been used.' }, 401);
  const record = await verificationStore.get(`verification:${pointer.grantId}:${hash}`, { type: 'json' });
  if (
    !record ||
    record.tokenHash !== hash ||
    record.usedAt ||
    !Number.isFinite(record.expiresAt) ||
    record.expiresAt <= now()
  ) return jsonResponse({ error: 'This verification link is invalid or has expired.' }, 401);

  if (!(await (dependencies.claimToken || claimGuestToken)(hash))) {
    return jsonResponse({ error: 'This verification link has already been used.' }, 409);
  }

  const grantStore = await (dependencies.getGrantStore || getGrantStore)();
  const grant = await grantStore.get(`grant:${record.grantId}`, { type: 'json' });
  if (!getActiveGrant(grant, now()) || grant.email !== record.email) {
    return jsonResponse({ error: 'Catalog access is no longer active.' }, 401);
  }
  const { cookie } = await (dependencies.createSession || createGuestSession)(
    grant,
    { getSessionStore: dependencies.getGuestSessionStore || getGuestSessionStore, now }
  );
  record.usedAt = now();
  await verificationStore.setJSON(`verification:${pointer.grantId}:${hash}`, record);
  await verificationStore.delete(`token:${hash}`);
  return jsonResponse({
    authenticated: true,
    resource: 'catalog-guest',
    duration: GUEST_DURATIONS[grant.duration],
    expiresAt: grant.expiresAt,
    sharedBy: grant.sharedBy || null,
    sharedByName: grant.sharedByName || null
  }, 200, [cookie]);
};

export const createCatalogGuestRedeemHandler = (dependencies = {}) => async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);
  if (!(dependencies.isSameOrigin || isSameOrigin)(event)) return jsonResponse({ error: 'Request could not be completed.' }, 403);

  const payload = (dependencies.parseBody || parseBody)(event);
  if (!payload || !TOKEN_PATTERN.test(payload.token || '') || !['invite', 'verify'].includes(payload.purpose)) {
    return jsonResponse({ error: 'Invalid or expired link.' }, 400);
  }

  const now = dependencies.now || Date.now;
  try {
    if (payload.purpose === 'invite') return await redeemInvitation(payload.token, dependencies, now);
    return await redeemVerification(payload.token, dependencies, now);
  } catch {
    return jsonResponse({ error: 'Catalog access could not be verified. Please request a fresh link or contact Prime Line.' }, 503);
  }
};

export default adaptNetlifyHandler(createCatalogGuestRedeemHandler());
