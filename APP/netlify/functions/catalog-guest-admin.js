import { adaptNetlifyHandler } from '../shared/adapt-netlify-handler.js';
import {
  ADMIN_EMAIL,
  isSameOrigin,
  requireAdminRequest
} from '../shared/admin-auth.js';
import {
  GUEST_DURATIONS,
  createGuestInvitationRecord,
  getEmployeeProfile,
  getEmployeeProfileStore,
  getGrantStore,
  getInvitationStore,
  getActiveGrant,
  jsonResponse,
  listStoreRecords,
  parseBody,
  sendCatalogInvitationEmail,
  updateGuestGrant
} from '../shared/catalog-guest-access.js';

const getStatusForGrant = (grant, now) => {
  if (grant.revokedAt) return 'revoked';
  if (grant.expiresAt !== null && grant.expiresAt <= now) return 'expired';
  return 'active';
};

const buildAdminRows = async (invitationStore, grantStore, now) => {
  const invitations = await listStoreRecords(invitationStore, 'invitation:');
  const grants = await listStoreRecords(grantStore, 'grant:');
  const invitationsById = new Map(invitations.map(invitation => [invitation.id, invitation]));
  const linkedInvitationIds = new Set();
  const rows = grants.map((grant) => {
    linkedInvitationIds.add(grant.invitationId);
    return {
      id: grant.id,
      invitationId: grant.invitationId,
      customerEmail: grant.email,
      sharedBy: grant.sharedBy,
      createdAt: Number.isFinite(invitationsById.get(grant.invitationId)?.createdAt)
        ? invitationsById.get(grant.invitationId).createdAt : null,
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
          createdAt: Number.isFinite(invitation.createdAt) ? invitation.createdAt : null,
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
        createdAt: Number.isFinite(invitation.createdAt) ? invitation.createdAt : null,
        duration: GUEST_DURATIONS[invitation.duration] || invitation.duration,
        expiresAt: invitation.expiresAt,
        status: invitation.status === 'revoked' ? 'revoked' : expired ? 'expired' : 'pending',
        canRevoke: false,
        canReissue: Boolean(!invitation.usedAt && invitation.status !== 'revoked')
      });
    });

  return rows.sort((a, b) => {
    if (a.createdAt === null && b.createdAt !== null) return 1;
    if (b.createdAt === null && a.createdAt !== null) return -1;
    return (b.createdAt - a.createdAt) || String(a.id).localeCompare(String(b.id));
  });
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
    if (!payload || !['revoke', 'reissue', 'reset-devices'].includes(payload.action)) {
      return jsonResponse({ error: 'Invalid request.' }, 400);
    }

    if (payload.action === 'revoke' || payload.action === 'reset-devices') {
      if (typeof payload.grantId !== 'string' || !/^[0-9a-f-]{36}$/i.test(payload.grantId)) {
        return jsonResponse({ error: 'Invalid grant.' }, 400);
      }
      const grantStore = await getGrants();
      if (payload.action === 'reset-devices' && authorization.session?.email !== ADMIN_EMAIL) {
        return jsonResponse({ error: 'Super Admin access is required.' }, 403);
      }
      if (payload.action === 'reset-devices' && payload.confirmed !== true) {
        return jsonResponse({ error: 'Explicit confirmation is required.' }, 400);
      }
      const result = await updateGuestGrant(grantStore, payload.grantId, async (grant) => {
        if (payload.action === 'revoke') {
          if (grant.revokedAt) return { alreadyRevoked: true };
          return { grant: { ...grant, revokedAt: now(), revokedBy: authorization.session?.email || ADMIN_EMAIL } };
        }
        if (!getActiveGrant(grant, now())) return { inactive: true };
        const version = grant.deviceVersion || 0;
        if (!Number.isSafeInteger(version) || version < 0 || version >= Number.MAX_SAFE_INTEGER) {
          throw new Error('Invalid guest device version.');
        }
        const audit = Array.isArray(grant.deviceResetAudit) ? grant.deviceResetAudit : [];
        return { grant: {
          ...grant,
          deviceHashes: [],
          deviceVersion: version + 1,
          deviceResetAudit: [...audit, {
            action: 'reset-authorized-devices', administrator: authorization.session?.email || ADMIN_EMAIL,
            timestamp: now(), previousDeviceCount: Array.isArray(grant.deviceHashes) ? new Set(grant.deviceHashes).size : 0
          }]
        } };
      });
      if (result.missing) return jsonResponse({ error: 'Access grant was not found.' }, 404);
      if (result.inactive) return jsonResponse({ error: 'Only active catalog access can be reset.' }, 409);
      return jsonResponse(payload.action === 'revoke' ? { revoked: true } : { devicesReset: true });
    }

    const invitationStore = await getInvitations();
    if (payload.action === 'reissue') {
      if (typeof payload.invitationId !== 'string' || !/^[0-9a-f-]{36}$/i.test(payload.invitationId)) {
        return jsonResponse({ error: 'Invalid invitation.' }, 400);
      }
      const key = `invitation:${payload.invitationId}`;
      const previousRecord = await invitationStore.getWithMetadata(key, { type: 'json' });
      const previous = previousRecord?.data;
      if (!previous || previous.status === 'reissued' || previous.usedAt) {
        return jsonResponse({ error: 'This invitation cannot be reissued.' }, 409);
      }
      const reissuerEmail = authorization.session?.email || ADMIN_EMAIL;
      const reissuerProfile = await getEmployeeProfile(
        reissuerEmail,
        dependencies.getEmployeeProfileStore || getEmployeeProfileStore
      );
      previous.status = 'reissued';
      previous.reissuedAt = now();
      const changed = await invitationStore.setJSON(key, previous, { onlyIfMatch: previousRecord.etag });
      if (!changed.modified) return jsonResponse({ error: 'This invitation was changed. Please refresh and try again.' }, 409);
      if (previous.tokenHash) await invitationStore.delete(`token:${previous.tokenHash}`);

      const created = createGuestInvitationRecord({
        customerEmail: previous.customerEmail,
        duration: previous.duration,
        sharedBy: reissuerProfile.email || reissuerEmail,
        sharedByName: reissuerProfile.fullName,
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
    console.error('Catalog guest administration could not be completed.');
    return jsonResponse({ error: 'Catalog guest access could not be processed.' }, 503);
  }
};

export default adaptNetlifyHandler(createCatalogGuestAdminHandler());
