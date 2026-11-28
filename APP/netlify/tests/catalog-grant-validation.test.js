import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { createValidateCatalogGrantsHandler } from '../functions/validate-catalog-grants.js';

const secret = 'a-test-secret-at-least-32-bytes-long';
const now = Date.UTC(2026, 10, 27);
const email = 'buyer@example.com';
const seller = 'sales@primelinedist.com';
const customerId = randomUUID();
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const sign = (claims, key = secret, header = { alg: 'HS256', typ: 'JWT' }) => {
  const input = `${encode(header)}.${encode(claims)}`;
  return `${input}.${createHmac('sha256', key).update(input).digest('base64url')}`;
};
const candidate = (id = randomUUID(), customerEmail = email, invitingStaffEmail = seller) =>
  ({ pdfGrantId: id, customerEmail, invitingStaffEmail });
const claims = (grants, overrides = {}) => ({
  iss: 'https://catalog.primelinedist.com',
  aud: 'https://primelinedist.com/.netlify/functions/validate-catalog-grants',
  source: 'web_pdf_grant_validation_request',
  sub: customerId,
  customerEmail: email,
  grants,
  iat: now / 1000,
  exp: now / 1000 + 30,
  jti: randomUUID(),
  ...overrides
});
const event = credential => ({ httpMethod: 'POST', body: JSON.stringify({ credential }) });
const body = response => JSON.parse(response.body);
const fixture = () => {
  const used = new Map();
  const data = new Map();
  return {
    used, data,
    deps: {
      now: () => now,
      getSigningSecret: () => secret,
      getClaimStore: async () => ({
        async setJSON(key, value, options) {
          assert.equal(options.onlyIfNew, true);
          if (used.has(key)) return { modified: false };
          used.set(key, value);
          return { modified: true };
        }
      }),
      getGrantStore: async () => ({
        async get(key) { return data.get(key) || null; }
      })
    }
  };
};
const grantFor = (linked, overrides = {}) => ({
  id: linked.pdfGrantId, email: linked.customerEmail, sharedBy: linked.invitingStaffEmail,
  status: 'active', revokedAt: null, expiresAt: now + 3600000, ...overrides
});
const decodeVerified = token => {
  const [header, payload, signature] = token.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url')), { alg: 'HS256', typ: 'JWT' });
  assert.equal(signature, createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url'));
  return JSON.parse(Buffer.from(payload, 'base64url'));
};

test('returns only exact current grants with signed identities and expiration', async () => {
  const f = fixture();
  const linked = Array.from({ length: 10 }, () => candidate());
  const changes = [
    {}, { expiresAt: now + 7200000 }, { status: 'revoked' }, { revokedAt: now - 1 },
    { status: 'deleted' }, { status: 'pending' }, { expiresAt: now },
    { email: 'other@example.com' }, { sharedBy: 'other@primelinedist.com' }, { id: randomUUID() }
  ];
  linked.forEach((item, index) => f.data.set(`grant:${item.pdfGrantId}`, grantFor(item, changes[index])));
  linked.push(candidate());
  const request = claims(linked);
  const response = await createValidateCatalogGrantsHandler(f.deps)(event(sign(request)));
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['Cache-Control'], 'no-store');
  const result = decodeVerified(body(response).credential);
  assert.equal(result.iss, 'https://primelinedist.com');
  assert.equal(result.aud, 'https://catalog.primelinedist.com');
  assert.equal(result.source, 'home_pdf_grant_validation');
  assert.equal(result.sub, customerId);
  assert.equal(result.customerEmail, email);
  assert.equal(result.requestJti, request.jti);
  assert.match(result.jti, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(result.exp - result.iat, 60);
  assert.deepEqual(result.grants, linked.slice(0, 2).map((item, index) => ({
    ...item, status: 'active', revokedAt: null, expiresAt: now / 1000 + (index + 1) * 3600
  })));
});

test('rejects invalid signatures, claims, identities and duplicate grant IDs before lookup', async () => {
  const f = fixture();
  const item = candidate();
  const base = claims([item]);
  const variants = [
    sign(base, 'wrong-secret'),
    sign({ ...base, iss: 'https://other.example' }),
    sign({ ...base, aud: 'https://other.example' }),
    sign({ ...base, source: 'web_catalog_mode' }),
    sign({ ...base, sub: 'not-a-customer-id' }),
    sign({ ...base, jti: 'not-a-uuid' }),
    sign({ ...base, iat: now / 1000 - 31, exp: now / 1000 - 1 }),
    sign({ ...base, exp: now / 1000 + 31 }),
    sign({ ...base, iat: now / 1000 + 31, exp: now / 1000 + 61 }),
    sign({ ...base, customerEmail: 'Buyer@example.com' }),
    sign({ ...base, grants: [candidate(item.pdfGrantId, 'other@example.com')] }),
    sign({ ...base, grants: [candidate(item.pdfGrantId, email, 'other@example.com')] }),
    sign({ ...base, grants: [item, item] }),
    sign({ ...base, grants: [candidate('not-a-grant')] }),
    sign({ ...base, grants: [] }),
    sign(base, secret, { alg: 'HS256', typ: 'JWT', crit: ['b64'] }),
    'malformed'
  ];
  for (const token of variants) {
    const response = await createValidateCatalogGrantsHandler(f.deps)(event(token));
    assert.equal(response.statusCode, 401);
    assert.equal(body(response).code, 'invalid_or_expired_validation_request');
  }
  assert.equal(f.used.size, 0);
});

test('atomically rejects concurrent replay and never selects other grants by email', async () => {
  const f = fixture();
  const missing = candidate();
  const other = candidate();
  f.data.set(`grant:${other.pdfGrantId}`, grantFor(other));
  const request = event(sign(claims([missing])));
  const responses = await Promise.all(Array.from({ length: 12 }, () => createValidateCatalogGrantsHandler(f.deps)(request)));
  assert.equal(responses.filter(response => response.statusCode === 200).length, 1);
  assert.equal(responses.filter(response => response.statusCode === 401).length, 11);
  assert.deepEqual(decodeVerified(body(responses.find(response => response.statusCode === 200)).credential).grants, []);
});

test('returns active permanent and temporary grants without reviving revoked or malformed grants', async () => {
  const f = fixture();
  const [permanent, temporary, revoked, malformed] = Array.from({ length: 4 }, () => candidate());
  f.data.set(`grant:${permanent.pdfGrantId}`, grantFor(permanent, { expiresAt: null }));
  f.data.set(`grant:${temporary.pdfGrantId}`, grantFor(temporary));
  f.data.set(`grant:${revoked.pdfGrantId}`, grantFor(revoked, { expiresAt: null, revokedAt: now - 1 }));
  f.data.set(`grant:${malformed.pdfGrantId}`, grantFor(malformed, { expiresAt: undefined }));
  const response = await createValidateCatalogGrantsHandler(f.deps)(
    event(sign(claims([permanent, temporary, revoked, malformed])))
  );
  assert.equal(response.statusCode, 200);
  assert.deepEqual(decodeVerified(body(response).credential).grants, [
    { ...permanent, status: 'active', revokedAt: null, expiresAt: null },
    { ...temporary, status: 'active', revokedAt: null, expiresAt: now / 1000 + 3600 }
  ]);
});

test('fails closed on store errors and requests expiring during lookup', async () => {
  const item = candidate();
  const f = fixture();
  const handler = createValidateCatalogGrantsHandler({
    ...f.deps, getGrantStore: async () => { throw new Error('offline'); }
  });
  assert.equal((await handler(event(sign(claims([item]))))).statusCode, 503);
  let time = now;
  const slow = createValidateCatalogGrantsHandler({
    ...f.deps, now: () => time,
    getGrantStore: async () => ({ get: async () => { time += 30000; return grantFor(item); } })
  });
  assert.equal((await slow(event(sign(claims([item]))))).statusCode, 401);
});

test('rejects malformed requests and unavailable signing configuration', async () => {
  const f = fixture();
  const handler = createValidateCatalogGrantsHandler(f.deps);
  assert.equal((await handler({ httpMethod: 'GET' })).statusCode, 405);
  assert.equal((await handler({ httpMethod: 'POST', body: '{' })).statusCode, 400);
  assert.equal((await handler(event(null))).statusCode, 400);
  const unavailable = createValidateCatalogGrantsHandler({ ...f.deps, getSigningSecret: () => '' });
  assert.equal((await unavailable(event(sign(claims([candidate()]))))).statusCode, 503);
});
