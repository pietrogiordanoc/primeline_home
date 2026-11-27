import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createCatalogWebTransferHandler, verifyTransferCredential } from '../functions/catalog-web-transfer.js';
import { cleanupTransferClaims } from '../functions/catalog-web-transfer-cleanup.js';
import { createCatalogSessionHandler } from '../functions/catalog-session.js';
import { createCatalogStaffDownloadHandler } from '../functions/catalog-staff-download.js';
import { createCatalogStaffShareHandler } from '../functions/catalog-staff-share.js';
import {
  GUEST_DEVICE_COOKIE, GUEST_SESSION_COOKIE, getEmployeeCatalogSession, hashDeviceId
} from '../shared/catalog-guest-access.js';
import { verifyTransferredStaffSession, verifyWebStaff } from '../shared/catalog-web-staff.js';

const secret = 'a-test-secret-at-least-32-bytes-long';
const now = Date.UTC(2026, 10, 25);
const authUserId = 'c0a80123-4567-4abc-8def-0123456789ab';
const deviceId = 'c0a80123-4567-4abc-8def-0123456789ac';
const email = 'buyer@example.com';
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const sign = (claims, key = secret) => {
  const head = encode({ alg: 'HS256', typ: 'JWT' });
  const body = encode(claims);
  return `${head}.${body}.${createHmac('sha256', key).update(`${head}.${body}`).digest('base64url')}`;
};
const makeClaims = (overrides = {}) => ({
  iss: 'https://catalog.primelinedist.com',
  aud: 'https://primelinedist.com/.netlify/functions/catalog-web-transfer',
  source: 'web_catalog_mode',
  sub: authUserId,
  email,
  userType: 'customer',
  customerId: 'customer-id',
  iat: now / 1000,
  exp: now / 1000 + 120,
  jti: randomUUID(),
  ...overrides
});
const event = (credential, cookie = '') => ({
  httpMethod: 'POST',
  body: JSON.stringify({ credential }),
  headers: { host: 'primelinedist.com', origin: 'https://primelinedist.com', cookie }
});
const store = () => {
  const data = new Map();
  return {
    data,
    async get(key) { return data.has(key) ? structuredClone(data.get(key)) : null; },
    async setJSON(key, value, options = {}) {
      if (options.onlyIfNew && data.has(key)) return { modified: false };
      data.set(key, structuredClone(value));
      return { modified: true };
    },
    async delete(key) { data.delete(key); },
    async *list({ prefix = '' } = {}) {
      yield { blobs: [...data.keys()].filter(key => key.startsWith(prefix)).map(key => ({ key })) };
    }
  };
};
const fixture = () => {
  const claims = store();
  const grants = store();
  const sessions = store();
  const employees = store();
  const grant = {
    id: 'grant-1', email, status: 'active', expiresAt: now + 3600000,
    deviceHashes: ['legacy-device-1', 'legacy-device-2', 'legacy-device-3']
  };
  grants.data.set('grant:grant-1', grant);
  return {
    claims, grants, sessions, employees, grant,
    deps: {
      now: () => now,
      getSigningSecret: () => secret,
      getClaimStore: async () => claims,
      getGrantStore: async () => grants,
      getGuestSessionStore: async () => sessions,
      getEmployeeStore: async () => employees,
      getEmployeeSession: async () => null,
      verifyStaff: async () => true
    }
  };
};
const deviceCookie = `${GUEST_DEVICE_COOKIE}=${deviceId}`;
const parse = response => JSON.parse(response.body);

test('returning customer without a valid guest session must reopen an invitation', async () => {
  const f = fixture();
  const response = await createCatalogWebTransferHandler(f.deps)(event(sign(makeClaims()), deviceCookie));
  assert.equal(response.statusCode, 403);
  assert.equal(parse(response).code, 'invitation_required');
  assert.equal(f.sessions.data.size, 0);
  assert.deepEqual(await f.grants.get('grant:grant-1'), f.grant);
});

test('Web transfer cannot switch grants when a previous session is invalid, expired or revoked', async () => {
  for (const state of ['invalid', 'expired', 'revoked', 'other-customer']) {
    const f = fixture();
    const sessionId = randomUUID();
    const previousGrant = { ...f.grant, id: 'previous', sharedBy: 'previous@primelinedist.com' };
    if (state === 'revoked') previousGrant.revokedAt = now - 1;
    if (state === 'other-customer') previousGrant.email = 'other@example.com';
    await f.grants.setJSON('grant:previous', previousGrant);
    if (state !== 'invalid') {
      await f.sessions.setJSON(`session:${sessionId}`, {
        resource: 'catalog-guest', email: previousGrant.email, grantId: previousGrant.id,
        deviceHash: hashDeviceId(deviceId), expiresAt: state === 'expired' ? now - 1 : now + 60000
      });
    }
    const response = await createCatalogWebTransferHandler(f.deps)(
      event(sign(makeClaims()), `${deviceCookie}; ${GUEST_SESSION_COOKIE}=${sessionId}`)
    );
    assert.equal(response.statusCode, 403, state);
    assert.equal(parse(response).code, 'invitation_required');
    assert.equal(f.sessions.data.size, state === 'invalid' || state === 'expired' ? 0 : 1);
  }
});

test('preserves an existing matching guest session and rejects replay concurrently', async () => {
  const f = fixture();
  const sessionId = randomUUID();
  await f.sessions.setJSON(`session:${sessionId}`, {
    resource: 'catalog-guest', email, grantId: f.grant.id,
    deviceHash: hashDeviceId(deviceId), expiresAt: now + 60000
  });
  const request = event(sign(makeClaims()), `${deviceCookie}; ${GUEST_SESSION_COOKIE}=${sessionId}`);
  const responses = await Promise.all(Array.from({ length: 20 }, () => createCatalogWebTransferHandler(f.deps)(request)));
  assert.equal(responses.filter(response => response.statusCode === 200).length, 1);
  assert.equal(responses.filter(response => response.statusCode === 409).length, 19);
  assert.equal(responses.find(response => response.statusCode === 200).multiValueHeaders, undefined);
  assert.equal(f.sessions.data.size, 1);
});

test('rejects invalid signatures, expired or malformed claims, and unavailable signing', async () => {
  const f = fixture();
  for (const token of [
    sign(makeClaims(), 'wrong-secret'),
    sign(makeClaims({ exp: now / 1000 })),
    sign(makeClaims({ exp: now / 1000 + 121 })),
    sign(makeClaims({ aud: 'https://other.example' })),
    sign(makeClaims({ source: 'pdf_catalog_share' })),
    sign(makeClaims({ jti: 'not-a-uuid' }))
  ]) {
    assert.equal((await createCatalogWebTransferHandler(f.deps)(event(token, deviceCookie))).statusCode, 401);
  }
  assert.equal(f.claims.data.size, 0);
  assert.equal((await createCatalogWebTransferHandler({ ...f.deps, getSigningSecret: () => '' })(
    event(sign(makeClaims()), deviceCookie)
  )).statusCode, 503);
});

test('customer needs an active matching guest session rather than only a device cookie', async () => {
  for (const change of ['missing', 'revoked', 'expired', 'other-email', 'new-device']) {
    const f = fixture();
    if (change === 'missing') f.grants.data.clear();
    if (change === 'revoked') f.grant.revokedAt = now - 1;
    if (change === 'expired') f.grant.expiresAt = now - 1;
    if (change === 'other-email') f.grant.email = 'other@example.com';
    const cookie = change === 'new-device' ? '' : deviceCookie;
    const response = await createCatalogWebTransferHandler(f.deps)(event(sign(makeClaims()), cookie));
    assert.equal(response.statusCode, 403, change);
    assert.equal(parse(response).code, 'invitation_required');
    assert.equal(f.sessions.data.size, 0);
  }
});

test('staff transfer validates identity and creates a tagged HttpOnly session', async () => {
  const f = fixture();
  const staffClaims = makeClaims({
    email: 'staff@primelinedist.com', userType: 'staff', staffId: 'staff-id', staffRole: 'SuperAdmin'
  });
  delete staffClaims.customerId;
  let identity;
  const response = await createCatalogWebTransferHandler({
    ...f.deps, verifyStaff: async value => { identity = value; return true; }
  })(event(sign(staffClaims)));
  assert.equal(response.statusCode, 200);
  assert.deepEqual(identity, { email: staffClaims.email, authUserId, staffId: 'staff-id' });
  const cookie = response.multiValueHeaders['Set-Cookie'][0];
  assert.match(cookie, /HttpOnly; Secure; SameSite=Lax/);
  const id = cookie.split('=')[1].split(';')[0];
  const saved = await f.employees.get(`session:${id}`);
  assert.equal(saved.source, 'web_catalog_mode');
  assert.equal(saved.staffId, 'staff-id');
  assert.equal(saved.authUserId, authUserId);
  assert.equal(saved.staffRole, undefined);

  const denied = await createCatalogWebTransferHandler({ ...f.deps, verifyStaff: async () => false })(
    event(sign({ ...staffClaims, jti: randomUUID() }))
  );
  assert.equal(denied.statusCode, 403);
  assert.equal(f.employees.data.size, 1);
});

test('Supabase verification binds live auth identity, employee record and active status', async () => {
  const oldUrl = process.env.WEB_CATALOG_SUPABASE_URL;
  const oldKey = process.env.WEB_CATALOG_SUPABASE_SERVICE_ROLE_KEY;
  process.env.WEB_CATALOG_SUPABASE_URL = 'https://example.invalid';
  process.env.WEB_CATALOG_SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  try {
    const identity = { email: 'staff@primelinedist.com', authUserId, staffId: 'staff-id' };
    let user = { id: authUserId, email: identity.email };
    let staff = { id: 'staff-id', auth_user_id: authUserId, email: identity.email, status: 'Active' };
    const create = () => ({
      auth: { admin: { getUserById: async () => ({ data: { user }, error: null }) } },
      from: () => ({
        select() { return this; },
        eq(field, value) { assert.equal(staff[field], value); return this; },
        async maybeSingle() { return { data: staff, error: null }; }
      })
    });
    assert.equal(await verifyWebStaff(identity, create), true);
    staff.status = 'Inactive';
    assert.equal(await verifyWebStaff(identity, create), false);
    staff.status = 'Active';
    user = { ...user, email: 'other@primelinedist.com' };
    assert.equal(await verifyWebStaff(identity, create), false);
    user = null;
    assert.equal(await verifyWebStaff(identity, create), false);
  } finally {
    if (oldUrl === undefined) delete process.env.WEB_CATALOG_SUPABASE_URL;
    else process.env.WEB_CATALOG_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.WEB_CATALOG_SUPABASE_SERVICE_ROLE_KEY;
    else process.env.WEB_CATALOG_SUPABASE_SERVICE_ROLE_KEY = oldKey;
  }
});

test('transferred staff sessions revalidate in viewer, download and sharing; OTP sessions remain unchanged', async () => {
  const f = fixture();
  const id = randomUUID();
  const session = {
    email: 'staff@primelinedist.com', resource: 'catalog-pdf', source: 'web_catalog_mode',
    authUserId, staffId: 'staff-id', expiresAt: now + 60000
  };
  await f.employees.setJSON(`session:${id}`, session);
  const request = { httpMethod: 'GET', headers: { cookie: `access_session=${id}` } };
  let active = true;
  const verify = value => verifyTransferredStaffSession(value, async () => active);
  const viewer = createCatalogSessionHandler({
    getAccessStore: async () => f.employees, now: () => now, verifyTransferredStaffSession: verify
  });
  const getEmployeeSession = e => getEmployeeCatalogSession(e, async () => f.employees, now, verify);
  const download = createCatalogStaffDownloadHandler({ getEmployeeSession });
  const share = createCatalogStaffShareHandler({ getEmployeeSession, getEmployeeProfile: async () => ({ email: session.email }) });
  assert.equal((await viewer(request)).statusCode, 200);
  assert.equal((await download(request)).statusCode, 302);
  assert.equal((await share(request)).statusCode, 200);
  active = false;
  assert.equal((await viewer(request)).statusCode, 401);
  assert.equal((await download(request)).statusCode, 401);
  assert.equal((await share(request)).statusCode, 401);
  await f.employees.setJSON(`session:${id}`, { ...session, source: undefined });
  assert.equal((await viewer(request)).statusCode, 200);
  assert.equal((await download(request)).statusCode, 302);
});

test('cleanup retains claims until safely past expiration', async () => {
  const claims = store();
  await claims.setJSON('claim:old', { expiresAt: now - 120001 });
  await claims.setJSON('claim:recent', { expiresAt: now - 119999 });
  await claims.setJSON('claim:future', { expiresAt: now + 120000 });
  await cleanupTransferClaims(claims, now);
  assert.equal(await claims.get('claim:old'), null);
  assert.ok(await claims.get('claim:recent'));
  assert.ok(await claims.get('claim:future'));
});

test('Netlify SDK conditional create rejects conflicts and server errors', async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  try {
    const { getStore } = await import('@netlify/blobs');
    for (const status of [200, 409, 412, 403, 503]) {
      let conditionalHeader;
      const actual = getStore({
        name: 'transfer-test', siteID: 'test', token: 'test',
        edgeURL: 'https://example.invalid',
        fetch: async (_url, options) => {
          conditionalHeader = options.headers['if-none-match'];
          return new Response(null, { status, headers: { etag: '"test"' } });
        }
      });
      if (status >= 400 && status !== 409 && status !== 412) {
        await assert.rejects(actual.setJSON('claim:test', {}, { onlyIfNew: true }));
      } else {
        const result = await actual.setJSON('claim:test', {}, { onlyIfNew: true });
        assert.equal(result.modified, status === 200);
      }
      assert.equal(conditionalHeader, '*');
    }
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test('transfer is denied if guest session validation outlasts the credential', async () => {
  const f = fixture();
  let time = now;
  const response = await createCatalogWebTransferHandler({
    ...f.deps,
    now: () => time,
    validateGuestSession: async () => {
      time += 120000;
      return { session: { deviceHash: hashDeviceId(deviceId) }, grant: f.grant };
    }
  })(event(sign(makeClaims()), deviceCookie));
  assert.equal(response.statusCode, 401);
  assert.equal(response.multiValueHeaders, undefined);
});

test('fragment is removed before the exchange and is never placed in the request URL', async () => {
  const html = readFileSync(new URL('../../catalog-pdf/index.html', import.meta.url), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const calls = [];
  const context = {
    URLSearchParams, Promise,
    location: { hash: '#web_transfer=abc.def.ghi', pathname: '/catalog-pdf/', search: '' },
    history: { replaceState: (...args) => calls.push(['replace', ...args]) },
    fetch: async (url, options) => {
      calls.push(['fetch', url, JSON.parse(options.body)]);
      return { ok: true, status: 200, json: async () => ({ resource: 'catalog-guest' }) };
    },
    window: {}
  };
  runInNewContext(script, context);
  assert.equal(calls[0][0], 'replace');
  assert.equal(calls[0][3], '/catalog-pdf/');
  assert.equal(calls[1][1], '/.netlify/functions/catalog-web-transfer');
  assert.equal(calls[1][2].credential, 'abc.def.ghi');
  assert.equal((await context.window.catalogWebTransfer).data.resource, 'catalog-guest');
});
