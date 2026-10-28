import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_CHALLENGE_COOKIE,
  ADMIN_EMAIL,
  ADMIN_RESOURCE,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_LIFETIME_SECONDS,
  hashOtp,
  hashValue
} from '../shared/admin-auth.js';
import { adaptNetlifyHandler } from '../shared/adapt-netlify-handler.js';
import { createRequestAdminCodeHandler } from '../functions/request-admin-code.js';
import verifyAdminCode from '../functions/verify-admin-code.js';
import adminSession from '../functions/admin-session.js';
import logoutAdmin from '../functions/logout-admin.js';
import contactRoutingAdmin from '../functions/contact-routing-admin.js';

const STORE_NAME = 'site:prime-line-admin-auth';
const SITE_ID = 'mock-site';
const response = (body, status = 200) =>
  new Response(body, { status, headers: { 'content-type': 'application/json' } });

const withMockBlobs = async (run) => {
  const originalFetch = globalThis.fetch;
  const contextDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'netlifyBlobsContext');
  const blobs = new Map();
  const requests = [];
  globalThis.netlifyBlobsContext = Buffer.from(JSON.stringify({
    apiURL: 'https://blobs.test',
    siteID: SITE_ID,
    token: 'mock-runtime-token'
  })).toString('base64');

  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const method = (options.method || 'GET').toUpperCase();
    const headers = new Headers(options.headers || {});
    requests.push({ url: url.toString(), method, hasAuthorization: Boolean(headers.get('authorization')) });

    if (url.hostname === 'blobs.test') {
      const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
      assert.deepEqual(parts.slice(0, 3), ['api', 'v1', 'blobs']);
      const [siteId, storeName, ...keyParts] = parts.slice(3);
      assert.equal(siteId, SITE_ID);
      assert.equal(storeName, STORE_NAME);
      const key = keyParts.join('/');
      const storePrefix = `${siteId}/${storeName}/`;

      if (!key && method === 'GET') {
        const prefix = url.searchParams.get('prefix') || '';
        const matchingKeys = [...blobs.keys()]
          .filter((blobKey) => blobKey.startsWith(storePrefix))
          .map((blobKey) => blobKey.slice(storePrefix.length))
          .filter((blobKey) => blobKey.startsWith(prefix));
        return response(JSON.stringify({ blobs: matchingKeys.map((blobKey) => ({ key: blobKey })) }));
      }

      if (headers.get('accept')?.includes('application/json;type=signed-url')) {
        const signedPath = [siteId, storeName, key].map(encodeURIComponent).join('/');
        return response(JSON.stringify({ url: `https://blob-storage.test/${signedPath}` }));
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

    throw new Error(`Unexpected network request: ${url.origin}`);
  };

  try {
    await run({ blobs, requests });
  } finally {
    globalThis.fetch = originalFetch;
    if (contextDescriptor) {
      Object.defineProperty(globalThis, 'netlifyBlobsContext', contextDescriptor);
    } else {
      delete globalThis.netlifyBlobsContext;
    }
  }
};

const cookieValue = (setCookieHeaders, cookieName) => {
  const cookie = setCookieHeaders.find((value) => value.startsWith(`${cookieName}=`));
  assert.ok(cookie, `Expected ${cookieName} cookie`);
  return cookie.slice(cookieName.length + 1).split(';')[0];
};

const netlifyRequest = (method, headers = {}, body) =>
  new Request('https://primelinedist.com/.netlify/functions/admin-test', {
    method,
    headers: { origin: 'https://primelinedist.com', ...headers },
    ...(body === undefined ? {} : { body })
  });

const responseCookies = (response) =>
  response.headers.getSetCookie?.() ??
  (response.headers.get('set-cookie') || '').split(/, (?=__Host-pl-admin-)/).filter(Boolean);

test('Admin OTP generation, rate limiting, verification, session and logout use runtime Blobs credentials', async () => {
  await withMockBlobs(async ({ blobs, requests }) => {
    const sentCodes = [];
    const requestAdminCode = adaptNetlifyHandler(createRequestAdminCodeHandler(async (code) => {
      sentCodes.push(code);
      return true;
    }));

    const requestResponses = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      requestResponses.push(await requestAdminCode(netlifyRequest(
        'POST',
        {},
        JSON.stringify({ email: ADMIN_EMAIL })
      )));
    }

    assert.ok(requestResponses.every((result) => result.status === 202));
    assert.equal(sentCodes.length, 3);
    assert.ok(sentCodes.every((code) => /^\d{6}$/.test(code)));
    assert.ok(requests.some((request) => request.hasAuthorization));

    const challengeId = cookieValue(
      responseCookies(requestResponses[2]),
      ADMIN_CHALLENGE_COOKIE
    );
    const verifyResponse = await verifyAdminCode(netlifyRequest(
      'POST',
      { cookie: `${ADMIN_CHALLENGE_COOKIE}=${challengeId}` },
      JSON.stringify({ code: sentCodes[2] })
    ));

    assert.equal(verifyResponse.status, 200);
    assert.equal((await verifyResponse.json()).authenticated, true);
    const cookies = responseCookies(verifyResponse);
    const sessionId = cookieValue(cookies, ADMIN_SESSION_COOKIE);
    const sessionKey = `${SITE_ID}/${STORE_NAME}/admin:session:${sessionId}`;
    const session = JSON.parse(blobs.get(sessionKey));
    assert.equal(session.email, ADMIN_EMAIL);
    assert.equal(session.resource, ADMIN_RESOURCE);
    assert.ok(session.expiresAt > Date.now());
    assert.match(cookies.find((value) => value.startsWith(`${ADMIN_SESSION_COOKIE}=`)), /HttpOnly; Secure; SameSite=Strict/);
    assert.ok(cookies.some((value) => value.startsWith(`${ADMIN_CHALLENGE_COOKIE}=`) && value.includes('Max-Age=0')));

    const statusResponse = await adminSession(netlifyRequest(
      'GET',
      { cookie: `${ADMIN_SESSION_COOKIE}=${sessionId}` }
    ));
    assert.equal((await statusResponse.json()).authenticated, true);

    const csrfResponse = await logoutAdmin(netlifyRequest(
      'POST',
      {
        origin: 'https://attacker.example',
        cookie: `${ADMIN_SESSION_COOKIE}=${sessionId}`
      },
      '{}'
    ));
    assert.equal(csrfResponse.status, 403);
    assert.equal(blobs.has(sessionKey), true);

    const logoutResponse = await logoutAdmin(netlifyRequest(
      'POST',
      { cookie: `${ADMIN_SESSION_COOKIE}=${sessionId}` },
      '{}'
    ));
    assert.equal(logoutResponse.status, 200);
    assert.equal(blobs.has(sessionKey), false);
    assert.ok(responseCookies(logoutResponse).some((value) =>
      value.startsWith(`${ADMIN_SESSION_COOKIE}=`) && value.includes('Max-Age=0')
    ));

    const revokedStatus = await adminSession(netlifyRequest(
      'GET',
      { cookie: `${ADMIN_SESSION_COOKIE}=${sessionId}` }
    ));
    assert.equal((await revokedStatus.json()).authenticated, false);
  });
});

test('Admin session endpoint rejects expired sessions and removes them from Blobs', async () => {
  await withMockBlobs(async ({ blobs }) => {
    const sessionId = 'c0d04f42-8d94-4a56-94df-7d7e3fd45852';
    const key = `${SITE_ID}/${STORE_NAME}/admin:session:${sessionId}`;
    blobs.set(key, JSON.stringify({
      email: ADMIN_EMAIL,
      resource: ADMIN_RESOURCE,
      createdAt: Date.now() - ADMIN_SESSION_LIFETIME_SECONDS * 1000,
      expiresAt: Date.now() - 1
    }));

    const result = await adminSession(netlifyRequest(
      'GET',
      { cookie: `${ADMIN_SESSION_COOKIE}=${sessionId}` }
    ));

    assert.equal(result.status, 200);
    assert.equal((await result.json()).authenticated, false);
    assert.equal(blobs.has(key), false);
  });
});

test('unauthorized email receives the generic response without generating or sending an OTP', async () => {
  await withMockBlobs(async ({ requests }) => {
    let sendCount = 0;
    const requestAdminCode = adaptNetlifyHandler(createRequestAdminCodeHandler(async () => {
      sendCount += 1;
      return true;
    }));
    const result = await requestAdminCode(netlifyRequest(
      'POST',
      {},
      JSON.stringify({ email: 'not-authorized@example.com' })
    ));

    assert.equal(result.status, 202);
    assert.match(await result.text(), /If this address is authorized/);
    assert.equal(sendCount, 0);
    assert.equal(requests.length, 0);
  });
});

test('invalid and expired OTP challenges are rejected', async () => {
  await withMockBlobs(async ({ blobs }) => {
    const now = Date.now();
    const activeKey = `${SITE_ID}/${STORE_NAME}/admin:active-challenge:${hashValue(ADMIN_EMAIL)}`;
    const invalidChallengeId = 'c0d04f42-8d94-4a56-94df-7d7e3fd45852';
    const invalidChallengeKey = `${SITE_ID}/${STORE_NAME}/admin:challenge:${invalidChallengeId}`;
    blobs.set(invalidChallengeKey, JSON.stringify({
      email: ADMIN_EMAIL,
      resource: ADMIN_RESOURCE,
      codeHash: hashOtp(invalidChallengeId, '123456'),
      attempts: 0,
      createdAt: now,
      expiresAt: now + 60_000
    }));
    blobs.set(activeKey, invalidChallengeId);

    const invalidResult = await verifyAdminCode(netlifyRequest(
      'POST',
      { cookie: `${ADMIN_CHALLENGE_COOKIE}=${invalidChallengeId}` },
      JSON.stringify({ code: '654321' })
    ));
    assert.equal(invalidResult.status, 401);
    assert.equal(JSON.parse(blobs.get(invalidChallengeKey)).attempts, 1);

    const expiredChallengeId = 'b7f51c7a-18da-4a3e-b353-05822c094c61';
    const expiredChallengeKey = `${SITE_ID}/${STORE_NAME}/admin:challenge:${expiredChallengeId}`;
    blobs.set(expiredChallengeKey, JSON.stringify({
      email: ADMIN_EMAIL,
      resource: ADMIN_RESOURCE,
      codeHash: hashOtp(expiredChallengeId, '123456'),
      attempts: 0,
      createdAt: now - 11 * 60_000,
      expiresAt: now - 1
    }));
    blobs.set(activeKey, expiredChallengeId);

    const expiredResult = await verifyAdminCode(netlifyRequest(
      'POST',
      { cookie: `${ADMIN_CHALLENGE_COOKIE}=${expiredChallengeId}` },
      JSON.stringify({ code: '123456' })
    ));
    assert.equal(expiredResult.status, 401);
    assert.equal(blobs.has(expiredChallengeKey), false);
  });
});

test('contact routing Admin endpoint uses the modern runtime Blobs context before authorization checks', async () => {
  await withMockBlobs(async ({ requests }) => {
    const sessionId = 'c0d04f42-8d94-4a56-94df-7d7e3fd45852';
    const result = await contactRoutingAdmin(netlifyRequest(
      'GET',
      { cookie: `${ADMIN_SESSION_COOKIE}=${sessionId}` }
    ));

    assert.equal(result.status, 401);
    assert.ok(requests.some((request) => request.url.includes('prime-line-admin-auth')));
    assert.ok(requests
      .filter((request) => new URL(request.url).hostname === 'blobs.test')
      .every((request) => request.hasAuthorization));
  });
});
