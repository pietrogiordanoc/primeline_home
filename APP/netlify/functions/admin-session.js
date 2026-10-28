import {
  ADMIN_EMAIL,
  clearAdminCookies,
  getAdminSession,
  jsonResponse
} from '../shared/admin-auth.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') return jsonResponse({ error: 'Method not allowed.' }, 405);

  try {
    const authenticated = await getAdminSession(event);
    if (!authenticated) return jsonResponse({ authenticated: false }, 200, clearAdminCookies());
    return jsonResponse({ authenticated: true, email: ADMIN_EMAIL }, 200);
  } catch (error) {
    console.error('Admin session status could not be checked.', error);
    return jsonResponse({ error: 'Session status is temporarily unavailable.' }, 503);
  }
};
