import { adaptNetlifyHandler } from '../shared/adapt-netlify-handler.js';
import {
  GUEST_DURATIONS,
  clearGuestSessionCookie,
  guestDeviceCookieForGrant,
  guestDeviceIdentity,
  jsonResponse,
  validateGuestSession
} from '../shared/catalog-guest-access.js';

export const createCatalogGuestSessionHandler = (dependencies = {}) => async (event) => {
  if (event.httpMethod !== 'GET') return jsonResponse({ error: 'Method not allowed.' }, 405);
  try {
    const now = dependencies.now || Date.now;
    const authenticated = await (dependencies.validateSession || validateGuestSession)(event, {
      ...dependencies,
      now
    });
    const cookies = [];
    if (!authenticated) {
      return jsonResponse({ authenticated: false }, 401, [clearGuestSessionCookie()]);
    }

    if (authenticated.session.deviceHash) {
      const device = guestDeviceIdentity(event);
      if (!device || authenticated.session.deviceHash !== device.deviceHash) {
        return jsonResponse({ authenticated: false }, 401, [clearGuestSessionCookie()]);
      }
      cookies.push(guestDeviceCookieForGrant(device.deviceId, authenticated.grant, now()));
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
