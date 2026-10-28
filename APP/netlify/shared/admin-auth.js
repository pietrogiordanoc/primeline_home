import { createHash, randomUUID } from 'node:crypto';

export const ADMIN_EMAIL = 'pietro@primelinedist.com';
export const ADMIN_RESOURCE = 'admin';
export const ADMIN_CHALLENGE_COOKIE = '__Host-pl-admin-challenge';
export const ADMIN_SESSION_COOKIE = '__Host-pl-admin-session';
export const ADMIN_SESSION_LIFETIME_SECONDS = 8 * 60 * 60;

const getHeader = (event, name) => {
  const entry = Object.entries(event.headers || {}).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return entry?.[1] || '';
};

export const getAdminStore = async () => {
  const { getStore } = await import('@netlify/blobs');
  return getStore({
    name: 'prime-line-admin-auth',
    consistency: 'strong',
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_AUTH_TOKEN
  });
};

export const jsonResponse = (body, statusCode = 200, cookies = []) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  },
  ...(cookies.length ? { multiValueHeaders: { 'Set-Cookie': cookies } } : {}),
  body: JSON.stringify(body)
});

export const hashValue = (value) => createHash('sha256').update(value).digest('hex');
export const hashOtp = (challengeId, code) => hashValue(`${challengeId}:${code}`);

export const readCookie = (event, name) => {
  const cookies = getHeader(event, 'cookie');
  const entry = cookies.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return entry ? entry.slice(name.length + 1) : '';
};

export const makeCookie = (name, value, maxAge) =>
  `${name}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Strict`;

export const clearAdminCookies = () => [
  makeCookie(ADMIN_CHALLENGE_COOKIE, '', 0),
  makeCookie(ADMIN_SESSION_COOKIE, '', 0)
];

export const isSameOrigin = (event) => {
  const origin = getHeader(event, 'origin');
  const host = getHeader(event, 'host');
  const forwardedProto = getHeader(event, 'x-forwarded-proto').split(',')[0].trim().toLowerCase();
  const protocol = forwardedProto || (/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host) ? 'http' : 'https');
  const fetchSite = getHeader(event, 'sec-fetch-site').toLowerCase();
  if (!origin || !host || fetchSite === 'cross-site') return false;

  try {
    return new URL(origin).origin === `${protocol}://${host}`;
  } catch {
    return false;
  }
};

export const parseJsonBody = (event, maxBytes = 4096) => {
  const body = typeof event.body === 'string' ? event.body : '';
  const bytes = event.isBase64Encoded
    ? Buffer.from(body, 'base64')
    : Buffer.from(body, 'utf8');
  if (bytes.byteLength > maxBytes) return { error: 'too-large' };

  try {
    const payload = JSON.parse(bytes.toString('utf8'));
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { error: 'invalid' };
    return { payload };
  } catch {
    return { error: 'invalid' };
  }
};

export const checkRateLimit = async (store, key, maxRequests, windowMs, now = Date.now()) => {
  const prefix = `${key}:event:`;
  const cutoff = now - windowMs;
  const current = await store.list({ prefix });
  const activeKeys = [];

  for (const blob of current.blobs) {
    const timestamp = Number(blob.key.slice(prefix.length).split(':')[0]);
    if (Number.isFinite(timestamp) && timestamp > cutoff) activeKeys.push(blob.key);
    else await store.delete(blob.key);
  }
  if (activeKeys.length >= maxRequests) return false;

  await store.set(`${prefix}${now}:${randomUUID()}`, String(now));
  const updated = await store.list({ prefix });
  const activeCount = updated.blobs.filter((blob) => {
    const timestamp = Number(blob.key.slice(prefix.length).split(':')[0]);
    return Number.isFinite(timestamp) && timestamp > cutoff;
  }).length;
  return activeCount <= maxRequests;
};

export const getAdminSession = async (event) => {
  const sessionId = readCookie(event, ADMIN_SESSION_COOKIE);
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return null;

  const store = await getAdminStore();
  const key = `admin:session:${sessionId}`;
  const session = await store.get(key, { type: 'json' });
  if (
    !session ||
    session.email !== ADMIN_EMAIL ||
    session.resource !== ADMIN_RESOURCE ||
    !Number.isFinite(session.expiresAt) ||
    session.expiresAt <= Date.now()
  ) {
    if (session) await store.delete(key);
    return null;
  }

  return { session, sessionId, store };
};

export const requireAdminSession = async (event) => {
  const authenticated = await getAdminSession(event);
  return authenticated ? { ok: true, ...authenticated } : { ok: false };
};

export const requireAdminRequest = async (event, { stateChanging = false } = {}) => {
  if (stateChanging && !isSameOrigin(event)) return { ok: false, reason: 'csrf' };
  const authorization = await requireAdminSession(event);
  return authorization.ok ? authorization : { ok: false, reason: 'unauthorized' };
};
