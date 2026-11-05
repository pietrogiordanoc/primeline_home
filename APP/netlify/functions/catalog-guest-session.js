import { adaptNetlifyHandler } from '../shared/adapt-netlify-handler.js';
import {
  GUEST_DEVICE_COOKIE,
  GUEST_DURATIONS,
  clearGuestSessionCookie,
  createGuestSession,
  getActiveGrant,
  getGrantStore,
  getGuestSessionStore,
  hashDeviceId,
  jsonResponse,
  listStoreRecords,
  readCookie,
  registerGuestDevice,
  validateGuestSession
} from '../shared/catalog-guest-access.js';

export const createCatalogGuestSessionHandler = (dependencies = {}) => async (event) => {
  if (event.httpMethod !== 'GET') return jsonResponse({ error: 'Method not allowed.' }, 405);
  try {
    const now = dependencies.now || Date.now;
    let authenticated = await (dependencies.validateSession || validateGuestSession)(event, {
      ...dependencies,
      now
    });
    const cookies = [];
    if (!authenticated) {
      const deviceId = readCookie(event, GUEST_DEVICE_COOKIE);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deviceId)) {
        return jsonResponse({ authenticated: false }, 401, [clearGuestSessionCookie()]);
      }

      const grantStore = await (dependencies.getGrantStore || getGrantStore)();
      const grants = await (dependencies.listRecords || listStoreRecords)(grantStore, 'grant:');
      const deviceHash = hashDeviceId(deviceId);
      const grant = grants
        .filter((item) =>
          getActiveGrant(item, now()) &&
          Array.isArray(item.deviceHashes) &&
          item.deviceHashes.includes(deviceHash)
        )
        .sort((a, b) => {
          if (a.expiresAt === null) return b.expiresAt === null ? b.createdAt - a.createdAt : -1;
          if (b.expiresAt === null) return 1;
          return b.expiresAt - a.expiresAt;
        })[0];
      if (!grant) return jsonResponse({ authenticated: false }, 401, [clearGuestSessionCookie()]);

      const session = await (dependencies.createSession || createGuestSession)(
        grant,
        {
          getSessionStore: dependencies.getGuestSessionStore || getGuestSessionStore,
          now,
          deviceHash
        }
      );
      cookies.push(session.cookie);
      authenticated = { session: session.session, grant };
    }

    if (authenticated.session.deviceHash) {
      const device = await (dependencies.registerDevice || registerGuestDevice)(
        authenticated.grant,
        event,
        { getGrantStore: dependencies.getGrantStore || getGrantStore, now }
      );
      if (device.limitReached || device.expired) {
        return jsonResponse({ authenticated: false }, 401, [clearGuestSessionCookie()]);
      }
      cookies.push(device.cookie);
    }

    return jsonResponse({
      authenticated: true,
      resource: 'catalog-guest',
      duration: GUEST_DURATIONS[authenticated.grant.duration],
      expiresAt: authenticated.grant.expiresAt,
      sessionExpiresAt: authenticated.session.expiresAt,
      sharedBy: authenticated.grant.sharedBy || null,
      sharedByName: authenticated.grant.sharedByName || null
    }, 200, cookies);
  } catch {
    return jsonResponse({ error: 'Guest catalog session could not be verified.' }, 503);
  }
};

export default adaptNetlifyHandler(createCatalogGuestSessionHandler());
