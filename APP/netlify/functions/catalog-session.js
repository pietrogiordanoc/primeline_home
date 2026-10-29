import { adaptNetlifyHandler } from '../shared/adapt-netlify-handler.js';

const SESSION_COOKIE = 'access_session';
const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@primelinedist\.com$/i;

const json = (body, statusCode = 200, headers = {}) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers
  },
  body: JSON.stringify(body)
});

const clearSessionCookie = `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;

const getSessionId = (event) => {
  const cookies = event.headers?.cookie || event.headers?.Cookie || '';
  const entry = cookies.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return entry ? entry.slice(SESSION_COOKIE.length + 1) : '';
};

const getAccessStore = async () => {
  const { getStore } = await import('@netlify/blobs');
  return getStore({
    name: 'prime-line-access',
    consistency: 'strong'
  });
};

const handler = async (event) => {
  if (event.httpMethod !== 'GET') return json({ error: 'Method not allowed.' }, 405, { Allow: 'GET' });

  const sessionId = getSessionId(event);
  if (!SESSION_ID_PATTERN.test(sessionId)) {
    return json({ authenticated: false }, 401, { 'Set-Cookie': clearSessionCookie });
  }

  try {
    const store = await getAccessStore();
    const key = `session:${sessionId}`;
    const session = await store.get(key, { type: 'json' });
    if (!session) return json({ authenticated: false }, 401, { 'Set-Cookie': clearSessionCookie });

    if (!Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) {
      await store.delete(key);
      return json({ authenticated: false }, 401, { 'Set-Cookie': clearSessionCookie });
    }

    if (typeof session.email !== 'string' || !EMAIL_PATTERN.test(session.email)) {
      return json({ authenticated: false }, 401, { 'Set-Cookie': clearSessionCookie });
    }
    if (session.resource !== 'catalog-pdf') return json({ authenticated: false }, 401);

    return json({ authenticated: true, resource: 'catalog-pdf' });
  } catch {
    console.error('Catalog access session could not be validated.');
    return json({ error: 'Catalog access is temporarily unavailable.' }, 503);
  }
};

export default adaptNetlifyHandler(handler);
