import { adaptNetlifyHandler } from '../shared/adapt-netlify-handler.js';
import {
  GUEST_DURATIONS,
  clearGuestSessionCookie,
  jsonResponse,
  validateGuestSession
} from '../shared/catalog-guest-access.js';

export const createCatalogGuestSessionHandler = (dependencies = {}) => async (event) => {
  if (event.httpMethod !== 'GET') return jsonResponse({ error: 'Method not allowed.' }, 405);
  try {
    const authenticated = await (dependencies.validateSession || validateGuestSession)(event, dependencies);
    if (!authenticated) return jsonResponse({ authenticated: false }, 401, [clearGuestSessionCookie()]);
    return jsonResponse({
      authenticated: true,
      resource: 'catalog-guest',
      duration: GUEST_DURATIONS[authenticated.grant.duration],
      expiresAt: authenticated.grant.expiresAt,
      sessionExpiresAt: authenticated.session.expiresAt
    });
  } catch {
    return jsonResponse({ error: 'Guest catalog session could not be verified.' }, 503);
  }
};

export default adaptNetlifyHandler(createCatalogGuestSessionHandler());
