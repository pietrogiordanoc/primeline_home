import { adaptNetlifyHandler } from '../shared/adapt-netlify-handler.js';
import {
  ADMIN_EMAIL,
  isSameOrigin,
  requireAdminRequest
} from '../shared/admin-auth.js';
import {
  GUEST_DURATIONS,
  claimGuestToken,
  createGuestInvitationRecord,
  getGrantStore,
  getInvitationStore,
  jsonResponse,
  listStoreRecords,
  parseBody,
  sendCatalogInvitationEmail
} from '../shared/catalog-guest-access.js';

const getStatusForGrant = (grant, now) => {
  if (grant.revokedAt) return 'revoked';
  if (grant.expiresAt !== null && grant.expiresAt <= now) return 'expired';
  return 'active';
};

const buildAdminRows = async (invitationStore, grantStore, now) => {
  const invitations = await listStoreRecords(invitationStore, 'invitation:');
  const grants = await listStoreRecords(grantStore, 'grant:');
  const linkedInvitationIds = new Set();
  const rows = grants.map((grant) => {
    linkedInvitationIds.add(grant.invitationId);
    return {
      id: grant.id,
      invitationId: grant.invitationId,
      customerEmail: grant.email,
      sharedBy: grant.sharedBy,
      duration: GUEST_DURATIONS[grant.duration] || grant.duration,
      expiresAt: grant.expiresAt,
      status: getStatusForGrant(grant, now),
      canRevoke: getStatusForGrant(grant, now) === 'active',
      canReissue: false
    };
  });

  invitations
    .filter((invitation) => !linkedInvitationIds.has(invitation.id))
    .forEach((invitation) => {
      if (invitation.status === 'reissued') {
        rows.push({
          id: invitation.id,
          invitationId: invitation.id,
          customerEmail: invitation.customerEmail,
          sharedBy: invitation.sharedBy,
          duration: GUEST_DURATIONS[invitation.duration] || invitation.duration,
          expiresAt: invitation.expiresAt,
          status: 'revoked',
          canRevoke: false,
          canReissue: false
        });
        return;
      }
      const expired = invitation.status === 'revoked' ||
        invitation.usedAt ||
        invitation.expiresAt <= now;
      rows.push({
        id: invitation.id,
        invitationId: invitation.id,
        customerEmail: invitation.customerEmail,
        sharedBy: invitation.sharedBy,
        duration: GUEST_DURATIONS[invitation.duration] || invitation.duration,
        expiresAt: invitation.expiresAt,
        status: invitation.status === 'revoked' ? 'revoked' : expired ? 'expired' : 'pending',
        canRevoke: false,
        canReissue: Boolean(!invitation.usedAt && invitation.status !== 'revoked')
      });
    });

  return rows.sort((a, b) => b.expiresAt - a.expiresAt);
};

export const createCatalogGuestAdminHandler = (dependencies = {}) => async (event) => {
  const method = event.httpMethod;
  if (method !== 'GET' && method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  let authorization;
  try {
    authorization = await (dependencies.authorizeAdmin || requireAdminRequest)(
      event,
      { stateChanging: method === 'POST' }
    );
  } catch {
    return jsonResponse({ error: 'Authorization is temporarily unavailable.' }, 503);
  }
  if (!authorization.ok) {
    return jsonResponse(
      { error: authorization.reason === 'csrf' ? 'Request could not be completed.' : 'Unauthorized.' },
      authorization.reason === 'csrf' ? 403 : 401
    );
  }

  const getInvitations = dependencies.getInvitationStore || getInvitationStore;
  const getGrants = dependencies.getGrantStore || getGrantStore;
  const now = dependencies.now || Date.now;
  try {
    if (method === 'GET') {
      const [invitationStore, grantStore] = await Promise.all([getInvitations(), getGrants()]);
      return jsonResponse({ entries: await buildAdminRows(invitationStore, grantStore, now()) });
    }

    if (!isSameOrigin(event)) return jsonResponse({ error: 'Request could not be completed.' }, 403);
    const payload = (dependencies.parseBody || parseBody)(event);
    if (!payload || !['revoke', 'reissue'].includes(payload.action)) {
      return jsonResponse({ error: 'Invalid request.' }, 400);
    }

    if (payload.action === 'revoke') {
      if (typeof payload.grantId !== 'string' || !/^[0-9a-f-]{36}$/i.test(payload.grantId)) {
        return jsonResponse({ error: 'Invalid grant.' }, 400);
      }
      const grantStore = await getGrants();
      const key = `grant:${payload.grantId}`;
      const grant = await grantStore.get(key, { type: 'json' });
      if (!grant) return jsonResponse({ error: 'Access grant was not found.' }, 404);
      if (!grant.revokedAt) {
        grant.revokedAt = now();
        grant.revokedBy = authorization.session?.email || ADMIN_EMAIL;
        await grantStore.setJSON(key, grant);
      }
      return jsonResponse({ revoked: true });
    }

    const invitationStore = await getInvitations();
    if (payload.action === 'reissue') {
      if (typeof payload.invitationId !== 'string' || !/^[0-9a-f-]{36}$/i.test(payload.invitationId)) {
        return jsonResponse({ error: 'Invalid invitation.' }, 400);
      }
      const key = `invitation:${payload.invitationId}`;
      const previous = await invitationStore.get(key, { type: 'json' });
      if (!previous || previous.status === 'reissued' || previous.usedAt) {
        return jsonResponse({ error: 'This invitation cannot be reissued.' }, 409);
      }
      if (previous.tokenHash) {
        const claimed = await (dependencies.claimToken || claimGuestToken)(previous.tokenHash);
        if (!claimed) return jsonResponse({ error: 'This invitation has already been used.' }, 409);
        await invitationStore.delete(`token:${previous.tokenHash}`);
      }
      previous.status = 'reissued';
      previous.reissuedAt = now();
      await invitationStore.setJSON(key, previous);

      const created = createGuestInvitationRecord({
        customerEmail: previous.customerEmail,
        duration: previous.duration,
        sharedBy: authorization.session?.email || ADMIN_EMAIL,
        now: now()
      });
      created.invitation.tokenHash = created.tokenHash;
      await invitationStore.setJSON(`invitation:${created.invitation.id}`, created.invitation);
      await invitationStore.setJSON(`token:${created.tokenHash}`, { invitationId: created.invitation.id });
      if (!(await (dependencies.sendInvitation || sendCatalogInvitationEmail)(
        created.invitation,
        created.token,
        dependencies
      ))) {
        await invitationStore.delete(`token:${created.tokenHash}`);
        await invitationStore.delete(`invitation:${created.invitation.id}`);
        previous.status = 'pending';
        previous.tokenHash = null;
        previous.expiresAt = now();
        await invitationStore.setJSON(key, previous);
        return jsonResponse({ error: 'The invitation email could not be sent.' }, 502);
      }
      return jsonResponse({ invited: true });
    }

    return jsonResponse({ error: 'Invalid request.' }, 400);
  } catch {
    return jsonResponse({ error: 'Catalog guest access could not be processed.' }, 503);
  }
};

export default adaptNetlifyHandler(createCatalogGuestAdminHandler());
