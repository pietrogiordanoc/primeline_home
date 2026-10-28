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
import { createRequestAdminCodeHandler } from '../functions/request-admin-code.js';
import { handler as verifyAdminCode } from '../functions/verify-admin-code.js';
import { handler as adminSession } from '../functions/admin-session.js';
import { handler as logoutAdmin } from '../functions/logout-admin.js';

const STORE_NAME = 'site:prime-line-admin-auth';
const SITE_ID = 'mock-site';
const ORIGIN_HEADERS = {
  origin: 'https://primelinedist.com',
  host: 'primelinedist.com'
};

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
    requests.push({ url: url.toString(), method, authorization: headers.get('authorization') });

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

const requestCodeEvent = () => ({
  httpMethod: 'POST',
  headers: ORIGIN_HEADERS,
  body: JSON.stringify({ email: ADMIN_EMAIL }),
  isBase64Encoded: false
});

test('Admin OTP generation, rate limiting, verification, session and logout use runtime Blobs credentials', async () => {
  await withMockBlobs(async ({ blobs, requests }) => {
    const sentCodes = [];
    const requestAdminCode = createRequestAdminCodeHandler(async (code) => {
      sentCodes.push(code);
      return true;
    });

    const requestResponses = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      requestResponses.push(await requestAdminCode(requestCodeEvent()));
    }

    assert.ok(requestResponses.every((result) => result.statusCode === 202));
    assert.equal(sentCodes.length, 3);
    assert.ok(sentCodes.every((code) => /^\d{6}$/.test(code)));
    assert.ok(requests.some((request) => request.authorization === 'Bearer mock-runtime-token'));

    const challengeId = cookieValue(
      requestResponses[2].multiValueHeaders['Set-Cookie'],
      ADMIN_CHALLENGE_COOKIE
    );
    const verifyResponse = await verifyAdminCode({
      httpMethod: 'POST',
      headers: {
        ...ORIGIN_HEADERS,
        cookie: `${ADMIN_CHALLENGE_COOKIE}=${challengeId}`
      },
      body: JSON.stringify({ code: sentCodes[2] }),
      isBase64Encoded: false
    });

    assert.equal(verifyResponse.statusCode, 200);
    assert.equal(JSON.parse(verifyResponse.body).authenticated, true);
    const cookies = verifyResponse.multiValueHeaders['Set-Cookie'];
    const sessionId = cookieValue(cookies, ADMIN_SESSION_COOKIE);
    const sessionKey = `${SITE_ID}/${STORE_NAME}/admin:session:${sessionId}`;
    const session = JSON.parse(blobs.get(sessionKey));
    assert.equal(session.email, ADMIN_EMAIL);
    assert.equal(session.resource, ADMIN_RESOURCE);
    assert.ok(session.expiresAt > Date.now());
    assert.match(cookies.find((value) => value.startsWith(`${ADMIN_SESSION_COOKIE}=`)), /HttpOnly; Secure; SameSite=Strict/);
    assert.ok(cookies.some((value) => value.startsWith(`${ADMIN_CHALLENGE_COOKIE}=`) && value.includes('Max-Age=0')));

    const statusResponse = await adminSession({
      httpMethod: 'GET',
      headers: { cookie: `${ADMIN_SESSION_COOKIE}=${sessionId}` }
    });
    assert.equal(JSON.parse(statusResponse.body).authenticated, true);

    const csrfResponse = await logoutAdmin({
      httpMethod: 'POST',
      headers: {
        origin: 'https://attacker.example',
        host: 'primelinedist.com',
        cookie: `${ADMIN_SESSION_COOKIE}=${sessionId}`
      },
      body: '{}'
    });
    assert.equal(csrfResponse.statusCode, 403);
    assert.equal(blobs.has(sessionKey), true);

    const logoutResponse = await logoutAdmin({
      httpMethod: 'POST',
      headers: { ...ORIGIN_HEADERS, cookie: `${ADMIN_SESSION_COOKIE}=${sessionId}` },
      body: '{}'
    });
    assert.equal(logoutResponse.statusCode, 200);
    assert.equal(blobs.has(sessionKey), false);
    assert.ok(logoutResponse.multiValueHeaders['Set-Cookie'].some((value) =>
      value.startsWith(`${ADMIN_SESSION_COOKIE}=`) && value.includes('Max-Age=0')
    ));

    const revokedStatus = await adminSession({
      httpMethod: 'GET',
      headers: { cookie: `${ADMIN_SESSION_COOKIE}=${sessionId}` }
    });
    assert.equal(JSON.parse(revokedStatus.body).authenticated, false);
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

    const result = await adminSession({
      httpMethod: 'GET',
      headers: { cookie: `${ADMIN_SESSION_COOKIE}=${sessionId}` }
    });

    assert.equal(result.statusCode, 200);
    assert.equal(JSON.parse(result.body).authenticated, false);
    assert.equal(blobs.has(key), false);
  });
});

test('unauthorized email receives the generic response without generating or sending an OTP', async () => {
  await withMockBlobs(async ({ requests }) => {
    let sendCount = 0;
    const requestAdminCode = createRequestAdminCodeHandler(async () => {
      sendCount += 1;
      return true;
    });
    const result = await requestAdminCode({
      ...requestCodeEvent(),
      body: JSON.stringify({ email: 'not-authorized@example.com' })
    });

    assert.equal(result.statusCode, 202);
    assert.match(result.body, /If this address is authorized/);
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

    const invalidResult = await verifyAdminCode({
      httpMethod: 'POST',
      headers: {
        ...ORIGIN_HEADERS,
        cookie: `${ADMIN_CHALLENGE_COOKIE}=${invalidChallengeId}`
      },
      body: JSON.stringify({ code: '654321' })
    });
    assert.equal(invalidResult.statusCode, 401);
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

    const expiredResult = await verifyAdminCode({
      httpMethod: 'POST',
      headers: {
        ...ORIGIN_HEADERS,
        cookie: `${ADMIN_CHALLENGE_COOKIE}=${expiredChallengeId}`
      },
      body: JSON.stringify({ code: '123456' })
    });
    assert.equal(expiredResult.statusCode, 401);
    assert.equal(blobs.has(expiredChallengeKey), false);
  });
});
