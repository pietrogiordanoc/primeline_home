import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import requestCode from '../functions/request-code.js';
import verifyCode from '../functions/verify-code.js';

const SITE_ID = 'mock-site';
const STORE_NAME = 'site:prime-line-access';
const SITE_STORE_PREFIX = `${SITE_ID}/${STORE_NAME}/`;
const ACCESS_EMAIL = 'buyer@primelinedist.com';

const jsonRequest = (url, body, headers = {}) => new Request(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body)
});

const setCookieValues = (response) =>
  response.headers.getSetCookie?.() ?? [response.headers.get('set-cookie')].filter(Boolean);

const cookieValue = (cookies, name) => {
  const cookie = cookies.find((value) => value.startsWith(`${name}=`));
  assert.ok(cookie, `Expected ${name} cookie`);
  return cookie.slice(name.length + 1).split(';')[0];
};

const withMockRuntime = async (run) => {
  const previous = {
    apiKey: process.env.RESEND_API_KEY,
    fromEmail: process.env.FROM_EMAIL,
    fetch: globalThis.fetch,
    blobsContext: Object.getOwnPropertyDescriptor(globalThis, 'netlifyBlobsContext')
  };
  const blobs = new Map();
  const blobRequests = [];
  const emails = [];
  process.env.RESEND_API_KEY = 'mock-resend-key';
  process.env.FROM_EMAIL = 'info@primelinedist.com';
  globalThis.netlifyBlobsContext = Buffer.from(JSON.stringify({
    apiURL: 'https://blobs.test',
    siteID: SITE_ID,
    token: 'mock-runtime-token'
  })).toString('base64');

  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const method = (options.method || 'GET').toUpperCase();
    const headers = new Headers(options.headers || {});

    if (url.hostname === 'blobs.test') {
      blobRequests.push({
        url: url.toString(),
        method,
        hasRuntimeAuthorization: Boolean(headers.get('authorization'))
      });
      const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
      assert.deepEqual(parts.slice(0, 3), ['api', 'v1', 'blobs']);
      const [siteId, storeName, ...keyParts] = parts.slice(3);
      assert.equal(siteId, SITE_ID);
      assert.equal(storeName, STORE_NAME);
      const key = keyParts.join('/');
      const storePrefix = `${siteId}/${storeName}/`;

      if (headers.get('accept')?.includes('application/json;type=signed-url')) {
        const signedPath = [siteId, storeName, key].map(encodeURIComponent).join('/');
        return new Response(JSON.stringify({ url: `https://blob-storage.test/${signedPath}` }));
      }

      if (method === 'DELETE') {
        blobs.delete(`${storePrefix}${key}`);
        return new Response(null, { status: 204 });
      }

      throw new Error(`Unexpected Blobs API request: ${method} ${url.pathname}`);
    }

    if (url.hostname === 'blob-storage.test') {
      const [siteId, storeName, ...keyParts] = url.pathname
        .split('/')
        .filter(Boolean)
        .map(decodeURIComponent);
      const blobKey = `${siteId}/${storeName}/${keyParts.join('/')}`;
      if (method === 'PUT') {
        blobs.set(blobKey, await new Response(options.body).text());
        return new Response(null, { status: 200 });
      }
      if (method === 'GET') {
        if (!blobs.has(blobKey)) return new Response(null, { status: 404 });
        return new Response(blobs.get(blobKey), { status: 200 });
      }
      throw new Error(`Unexpected signed Blobs request: ${method} ${url.pathname}`);
    }

    if (url.hostname === 'api.resend.com') {
      emails.push(JSON.parse(options.body));
      return new Response(JSON.stringify({ id: 'mock-email-id' }), { status: 200 });
    }

    throw new Error(`Unexpected network request: ${url.origin}`);
  };

  try {
    await run({ blobs, blobRequests, emails });
  } finally {
    globalThis.fetch = previous.fetch;
    if (previous.apiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previous.apiKey;
    if (previous.fromEmail === undefined) delete process.env.FROM_EMAIL;
    else process.env.FROM_EMAIL = previous.fromEmail;
    if (previous.blobsContext) {
      Object.defineProperty(globalThis, 'netlifyBlobsContext', previous.blobsContext);
    } else {
      delete globalThis.netlifyBlobsContext;
    }
  }
};

const requestAccessCode = (email, resource) => requestCode(jsonRequest(
  'https://primelinedist.com/api/access/request-code',
  { email, resource }
));

const verifyAccessCode = (email, resource, code, challengeId) => verifyCode(jsonRequest(
  'https://primelinedist.com/api/access/verify-code',
  { email, resource, code },
  { cookie: `access_challenge=${challengeId}` }
));

const getChallenge = (blobs, challengeId) => {
  const value = blobs.get(`${SITE_STORE_PREFIX}challenge:${challengeId}`);
  assert.ok(value, 'Expected stored OTP challenge');
  return JSON.parse(value);
};

test('rejects external and deceptive email domains without sending or storing', async () => {
  await withMockRuntime(async ({ blobs, blobRequests, emails }) => {
    for (const email of [
      'buyer@example.com',
      'buyer@primelinedist.com.evil.example',
      'buyer@notprimelinedist.com',
      'buyer@@primelinedist.com'
    ]) {
      const response = await requestAccessCode(email, 'catalog-pdf');
      assert.equal(response.status, 400, email);
    }
    assert.equal(emails.length, 0);
    assert.equal(blobRequests.length, 0);
    assert.equal(blobs.size, 0);
  });
});

test('modern OTP handlers use runtime Blobs credentials and verify Catalog and Masterlink access', async () => {
  await withMockRuntime(async ({ blobs, blobRequests, emails }) => {
    for (const resource of ['catalog-pdf', 'masterlink']) {
      const requestResponse = await requestAccessCode(ACCESS_EMAIL, resource);
      assert.equal(requestResponse.status, 200);
      const challengeCookies = setCookieValues(requestResponse);
      const challengeId = cookieValue(challengeCookies, 'access_challenge');
      assert.match(challengeCookies.find((value) => value.startsWith('access_challenge=')), /HttpOnly; Secure; SameSite=Lax/);

      const challenge = getChallenge(blobs, challengeId);
      assert.equal(challenge.email, ACCESS_EMAIL);
      assert.equal(challenge.resource, resource);
      assert.equal(challenge.attempts, 0);
      assert.equal(challenge.codeHash.length, 64);

      const message = emails.at(-1);
      assert.equal(message.from, 'info@primelinedist.com');
      assert.deepEqual(message.to, [ACCESS_EMAIL]);
      assert.equal(message.subject, 'Your Prime Line access code');
      assert.match(message.text, /expires in 10 minutes/);
      assert.match(message.html, /Logo1500\.png/);
      const code = message.text.match(/access code is (\d{3})\./)?.[1];
      assert.match(code || '', /^\d{3}$/);
      assert.equal(challenge.codeHash, createHash('sha256').update(code).digest('hex'));

      const verifyResponse = await verifyAccessCode(ACCESS_EMAIL, resource, code, challengeId);
      assert.equal(verifyResponse.status, 200);
      assert.deepEqual(await verifyResponse.json(), { message: 'Access granted.' });
      const verifyCookies = setCookieValues(verifyResponse);
      const sessionId = cookieValue(verifyCookies, 'access_session');
      assert.match(verifyCookies.find((value) => value.startsWith('access_session=')), /HttpOnly; Secure; SameSite=Lax/);
      assert.match(verifyCookies.find((value) => value.startsWith('access_challenge=')), /Max-Age=0/);

      const session = JSON.parse(blobs.get(`${SITE_STORE_PREFIX}session:${sessionId}`));
      assert.equal(session.email, ACCESS_EMAIL);
      assert.equal(session.resource, resource);
      assert.ok(session.expiresAt > session.createdAt);
      assert.equal(blobs.has(`${SITE_STORE_PREFIX}challenge:${challengeId}`), false);
    }

    assert.ok(blobRequests.length > 0);
    assert.ok(blobRequests.every((request) => request.hasRuntimeAuthorization));
    assert.equal(emails.length, 2);
  });
});

test('enforces invalid-code attempts, lockout, and challenge expiry', async () => {
  await withMockRuntime(async ({ blobs, emails }) => {
    const requestResponse = await requestAccessCode(ACCESS_EMAIL, 'masterlink');
    const challengeId = cookieValue(setCookieValues(requestResponse), 'access_challenge');
    const correctCode = emails[0].text.match(/access code is (\d{3})\./)[1];
    const incorrectCode = correctCode === '000' ? '001' : '000';

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await verifyAccessCode(ACCESS_EMAIL, 'masterlink', incorrectCode, challengeId);
      assert.equal(response.status, 401);
    }
    const lockedChallenge = getChallenge(blobs, challengeId);
    assert.equal(lockedChallenge.attempts, 3);
    assert.ok(lockedChallenge.lockedUntil > Date.now());
    assert.equal((await verifyAccessCode(ACCESS_EMAIL, 'masterlink', correctCode, challengeId)).status, 429);

    const expiredRequest = await requestAccessCode(ACCESS_EMAIL, 'catalog-pdf');
    const expiredId = cookieValue(setCookieValues(expiredRequest), 'access_challenge');
    const expiredChallenge = getChallenge(blobs, expiredId);
    expiredChallenge.expiresAt = Date.now() - 1;
    blobs.set(`${SITE_STORE_PREFIX}challenge:${expiredId}`, JSON.stringify(expiredChallenge));
    const expiredVerify = await verifyAccessCode(
      ACCESS_EMAIL,
      'catalog-pdf',
      emails[1].text.match(/access code is (\d{3})\./)[1],
      expiredId
    );
    assert.equal(expiredVerify.status, 401);
    assert.match((await expiredVerify.json()).error, /expired/i);
  });
});
