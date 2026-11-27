import { adaptNetlifyHandler } from '../shared/adapt-netlify-handler.js';
import { isSameOrigin } from '../shared/admin-auth.js';
import {
  GUEST_DURATIONS,
  GUEST_DEVICE_COOKIE_MAX_AGE_SECONDS,
  authorizeGuestDevice,
  createId,
  getActiveGrant,
  getGrantExpiresAt,
  getGrantStore,
  getGuestClaimStore,
  getInvitationStore,
  getVerificationStore,
  guestDeviceCookie,
  guestDeviceIdentity,
  hashToken,
  isGuestDuration,
  jsonResponse,
  parseBody
} from '../shared/catalog-guest-access.js';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const redeemInvitation = async (token, event, dependencies, now) => {
  const hash = hashToken(token);
  const invitationStore = await (dependencies.getInvitationStore || getInvitationStore)();
  const pointer = await invitationStore.get(`token:${hash}`, { type: 'json' });
  if (!pointer?.invitationId) return jsonResponse({ error: 'This invitation is invalid or has already been used.' }, 401);

  const invitationKey = `invitation:${pointer.invitationId}`;
  let invitationRecord = await invitationStore.getWithMetadata(invitationKey, { type: 'json' });
  let invitation = invitationRecord?.data;
  if (
    !invitation ||
    invitation.tokenHash !== hash ||
    !isGuestDuration(invitation.duration)
  ) return jsonResponse({ error: 'This invitation is invalid or has expired.' }, 401);

  const grantStore = await (dependencies.getGrantStore || getGrantStore)();
  let grant = await grantStore.get(`grant:${invitation.grantId}`, { type: 'json' });
  if (invitation.status === 'pending' && !invitation.usedAt) {
    if (!Number.isFinite(invitation.expiresAt) || invitation.expiresAt <= now()) {
      return jsonResponse({ error: 'This invitation is invalid or has expired.' }, 401);
    }

    const redeemedAt = now();
    const activating = {
      ...invitation, usedAt: redeemedAt, status: 'activating',
      expiresAt: getGrantExpiresAt(invitation.duration, redeemedAt)
    };
    if (activating.expiresAt === undefined) return jsonResponse({ error: 'Invalid access duration.' }, 400);
    const updated = await invitationStore.setJSON(invitationKey, activating, { onlyIfMatch: invitationRecord.etag });
    if (!updated.modified) {
      invitationRecord = await invitationStore.getWithMetadata(invitationKey, { type: 'json' });
      invitation = invitationRecord?.data;
    } else {
      invitation = activating;
      invitationRecord = await invitationStore.getWithMetadata(invitationKey, { type: 'json' });
    }
  }
  if (invitation?.status === 'activating' && invitation.usedAt) {
    const candidate = {
      id: invitation.grantId,
      invitationId: invitation.id,
      email: invitation.customerEmail,
      sharedBy: invitation.sharedBy,
      sharedByName: invitation.sharedByName || null,
      duration: invitation.duration,
      createdAt: invitation.usedAt,
      expiresAt: invitation.expiresAt,
      revokedAt: null,
      status: 'active',
      deviceHashes: []
    };
    await grantStore.setJSON(`grant:${candidate.id}`, candidate, { onlyIfNew: true });
    grant = await grantStore.get(`grant:${candidate.id}`, { type: 'json' });
    if (!getActiveGrant(grant, now())) return jsonResponse({ error: 'This catalog access has expired or been revoked.' }, 401);
    const finalized = await invitationStore.setJSON(invitationKey, { ...invitation, status: 'redeemed' }, { onlyIfMatch: invitationRecord.etag });
    if (!finalized.modified) {
      invitation = await invitationStore.get(invitationKey, { type: 'json' });
    } else invitation.status = 'redeemed';
  }
  if (
    !invitation ||
    invitation.status !== 'redeemed' ||
    !invitation.usedAt ||
    !getActiveGrant(grant, now())
  ) {
    return jsonResponse({ error: 'This catalog access has expired or been revoked.' }, 401);
  }

  const device = await (dependencies.authorizeDevice || authorizeGuestDevice)(grant.id, event, {
    ...dependencies, now, email: invitation.customerEmail
  });
  if (device.resetConflict) return jsonResponse({ error: 'Catalog sessions were invalidated. Please try again.' }, 409);
  if (device.expired || device.missing) return jsonResponse({ error: 'This catalog access has expired or been revoked.' }, 401);
  grant = device.grant;
  return jsonResponse({
    authenticated: true,
    resource: 'catalog-guest',
    duration: GUEST_DURATIONS[grant.duration],
    expiresAt: grant.expiresAt,
    sharedBy: grant.sharedBy || null,
    sharedByName: grant.sharedByName || null
  }, 200, [device.session.cookie, device.deviceCookie]);
};

const redeemVerification = async (token, event, dependencies, now) => {
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

  const legacyClaims = await (dependencies.getClaimStore || getGuestClaimStore)();
  if (await legacyClaims.get(`claim:${hash}`)) {
    return jsonResponse({ error: 'This verification link has already been used.' }, 409);
  }

  const grantStore = await (dependencies.getGrantStore || getGrantStore)();
  const grant = await grantStore.get(`grant:${record.grantId}`, { type: 'json' });
  if (!getActiveGrant(grant, now()) || grant.email !== record.email) {
    return jsonResponse({ error: 'Catalog access is no longer active.' }, 401);
  }
  const device = await (dependencies.authorizeDevice || authorizeGuestDevice)(grant.id, event, {
    ...dependencies, now, email: record.email, verification: { hash, expiresAt: record.expiresAt }
  });
  if (device.resetConflict) return jsonResponse({ error: 'Catalog sessions were invalidated. Please try again.' }, 409);
  if (device.verificationUsed) return jsonResponse({ error: 'This verification link has already been used.' }, 409);
  if (device.expired || device.missing) return jsonResponse({ error: 'Catalog access is no longer active.' }, 401);
  const authorizedGrant = device.grant;
  return jsonResponse({
    authenticated: true,
    resource: 'catalog-guest',
    duration: GUEST_DURATIONS[authorizedGrant.duration],
    expiresAt: authorizedGrant.expiresAt,
    sharedBy: authorizedGrant.sharedBy || null,
    sharedByName: authorizedGrant.sharedByName || null
  }, 200, [device.session.cookie, device.deviceCookie]);
};

export const createCatalogGuestRedeemHandler = (dependencies = {}) => async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);
  if (!(dependencies.isSameOrigin || isSameOrigin)(event)) return jsonResponse({ error: 'Request could not be completed.' }, 403);

  const payload = (dependencies.parseBody || parseBody)(event);
  if (!payload || !TOKEN_PATTERN.test(payload.token || '') || !['invite', 'verify'].includes(payload.purpose)) {
    return jsonResponse({ error: 'Invalid or expired link.' }, 400);
  }
  if (!guestDeviceIdentity(event)) {
    return jsonResponse({ error: 'Preparing this browser for catalog access.', code: 'device_setup_required' }, 428, [
      guestDeviceCookie(createId(), GUEST_DEVICE_COOKIE_MAX_AGE_SECONDS)
    ]);
  }

  const now = dependencies.now || Date.now;
  try {
    if (payload.purpose === 'invite') return await redeemInvitation(payload.token, event, dependencies, now);
    return await redeemVerification(payload.token, event, dependencies, now);
  } catch {
    console.error('Catalog guest redemption could not be completed.');
    return jsonResponse({ error: 'Catalog access could not be verified. Please request a fresh link or contact Prime Line.' }, 503);
  }
};

export default adaptNetlifyHandler(createCatalogGuestRedeemHandler());
