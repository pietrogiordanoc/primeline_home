import { adaptNetlifyHandler } from '../shared/adapt-netlify-handler.js';
import {
  ADMIN_EMAIL,
  isSameOrigin,
  requireAdminRequest
} from '../shared/admin-auth.js';
import {
  GUEST_DURATIONS,
  createId,
  createGuestInvitationRecord,
  getEmployeeProfile,
  getEmployeeProfileStore,
  getGrantStore,
  getInvitationStore,
  getActiveGrant,
  isGuestDuration,
  jsonResponse,
  listStoreRecords,
  parseBody,
  sendCatalogInvitationEmail,
  updateGuestGrant
} from '../shared/catalog-guest-access.js';

const getStatusForGrant = (grant, now) => {
  if (grant.revokedAt || grant.status === 'revoked') return 'revoked';
  if (grant.expiresAt !== null && grant.expiresAt <= now) return 'expired';
  return 'active';
};

const isExpired = (record, now) =>
  Number.isFinite(record.expiresAt) && record.expiresAt <= now;

const isDeletable = (record, now, bulk, revoked) =>
  isGuestDuration(record.duration) && record.duration !== 'permanent' && Number.isFinite(record.expiresAt) &&
  (isExpired(record, now) || (!bulk && revoked));

const buildAdminRows = async (invitationStore, grantStore, now) => {
  const invitations = await listStoreRecords(invitationStore, 'invitation:');
  const grants = await listStoreRecords(grantStore, 'grant:');
  const invitationsById = new Map(invitations.map(invitation => [invitation.id, invitation]));
  const grantIds = new Set(grants.map(grant => grant.id));
  const grantCounts = new Map();
  grants.filter(grant => grant.status !== 'deleted').forEach((grant) => {
    grantCounts.set(grant.invitationId, (grantCounts.get(grant.invitationId) || 0) + 1);
  });
  const linkedInvitationIds = new Set();
  const rows = grants.flatMap((grant) => {
    linkedInvitationIds.add(grant.invitationId);
    if (grant.status === 'deleted') return [];
    const invitation = invitationsById.get(grant.invitationId);
    const safeLink = (!invitation || (invitation.grantId === grant.id && invitation.usedAt &&
      invitation.duration !== 'permanent')) && grantCounts.get(grant.invitationId) === 1;
    const canDelete = Boolean(safeLink && isDeletable(grant, now, false, Boolean(grant.revokedAt || grant.status === 'revoked')));
    return [{
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
      canReissue: false,
      canDelete,
      canBulkDelete: canDelete && isExpired(grant, now),
      recordType: 'grant'
    }];
  });

  invitations
    .filter((invitation) => invitation.status !== 'deleted' && !linkedInvitationIds.has(invitation.id))
    .forEach((invitation) => {
      const safeInvitation = !invitation.usedAt &&
        ['pending', 'revoked', 'reissued'].includes(invitation.status) &&
        (!invitation.grantId || !grantIds.has(invitation.grantId));
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
          canReissue: false,
          canDelete: Boolean(safeInvitation && isDeletable(invitation, now, false, true)),
          canBulkDelete: Boolean(safeInvitation && isDeletable(invitation, now, true, true)),
          recordType: 'invitation'
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
        canReissue: Boolean(!invitation.usedAt && invitation.status !== 'revoked'),
        canDelete: Boolean(safeInvitation && isDeletable(invitation, now, false, invitation.status === 'revoked')),
        canBulkDelete: Boolean(safeInvitation && isDeletable(invitation, now, true, false)),
        recordType: 'invitation'
      });
    });

  return rows.sort((a, b) => {
    if (a.createdAt === null && b.createdAt !== null) return 1;
    if (b.createdAt === null && a.createdAt !== null) return -1;
    return (b.createdAt - a.createdAt) || String(a.id).localeCompare(String(b.id));
  });
};

// Tombstones prevent an in-flight redemption from recreating a deleted grant.
const deletionMarker = (record, administrator, now) => ({
  id: record.id,
  ...(record.invitationId ? { invitationId: record.invitationId } : {}),
  status: 'deleted',
  expiresAt: 0,
  deletedAt: now,
  deletedBy: administrator,
  originalExpiresAt: record.expiresAt,
  ...(record.duration ? { duration: record.duration } : {}),
  ...(Number.isFinite(record.createdAt) ? { createdAt: record.createdAt } : {}),
  ...(record.revokedAt ? { revokedAt: record.revokedAt, revokedBy: record.revokedBy || null } : {}),
  ...(record.reissuedAt ? { reissuedAt: record.reissuedAt } : {}),
  ...(Array.isArray(record.deviceResetAudit) ? { deviceResetAudit: record.deviceResetAudit } : {})
});

const verifyConditionalWrites = async (store) => {
  const key = `deletion-probe:${createId()}`;
  try {
    const created = await store.setJSON(key, { probe: 1 }, { onlyIfNew: true });
    if (!created?.modified || !created.etag) throw new Error('Conditional guest storage is unavailable.');
    const duplicate = await store.setJSON(key, { probe: 2 }, { onlyIfNew: true });
    const conflict = await store.setJSON(key, { probe: 3 }, { onlyIfMatch: '"deletion-probe-conflict"' });
    if (duplicate?.modified !== false || conflict?.modified !== false) {
      throw new Error('Conditional guest storage did not reject a conflict.');
    }
  } finally {
    await store.delete(key);
  }
};

const deleteGuestRecord = async (invitationStore, grantStore, grants, type, id, bulk, administrator, now, cutoff) => {
  const store = type === 'grant' ? grantStore : invitationStore;
  const key = `${type}:${id}`;
  for (let attempt = 0; attempt < 10; attempt++) {
    const current = await store.getWithMetadata(key, { type: 'json' });
    const record = current?.data;
    if (!record || record.status === 'deleted') return false;
    if (!current.etag) throw new Error('Guest record metadata is unavailable.');
    const revoked = type === 'grant'
      ? Boolean(record.revokedAt || record.status === 'revoked')
      : record.status === 'revoked' || record.status === 'reissued';
    if (!isDeletable(record, bulk ? Math.min(now(), cutoff) : now(), bulk, revoked)) return false;

    if (type === 'invitation') {
      if (record.usedAt || !['pending', 'revoked', 'reissued'].includes(record.status)) return false;
      if (record.grantId && await grantStore.get(`grant:${record.grantId}`, { type: 'json' })) return false;
    } else if (record.invitationId) {
      const invitation = await invitationStore.get(`invitation:${record.invitationId}`, { type: 'json' });
      if (invitation && (invitation.grantId !== record.id || !invitation.usedAt ||
          invitation.duration === 'permanent')) return false;
      if (grants.some(grant => grant.status !== 'deleted' &&
          grant.invitationId === record.invitationId && grant.id !== record.id)) return false;
    }

    const changed = await store.setJSON(key, deletionMarker(record, administrator, now()), { onlyIfMatch: current.etag });
    if (!changed.modified) continue;

    try {
      if (type === 'grant' && record.invitationId) {
        const invitationKey = `invitation:${record.invitationId}`;
        for (let retry = 0; retry < 10; retry++) {
          const linked = await invitationStore.getWithMetadata(invitationKey, { type: 'json' });
          if (!linked || linked.data.status === 'deleted') break;
          if (!linked.etag) throw new Error('Guest invitation metadata is unavailable.');
          if (linked.data.grantId !== record.id) throw new Error('Guest invitation linkage changed during deletion.');
          const updated = await invitationStore.setJSON(
            invitationKey, deletionMarker(linked.data, administrator, now()), { onlyIfMatch: linked.etag }
          );
          if (updated.modified) break;
          if (retry === 9) throw new Error('Guest invitation deletion conflicted repeatedly.');
        }
      }
    } catch (error) {
      throw Object.assign(new Error('Guest access was invalidated but its invitation could not be erased.', { cause: error }), { recordDeleted: true });
    }
    // Tokens and sessions are invalid once their invitation or grant is tombstoned.
    return true;
  }
  throw new Error('Guest record deletion conflicted repeatedly.');
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
      const asOf = now();
      return jsonResponse({ entries: await buildAdminRows(invitationStore, grantStore, asOf), asOf });
    }

    if (!isSameOrigin(event)) return jsonResponse({ error: 'Request could not be completed.' }, 403);
    const payload = (dependencies.parseBody || parseBody)(event, 5 * 1024 * 1024);
    if (!payload || !['revoke', 'reissue', 'reset-devices', 'delete', 'delete-expired'].includes(payload.action)) {
      return jsonResponse({ error: 'Invalid request.' }, 400);
    }

    if (payload.action === 'delete' || payload.action === 'delete-expired') {
      if (authorization.session?.email !== ADMIN_EMAIL) {
        return jsonResponse({ error: 'Super Admin access is required.' }, 403);
      }
      if (payload.action === 'delete' &&
          (!['grant', 'invitation'].includes(payload.recordType) ||
           typeof payload.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(payload.id))) {
        return jsonResponse({ error: 'Invalid record.' }, 400);
      }
      const [invitationStore, grantStore] = await Promise.all([getInvitations(), getGrants()]);
      const bulk = payload.action === 'delete-expired';
      if (bulk && (!Number.isFinite(payload.asOf) || payload.asOf > now() ||
          !Array.isArray(payload.records) || payload.records.some(record =>
            !record || !['grant', 'invitation'].includes(record.recordType) ||
            typeof record.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(record.id)))) {
        return jsonResponse({ error: 'Refresh the records before deleting expired access.' }, 400);
      }
      await verifyConditionalWrites(invitationStore);
      await verifyConditionalWrites(grantStore);
      const candidates = bulk
        ? [...new Map(payload.records.map(record => [`${record.recordType}:${record.id}`, record])).values()]
        : [{ recordType: payload.recordType, id: payload.id }];
      const grants = await listStoreRecords(grantStore, 'grant:');
      let deleted = 0;
      for (const candidate of candidates) {
        try {
          if (await deleteGuestRecord(invitationStore, grantStore, grants, candidate.recordType, candidate.id, bulk, authorization.session.email, now, payload.asOf)) deleted++;
        } catch (error) {
          if (error.recordDeleted) deleted++;
          console.error('Catalog guest deletion failed:', error);
          const message = error.recordDeleted
            ? 'Access was invalidated, but invitation cleanup failed. Contact support.'
            : 'Some records could not be deleted. Refresh and try again.';
          return jsonResponse({ deleted, error: message }, 503);
        }
      }
      return jsonResponse({ deleted });
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
      if (!previous || ['reissued', 'deleted'].includes(previous.status) || previous.usedAt) {
        return jsonResponse({ error: 'This invitation cannot be reissued.' }, 409);
      }
      if (!previousRecord.etag) throw new Error('Guest invitation metadata is unavailable.');
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
        if (!changed.etag) {
          console.error('Catalog invitation metadata was unavailable after failed reissue.');
        } else {
          const restored = await invitationStore.setJSON(key, previous, { onlyIfMatch: changed.etag });
          if (!restored.modified) console.error('Catalog invitation changed before failed reissue could be restored.');
        }
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
