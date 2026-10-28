import {
  ADMIN_SESSION_COOKIE,
  clearAdminCookies,
  getAdminSession,
  isSameOrigin,
  jsonResponse,
  readCookie
} from '../shared/admin-auth.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);
  if (!isSameOrigin(event)) return jsonResponse({ error: 'Request could not be completed.' }, 403);

  try {
    const sessionId = readCookie(event, ADMIN_SESSION_COOKIE);
    const authenticated = await getAdminSession(event);
    if (authenticated) await authenticated.store.delete(`admin:session:${sessionId}`);
    return jsonResponse({ authenticated: false }, 200, clearAdminCookies());
  } catch (error) {
    console.error('Admin logout could not revoke the session.', error);
    return jsonResponse({ error: 'Sign out is temporarily unavailable.' }, 503);
  }
};
