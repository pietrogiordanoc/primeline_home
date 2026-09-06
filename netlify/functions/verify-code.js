const crypto = require('node:crypto');

const CODE_LIFETIME_MS = 10 * 60 * 1000;
const SESSION_LIFETIME_SECONDS = 7 * 24 * 60 * 60;
const LOCKOUT_MS = 60 * 60 * 1000;
const allowedDomain = '@primelinedist.com';

const json = (body, statusCode = 200, headers = {}, multiValueHeaders = {}) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', ...headers },
  multiValueHeaders,
  body: JSON.stringify(body)
});

const cookie = (name, value, maxAge) => `${name}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;

const getCookie = (event, name) => {
  const cookies = event.headers.cookie || event.headers.Cookie || '';
  const entry = cookies.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return entry ? entry.slice(name.length + 1) : '';
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const { getStore } = await import('@netlify/blobs');

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  const email = String(payload.email || '').trim().toLowerCase();
  const code = String(payload.code || '').trim();
  const resource = String(payload.resource || '').trim();
  const challengeId = getCookie(event, 'access_challenge');
  if (!email.endsWith(allowedDomain) || !/^\d{3}$/.test(code) || !resource || !challengeId) {
    return json({ error: 'Invalid code.' }, 401);
  }

  const store = getStore({ name: 'prime-line-access', consistency: 'strong' });
  const key = `challenge:${challengeId}`;
  const challenge = await store.get(key, { type: 'json' });
  if (!challenge || challenge.email !== email || challenge.resource !== resource || challenge.expiresAt < Date.now()) {
    return json({ error: 'Invalid or expired code.' }, 401);
  }

  if (challenge.lockedUntil && challenge.lockedUntil > Date.now()) {
    return json({ error: 'Too many attempts. Try again later.' }, 429);
  }

  const submittedHash = crypto.createHash('sha256').update(code).digest('hex');
  if (submittedHash !== challenge.codeHash) {
    challenge.attempts += 1;
    if (challenge.attempts >= 3) challenge.lockedUntil = Date.now() + LOCKOUT_MS;
    await store.setJSON(key, challenge);
    return json({ error: challenge.lockedUntil ? 'Too many attempts. Try again later.' : 'Invalid code.' }, 401);
  }

  const sessionId = crypto.randomUUID();
  await store.setJSON(`session:${sessionId}`, {
    email,
    resource,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_LIFETIME_SECONDS * 1000
  });
  await store.delete(key);

  return json(
    { message: 'Access granted.' },
    200,
    {},
    {
      'Set-Cookie': [
        cookie('access_session', sessionId, SESSION_LIFETIME_SECONDS),
        cookie('access_challenge', '', 0)
      ]
    }
  );
};
