import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import {
  CATALOG_PUBLIC_URL,
  GUEST_DEVICE_COOKIE,
  GUEST_SESSION_LIFETIME_SECONDS,
  GUEST_INVITATION_LIFETIME_MS,
  claimGuestToken,
  createGuestSession,
  getGrantExpiresAt,
  hashEmail,
  hashDeviceId,
  hashToken,
  saveEmployeeProfile,
  sendGuestEmailWithResult,
  sendCatalogInvitationEmail,
  sendCatalogShareNotification,
  updateGuestGrant
} from '../shared/catalog-guest-access.js';
import { ADMIN_EMAIL } from '../shared/admin-auth.js';
import { createCatalogGuestAdminHandler } from '../functions/catalog-guest-admin.js';
import { createCatalogGuestRedeemHandler } from '../functions/catalog-guest-redeem.js';
import { createCatalogGuestRequestLinkHandler } from '../functions/catalog-guest-request-link.js';
import { createCatalogGuestSessionHandler } from '../functions/catalog-guest-session.js';
import { createCatalogGuestPdfHandler } from '../functions/catalog-guest-pdf.js';
import { createCatalogGuestTransferHandler } from '../functions/catalog-guest-transfer.js';
import { createCatalogStaffDownloadHandler } from '../functions/catalog-staff-download.js';
import { createCatalogStaffShareHandler } from '../functions/catalog-staff-share.js';

const createStore = () => {
  const data = new Map();
  const etag = (key) => createHash('sha256').update(data.get(key)).digest('hex');
  return {
    data,
    async get(key, options = {}) {
      if (!data.has(key)) return null;
      const value = data.get(key);
      return options.type === 'json' ? JSON.parse(value) : value;
    },
    async set(key, value) {
      data.set(key, String(value));
    },
    async getWithMetadata(key) {
      return data.has(key) ? { data: JSON.parse(data.get(key)), etag: etag(key) } : null;
    },
    async setJSON(key, value, options = {}) {
      if (options.onlyIfNew && data.has(key)) return { modified: false };
      if (options.onlyIfMatch && (!data.has(key) || etag(key) !== options.onlyIfMatch)) return { modified: false };
      data.set(key, JSON.stringify(value));
      return { modified: true, etag: etag(key) };
    },
    async delete(key) {
      data.delete(key);
    },
    async list({ prefix = '' } = {}) {
      return { blobs: [...data.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })) };
    }
  };
};

const makeEvent = (method, body, cookie = '') => ({
  httpMethod: method,
  body: body === undefined ? undefined : JSON.stringify(body),
  headers: {
    host: 'primelinedist.com',
    origin: 'https://primelinedist.com',
    'x-forwarded-proto': 'https',
    ...((cookie || (body?.purpose ? `${GUEST_DEVICE_COOKIE}=11111111-1111-4111-8111-111111111119` : ''))
      ? { cookie: cookie || `${GUEST_DEVICE_COOKIE}=11111111-1111-4111-8111-111111111119` } : {})
  }
});

const responseBody = (response) => JSON.parse(response.body);
const resetPayload = (grantId, sendLink = false, operationId = randomUUID()) =>
  ({ action: 'reset-devices', grantId, confirmed: true, operationId, sendLink });
const emailToken = (email, key) => {
  const token = email.text.match(new RegExp(`#${key}=([A-Za-z0-9_-]{43})`))?.[1];
  assert.ok(token, `Expected a ${key} token in the mocked email`);
  return token;
};

const fixture = (start = Date.UTC(2026, 0, 31, 13, 15)) => {
  let timestamp = start;
  const stores = {
    invitations: createStore(),
    grants: createStore(),
    sessions: createStore(),
    verifications: createStore(),
    claims: createStore(),
    admin: createStore(),
    profiles: createStore()
  };
  const emails = [];
  const notifications = [];
  const dependencies = {
    getInvitationStore: async () => stores.invitations,
    getGrantStore: async () => stores.grants,
    getGuestSessionStore: async () => stores.sessions,
    getVerificationStore: async () => stores.verifications,
    getClaimStore: async () => stores.claims,
    getAdminRateStore: async () => stores.admin,
    getEmployeeProfileStore: async () => stores.profiles,
    getEmployeeSession: async () => ({
      email: 'sales@primelinedist.com',
      resource: 'catalog-pdf',
      expiresAt: timestamp + 60_000
    }),
    claimToken: (hash) => claimGuestToken(hash, async () => stores.claims),
    sendEmail: async (message) => {
      emails.push(message);
      return true;
    },
    sendInvitation: async (invitation, token) => {
      emails.push({
        to: invitation.customerEmail,
        subject: 'Prime Line | Your Catalog Invitation',
        text: `Invitation: https://primelinedist.com/catalog-pdf/guest/#invite=${token}`,
        invitation
      });
      return true;
    },
    sendNotification: async (invitation, to) => {
      notifications.push({ invitation, to });
      return true;
    },
    getPublicBaseUrl: () => 'https://primelinedist.com',
    rateLimit: async () => true,
    now: () => timestamp
  };
  return {
    stores,
    emails,
    notifications,
    claims: stores.claims,
    dependencies,
    setNow(value) { timestamp = value; },
    get now() { return timestamp; }
  };
};

const inviteCustomer = async (
  fixtureState,
  duration = '7-days',
  email = 'buyer@example.com',
  fullName = 'Taylor Morgan'
) => {
  const handler = createCatalogStaffShareHandler(fixtureState.dependencies);
  const response = await handler(makeEvent('POST', {
    staffFullName: fullName,
    customerEmail: email,
    duration
  }));
  assert.equal(response.statusCode, 200);
  return emailToken(fixtureState.emails.at(-1), 'invite');
};

test('guest durations use fixed periods and clamped UTC calendar months', () => {
  const start = Date.UTC(2026, 0, 31, 13, 15);
  assert.equal(getGrantExpiresAt('24-hours', start), start + 24 * 60 * 60 * 1000);
  assert.equal(getGrantExpiresAt('7-days', start), start + 7 * 24 * 60 * 60 * 1000);
  assert.equal(getGrantExpiresAt('1-month', start), Date.UTC(2026, 1, 28, 13, 15));
  assert.equal(getGrantExpiresAt('3-months', start), Date.UTC(2026, 3, 30, 13, 15));
  assert.equal(getGrantExpiresAt('permanent', start), null);
});

test('admin rows sort by the original invitation creation date, with legacy records last', async () => {
  const state = fixture();
  const invitation = (id, createdAt, expiresAt) => ({
    id, customerEmail: `${id}@example.com`, sharedBy: 'sales@primelinedist.com',
    duration: '7-days', status: 'pending', createdAt, expiresAt, usedAt: null
  });
  await state.stores.invitations.setJSON('invitation:old', invitation('old', 100, state.now + 9000));
  await state.stores.invitations.setJSON('invitation:new', invitation('new', 300, state.now + 1000));
  await state.stores.invitations.setJSON('invitation:linked', invitation('linked', 200, state.now + 500));
  await state.stores.invitations.setJSON('invitation:legacy', invitation('legacy', undefined, state.now + 10000));
  await state.stores.grants.setJSON('grant:grant', {
    id: 'grant', invitationId: 'linked', email: 'linked@example.com', sharedBy: 'sales@primelinedist.com',
    duration: '7-days', createdAt: 9999, expiresAt: state.now + 20000, revokedAt: null
  });
  await state.stores.grants.setJSON('grant:orphan', {
    id: 'orphan', invitationId: 'missing', email: 'orphan@example.com', sharedBy: 'sales@primelinedist.com',
    duration: '7-days', createdAt: 99999, expiresAt: null, revokedAt: null
  });
  const handler = createCatalogGuestAdminHandler({
    ...state.dependencies,
    authorizeAdmin: async () => ({ ok: true, session: { email: ADMIN_EMAIL } })
  });
  const response = await handler(makeEvent('GET'));
  assert.equal(response.statusCode, 200);
  const rows = responseBody(response).entries;
  assert.deepEqual(rows.map((row) => row.id), ['new', 'grant', 'old', 'legacy', 'orphan']);
  assert.deepEqual(rows.map((row) => row.createdAt), [300, 200, 100, null, null]);
});

test('only an authenticated employee can create a guest invitation and tokens are stored hashed', async () => {
  const state = fixture();
  const response = await createCatalogStaffShareHandler(state.dependencies)(
    makeEvent('POST', {
      staffFullName: 'Taylor Morgan',
      customerEmail: 'Buyer@Example.com',
      duration: '7-days'
    })
  );
  assert.equal(response.statusCode, 200);
  assert.equal(state.emails.length, 1);
  assert.deepEqual(state.notifications.map(({ to }) => to), [
    'sales@primelinedist.com',
    ADMIN_EMAIL
  ]);
  assert.equal(state.notifications.every(({ invitation }) => invitation.customerEmail === 'buyer@example.com'), true);
  assert.equal(state.emails[0].to, 'buyer@example.com');
  const token = emailToken(state.emails[0], 'invite');
  const tokenHash = hashToken(token);
  const invitation = await state.stores.invitations.get(`invitation:${(await state.stores.invitations.get(`token:${tokenHash}`, { type: 'json' })).invitationId}`, { type: 'json' });
  assert.equal(invitation.customerEmail, 'buyer@example.com');
  assert.equal(invitation.duration, '7-days');
  assert.equal(invitation.sharedBy, 'sales@primelinedist.com');
  assert.equal(invitation.sharedByName, 'Taylor Morgan');
  assert.equal(invitation.expiresAt, state.now + GUEST_INVITATION_LIFETIME_MS);
  assert.equal(invitation.tokenHash, tokenHash);
  assert.equal(JSON.stringify([...state.stores.invitations.data.values()]).includes(token), false);

  const denied = await createCatalogStaffShareHandler({
    ...state.dependencies,
    getEmployeeSession: async () => null
  })(makeEvent('POST', { customerEmail: 'buyer@example.com', duration: '7-days' }));
  assert.equal(denied.statusCode, 401);
  assert.equal(state.emails.length, 1);
});

test('staff invitation creation rejects malformed email and does not require private storage setup', async () => {
  const state = fixture();
  const invalid = await createCatalogStaffShareHandler(state.dependencies)(
    makeEvent('POST', { customerEmail: 'not-an-email', duration: '7-days' })
  );
  assert.equal(invalid.statusCode, 400);

  const invited = await createCatalogStaffShareHandler(state.dependencies)(
    makeEvent('POST', {
      staffFullName: 'Taylor Morgan',
      customerEmail: 'buyer@example.com',
      duration: '7-days'
    })
  );
  assert.equal(invited.statusCode, 200);
  assert.equal(state.emails.length, 1);
});

test('Resend failure does not leave a redeemable invitation record', async () => {
  const state = fixture();
  const response = await createCatalogStaffShareHandler({
    ...state.dependencies,
    sendInvitation: async () => false
  })(makeEvent('POST', {
    staffFullName: 'Taylor Morgan',
    customerEmail: 'buyer@example.com',
    duration: '7-days'
  }));
  assert.equal(response.statusCode, 502);
  assert.equal(state.stores.invitations.data.size, 0);
});

test('staff profile is loaded and updated only for the verified employee email', async () => {
  const state = fixture();
  const handler = createCatalogStaffShareHandler(state.dependencies);
  const profileKey = `staff-profile:${hashEmail('sales@primelinedist.com')}`;

  const initial = await handler(makeEvent('GET'));
  assert.equal(responseBody(initial).email, 'sales@primelinedist.com');
  assert.equal(responseBody(initial).fullName, '');

  const impersonation = await handler(makeEvent('POST', {
    staffFullName: 'Taylor Morgan',
    email: 'another@primelinedist.com',
    customerEmail: 'buyer@example.com',
    duration: '7-days'
  }));
  assert.equal(impersonation.statusCode, 400);
  assert.equal(await state.stores.profiles.get(profileKey), null);
  assert.equal(state.emails.length, 0);

  const invited = await handler(makeEvent('POST', {
    staffFullName: '  Taylor   Morgan ',
    customerEmail: 'buyer@example.com',
    duration: '7-days'
  }));
  assert.equal(invited.statusCode, 200);
  assert.equal(state.emails[0].invitation.sharedBy, 'sales@primelinedist.com');
  assert.equal(state.emails[0].invitation.sharedByName, 'Taylor Morgan');
  assert.deepEqual(await state.stores.profiles.get(profileKey, { type: 'json' }), {
    email: 'sales@primelinedist.com',
    fullName: 'Taylor Morgan',
    updatedAt: state.now
  });

  const corrected = await handler(makeEvent('POST', {
    staffFullName: 'Taylor Lee Morgan',
    customerEmail: 'another-buyer@example.com',
    duration: '7-days'
  }));
  assert.equal(corrected.statusCode, 200);
  assert.equal(responseBody(await handler(makeEvent('GET'))).fullName, 'Taylor Lee Morgan');
  assert.equal(state.emails[1].invitation.sharedByName, 'Taylor Lee Morgan');
});

test('catalog invitation Resend request includes escaped inviter details in HTML and plain text', async () => {
  const previousFetch = globalThis.fetch;
  const previousApiKey = process.env.RESEND_API_KEY;
  const previousFromEmail = process.env.FROM_EMAIL;
  let request;
  process.env.RESEND_API_KEY = 'mock-resend-key';
  process.env.FROM_EMAIL = 'catalog@primelinedist.com';
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true };
  };

  try {
    const sent = await sendCatalogInvitationEmail({
      customerEmail: 'buyer@example.com',
      duration: '7-days',
      sharedBy: 'sales@primelinedist.com',
      sharedByName: '<img src=x onerror=alert(1)> & Morgan'
    }, 'mocked-invitation-token', {
      getPublicBaseUrl: () => 'https://primelinedist.com'
    });

    assert.equal(sent, true);
    assert.equal(request.url, 'https://api.resend.com/emails');
    assert.equal(request.options.method, 'POST');
    assert.equal(request.options.headers.Authorization, 'Bearer mock-resend-key');
    const message = JSON.parse(request.options.body);
    assert.equal(message.from, 'catalog@primelinedist.com');
    assert.match(message.text, /INVITED BY\n<img src=x onerror=alert\(1\)> & Morgan\nPrime Line Distributors\nsales@primelinedist\.com/);
    assert.match(message.html, /INVITED BY/i);
    assert.match(message.html, /&lt;img src=x onerror=alert\(1\)&gt; &amp; Morgan/);
    assert.doesNotMatch(message.html, /<img src=x onerror=alert\(1\)>/);
    assert.match(message.html, /href="mailto:sales@primelinedist\.com"/);
    assert.match(message.html, /VIEW CATALOG/);
    assert.match(message.html, /must be opened within 30 days/);
    assert.match(message.html, /reused on any browser or device/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousApiKey;
    if (previousFromEmail === undefined) delete process.env.FROM_EMAIL;
    else process.env.FROM_EMAIL = previousFromEmail;
  }
});

test('legacy catalog invitations include a known inviter email without an unverified name', async () => {
  let message;
  await sendCatalogInvitationEmail({
    customerEmail: 'buyer@example.com',
    duration: '7-days',
    sharedBy: 'sales@primelinedist.com'
  }, 'mocked-invitation-token', {
    getPublicBaseUrl: () => 'https://primelinedist.com',
    sendEmail: async (email) => {
      message = email;
      return true;
    }
  });
  assert.match(message.text, /INVITED BY\nsales@primelinedist\.com/);
  assert.doesNotMatch(message.text, /Prime Line Distributors/);
  assert.match(message.html, /mailto:sales@primelinedist\.com/);
  assert.doesNotMatch(message.html, /Prime Line Distributors/);
});

test('staff and Super Admin receive internal copies without the customer access link', async () => {
  const previousFetch = globalThis.fetch;
  const previousApiKey = process.env.RESEND_API_KEY;
  const previousFromEmail = process.env.FROM_EMAIL;
  const requests = [];
  process.env.RESEND_API_KEY = 'mock-resend-key';
  process.env.FROM_EMAIL = 'catalog@primelinedist.com';
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return { ok: true };
  };

  try {
    const sent = await sendCatalogShareNotification({
      customerEmail: 'buyer@example.com',
      duration: '7-days',
      sharedBy: 'sales@primelinedist.com',
      sharedByName: 'Taylor <Morgan>'
    }, ADMIN_EMAIL, {
      getPublicBaseUrl: () => 'https://primelinedist.com'
    });

    assert.equal(sent, true);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, 'https://api.resend.com/emails');
    const message = JSON.parse(requests[0].options.body);
    assert.deepEqual(message.to, [ADMIN_EMAIL]);
    assert.match(message.text, /generated by Taylor <Morgan> \(sales@primelinedist\.com\) for buyer@example\.com/);
    assert.match(message.html, /Taylor &lt;Morgan&gt;/);
    assert.match(message.html, /buyer@example\.com/);
    assert.doesNotMatch(message.text, /#invite=/);
    assert.doesNotMatch(message.html, /#invite=/);
    assert.match(message.text, /does not contain that link/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousApiKey;
    if (previousFromEmail === undefined) delete process.env.FROM_EMAIL;
    else process.env.FROM_EMAIL = previousFromEmail;
  }
});

test('customer invitation remains active when an internal sharing notification fails', async () => {
  const state = fixture();
  const response = await createCatalogStaffShareHandler({
    ...state.dependencies,
    sendNotification: async (invitation, to) => {
      state.notifications.push({ invitation, to });
      return to !== ADMIN_EMAIL;
    }
  })(makeEvent('POST', {
    staffFullName: 'Taylor Morgan',
    customerEmail: 'buyer@example.com',
    duration: '7-days'
  }));

  assert.equal(response.statusCode, 200);
  assert.deepEqual(responseBody(response), { invited: true, notificationsSent: false });
  assert.equal(state.emails.length, 1);
  assert.equal(state.notifications.length, 2);
  assert.equal(state.stores.invitations.data.size, 2);
});

test('GET never redeems a Magic Link and explicit POST creates the selected grant and finite session', async () => {
  const state = fixture();
  const token = await inviteCustomer(state, '7-days');
  const redeem = createCatalogGuestRedeemHandler(state.dependencies);
  const getResponse = await redeem(makeEvent('GET', { token, purpose: 'invite' }));
  assert.equal(getResponse.statusCode, 405);
  assert.equal(state.claims.data.size, 0);

  const response = await redeem(makeEvent('POST', { token, purpose: 'invite' }));
  assert.equal(response.statusCode, 200);
  const result = responseBody(response);
  assert.equal(result.authenticated, true);
  assert.equal(result.resource, 'catalog-guest');
  assert.equal(result.expiresAt, state.now + 7 * 24 * 60 * 60 * 1000);
  assert.equal(result.sharedBy, 'sales@primelinedist.com');
  assert.equal(result.sharedByName, 'Taylor Morgan');
  const cookies = response.multiValueHeaders['Set-Cookie'];
  assert.equal(cookies.length, 2);
  assert.match(cookies[0], /HttpOnly; Secure; SameSite=Strict/);
  assert.match(cookies[0], new RegExp(`Max-Age=${GUEST_SESSION_LIFETIME_SECONDS}`));
  assert.match(cookies[1], new RegExp(`^${GUEST_DEVICE_COOKIE}=`));
  const sessionId = cookies[0].match(/__Host-pl-guest-catalog-session=([^;]+)/)?.[1];
  const session = await state.stores.sessions.get(`session:${sessionId}`, { type: 'json' });
  assert.equal(session.resource, 'catalog-guest');
  assert.equal(session.expiresAt, state.now + GUEST_SESSION_LIFETIME_SECONDS * 1000);
  const browserCookie = `${cookies[0].split(';')[0]}; ${cookies[1].split(';')[0]}`;
  const sessionResponse = await createCatalogGuestSessionHandler(state.dependencies)(
    makeEvent('GET', undefined, browserCookie)
  );
  assert.equal(responseBody(sessionResponse).sharedBy, 'sales@primelinedist.com');
  assert.equal(responseBody(sessionResponse).sharedByName, 'Taylor Morgan');
});

test('invitation link is reusable on the same device without creating another grant', async () => {
  const state = fixture();
  const token = await inviteCustomer(state);
  const handler = createCatalogGuestRedeemHandler(state.dependencies);
  const first = await handler(makeEvent('POST', { token, purpose: 'invite' }));
  const cookies = first.multiValueHeaders['Set-Cookie'];
  const deviceCookie = cookies[1].split(';')[0];
  const replay = await handler(makeEvent('POST', { token, purpose: 'invite' }, deviceCookie));
  assert.equal(first.statusCode, 200);
  assert.equal(replay.statusCode, 200);
  assert.equal(state.stores.grants.data.size, 1);
  assert.equal(state.stores.sessions.data.size, 2);
  assert.equal((await state.stores.grants.get(
    `grant:${(await state.stores.invitations.get(`invitation:${(await state.stores.invitations.get(`token:${hashToken(token)}`, { type: 'json' })).invitationId}`, { type: 'json' })).grantId}`,
    { type: 'json' }
  )).deviceHashes.length, 0);
});

test('device cookie is established before redemption and failed session creation reserves no device', async () => {
  const state = fixture();
  const token = await inviteCustomer(state);
  const event = makeEvent('POST', { token, purpose: 'invite' });
  delete event.headers.cookie;
  const handler = createCatalogGuestRedeemHandler(state.dependencies);
  const preparation = await handler(event);
  assert.equal(preparation.statusCode, 428);
  assert.equal(state.stores.grants.data.size, 0);
  event.headers.cookie = preparation.multiValueHeaders['Set-Cookie'][0].split(';')[0];
  const failure = await createCatalogGuestRedeemHandler({
    ...state.dependencies, createSession: async () => { throw new Error('test failure'); }
  })(event);
  assert.equal(failure.statusCode, 503);
  const grant = JSON.parse([...state.stores.grants.data.values()][0]);
  assert.deepEqual(grant.deviceHashes, []);
  assert.equal((await handler(event)).statusCode, 200);
});

test('administrator invalidates sessions without changing legacy device or reset history', async () => {
  const state = fixture();
  const token = await inviteCustomer(state);
  const redeem = createCatalogGuestRedeemHandler(state.dependencies);
  const first = await redeem(makeEvent('POST', { token, purpose: 'invite' }));
  const cookies = first.multiValueHeaders['Set-Cookie'].map(value => value.split(';')[0]).join('; ');
  for (const id of ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']) {
    assert.equal((await redeem(makeEvent('POST', { token, purpose: 'invite' }, `${GUEST_DEVICE_COOKIE}=${id}`))).statusCode, 200);
  }
  const grant = JSON.parse([...state.stores.grants.data.values()][0]);
  grant.deviceHashes = ['legacy-device-1', 'legacy-device-2', 'legacy-device-3'];
  const historicalReset = {
    action: 'reset-authorized-devices', administrator: ADMIN_EMAIL,
    timestamp: state.now - 1000, previousDeviceCount: 3, emailStatus: 'accepted'
  };
  grant.deviceResetAudit = [historicalReset];
  await state.stores.grants.setJSON(`grant:${grant.id}`, grant);
  await createCatalogGuestRequestLinkHandler(state.dependencies)(makeEvent('POST', { email: grant.email }));
  const verification = emailToken(state.emails.at(-1), 'verify');
  const newDevice = `${GUEST_DEVICE_COOKIE}=33333333-3333-4333-8333-333333333333`;
  const admin = createCatalogGuestAdminHandler({
    ...state.dependencies, authorizeAdmin: async () => ({ ok: true, session: { email: ADMIN_EMAIL } })
  });
  assert.equal((await admin(makeEvent('POST', { action: 'reset-devices', grantId: grant.id }))).statusCode, 400);
  const crossOrigin = makeEvent('POST', resetPayload(grant.id));
  crossOrigin.headers.origin = 'https://other.example';
  assert.equal((await admin(crossOrigin)).statusCode, 403);
  assert.equal((await admin(makeEvent('POST', resetPayload(grant.id)))).statusCode, 200);
  const reset = await state.stores.grants.get(`grant:${grant.id}`, { type: 'json' });
  assert.equal(reset.expiresAt, grant.expiresAt);
  assert.equal(reset.email, grant.email);
  assert.equal(reset.sharedBy, grant.sharedBy);
  assert.equal(reset.sharedByName, grant.sharedByName);
  assert.equal(reset.invitationId, grant.invitationId);
  assert.equal(reset.revokedAt, grant.revokedAt);
  assert.equal(reset.status, grant.status);
  assert.deepEqual(reset.deviceHashes, grant.deviceHashes);
  assert.deepEqual(reset.deviceResetAudit[0], historicalReset);
  assert.equal(reset.deviceResetAudit[1].action, 'invalidate-guest-sessions');
  assert.equal(reset.deviceResetAudit[1].administrator, ADMIN_EMAIL);
  assert.equal(reset.deviceResetAudit[1].timestamp, state.now);
  assert.equal(reset.deviceResetAudit[1].previousDeviceCount, null);
  assert.equal(reset.deviceResetAudit[1].emailStatus, 'not_requested');
  const rows = responseBody(await admin(makeEvent('GET'))).entries;
  const history = rows.find(row => row.id === grant.id).resetHistory;
  assert.equal(history.length, 2);
  assert.equal(history[0].previousDeviceCount, 3);
  assert.equal(history[0].emailStatus, 'accepted');
  assert.equal(history[1].previousDeviceCount, null);
  assert.equal((await createCatalogGuestPdfHandler(state.dependencies)(makeEvent('GET', undefined, cookies))).statusCode, 401);
  assert.equal((await createCatalogGuestSessionHandler(state.dependencies)(makeEvent('GET', undefined, cookies))).statusCode, 401);
  assert.equal((await redeem(makeEvent('POST', { token: verification, purpose: 'verify' }, newDevice))).statusCode, 200);
  assert.equal((await redeem(makeEvent('POST', { token: verification, purpose: 'verify' }, newDevice))).statusCode, 409);

  const unauthorized = createCatalogGuestAdminHandler({
    ...state.dependencies, authorizeAdmin: async () => ({ ok: true, session: { email: 'other@primelinedist.com' } })
  });
  assert.equal((await unauthorized(makeEvent('POST', resetPayload(grant.id)))).statusCode, 403);
  state.setNow(grant.expiresAt + 1);
  assert.equal((await admin(makeEvent('POST', resetPayload(grant.id)))).statusCode, 409);
});

test('reset and recovery send one link for the selected grant under concurrent duplicate requests', async () => {
  const state = fixture();
  const firstToken = await inviteCustomer(state, '3-months', 'buyer@example.com', 'First Seller');
  state.dependencies.getEmployeeSession = async () => ({
    email: 'other@primelinedist.com', resource: 'catalog-pdf', expiresAt: state.now + 60000
  });
  const secondToken = await inviteCustomer(state, 'permanent', 'buyer@example.com', 'Second Seller');
  const redeem = createCatalogGuestRedeemHandler(state.dependencies);
  const first = await redeem(makeEvent('POST', { token: firstToken, purpose: 'invite' }));
  const second = await redeem(makeEvent('POST', { token: secondToken, purpose: 'invite' }));
  const pointer = await state.stores.invitations.get(`token:${hashToken(firstToken)}`, { type: 'json' });
  const invitation = await state.stores.invitations.get(`invitation:${pointer.invitationId}`, { type: 'json' });
  const before = await state.stores.grants.get(`grant:${invitation.grantId}`, { type: 'json' });
  let release;
  let entered;
  const waiting = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const messages = [];
  const admin = createCatalogGuestAdminHandler({
    ...state.dependencies,
    authorizeAdmin: async () => ({ ok: true, session: { email: ADMIN_EMAIL } }),
    sendRecoveryEmail: async message => { messages.push(message); entered(); await gate; return { status: 'accepted' }; }
  });
  const payload = resetPayload(before.id, true);
  const firstRequest = admin(makeEvent('POST', payload));
  await waiting;
  const duplicate = await admin(makeEvent('POST', payload));
  assert.equal(responseBody(duplicate).emailStatus, 'pending');
  assert.equal(messages.length, 1);
  release();
  assert.equal(responseBody(await firstRequest).emailStatus, 'accepted');
  assert.equal(responseBody(await admin(makeEvent('POST', payload))).emailStatus, 'accepted');
  assert.equal((await admin(makeEvent('POST', { ...payload, sendLink: false }))).statusCode, 409);

  const after = await state.stores.grants.get(`grant:${before.id}`, { type: 'json' });
  assert.equal(after.deviceVersion, 1);
  assert.equal(after.deviceResetAudit.length, 1);
  assert.equal(after.email, before.email);
  assert.equal(after.invitationId, before.invitationId);
  assert.equal(after.sharedBy, before.sharedBy);
  assert.equal(after.expiresAt, before.expiresAt);
  const sessionCookies = response => response.multiValueHeaders['Set-Cookie'].map(value => value.split(';')[0]).join('; ');
  const pdf = createCatalogGuestPdfHandler(state.dependencies);
  assert.equal((await pdf(makeEvent('GET', undefined, sessionCookies(first)))).statusCode, 401);
  assert.equal((await pdf(makeEvent('GET', undefined, sessionCookies(second)))).statusCode, 200);
  assert.equal(messages[0].to, before.email);
  assert.match(messages[0].text, /First Seller/);
  assert.doesNotMatch(messages[0].text, /Second Seller/);
  const verification = emailToken(messages[0], 'verify');
  const deviceCookie = first.multiValueHeaders['Set-Cookie'][1].split(';')[0];
  const recovered = await redeem(makeEvent('POST', { token: verification, purpose: 'verify' }, deviceCookie));
  assert.equal(recovered.statusCode, 200);
  assert.equal(responseBody(recovered).sharedBy, before.sharedBy);
  assert.equal(responseBody(recovered).expiresAt, before.expiresAt);

  const rows = responseBody(await admin(makeEvent('GET'))).entries;
  const row = rows.find(item => item.id === before.id);
  assert.equal(row.resetCount, 1);
  assert.equal(row.resetHistory[0].emailStatus, 'accepted');
  assert.equal(row.resetHistory[0].emailStatusAt, state.now);
  assert.equal(row.resetHistory[0].previousDeviceCount, null);
  assert.equal(JSON.stringify(row.resetHistory).includes(payload.operationId), false);
  assert.equal(JSON.stringify(row.resetHistory).includes(verification), false);
  assert.equal(JSON.stringify(row.resetHistory).includes('deviceHashes'), false);
  const otherAdmin = createCatalogGuestAdminHandler({
    ...state.dependencies, authorizeAdmin: async () => ({ ok: true, session: { email: 'other@primelinedist.com' } })
  });
  const otherRows = responseBody(await otherAdmin(makeEvent('GET'))).entries;
  assert.equal(Object.hasOwn(otherRows.find(item => item.id === before.id), 'resetHistory'), false);
  assert.equal((await otherAdmin(makeEvent('POST', resetPayload(before.id, true)))).statusCode, 403);
});

test('reset only is idempotent under concurrent requests and never sends email', async () => {
  const state = fixture();
  const token = await inviteCustomer(state);
  await createCatalogGuestRedeemHandler(state.dependencies)(makeEvent('POST', { token, purpose: 'invite' }));
  const grant = JSON.parse([...state.stores.grants.data.values()][0]);
  let emailsSent = 0;
  const admin = createCatalogGuestAdminHandler({
    ...state.dependencies, authorizeAdmin: async () => ({ ok: true, session: { email: ADMIN_EMAIL } }),
    sendRecoveryEmail: async () => { emailsSent++; return { status: 'accepted' }; }
  });
  const payload = resetPayload(grant.id);
  const responses = await Promise.all(Array.from({ length: 5 }, () => admin(makeEvent('POST', payload))));
  assert.ok(responses.every(response => response.statusCode === 200));
  assert.ok(responses.every(response => responseBody(response).emailStatus === 'not_requested'));
  const saved = await state.stores.grants.get(`grant:${grant.id}`, { type: 'json' });
  assert.equal(saved.deviceVersion, 1);
  assert.equal(saved.deviceResetAudit.length, 1);
  assert.equal(emailsSent, 0);
});

test('reset email failures and uncertain results remain separate from the successful reset', async () => {
  for (const status of ['failed', 'unknown']) {
    const state = fixture();
    const token = await inviteCustomer(state);
    await createCatalogGuestRedeemHandler(state.dependencies)(makeEvent('POST', { token, purpose: 'invite' }));
    const grant = JSON.parse([...state.stores.grants.data.values()][0]);
    let message;
    const admin = createCatalogGuestAdminHandler({
      ...state.dependencies, authorizeAdmin: async () => ({ ok: true, session: { email: ADMIN_EMAIL } }),
      sendRecoveryEmail: async value => { message = value; return { status }; }
    });
    const payload = resetPayload(grant.id, true);
    const response = await admin(makeEvent('POST', payload));
    assert.equal(response.statusCode, 200);
    assert.equal(responseBody(response).devicesReset, true);
    assert.equal(responseBody(response).emailStatus, status);
    assert.equal(responseBody(await admin(makeEvent('POST', payload))).emailStatus, status);
    const saved = await state.stores.grants.get(`grant:${grant.id}`, { type: 'json' });
    assert.equal(saved.deviceResetAudit.length, 1);
    assert.equal(saved.deviceResetAudit[0].emailStatus, status);
    const verify = emailToken(message, 'verify');
    const pointer = await state.stores.verifications.get(`token:${hashToken(verify)}`, { type: 'json' });
    assert.equal(Boolean(pointer), status === 'unknown');
  }
});

test('deletion during recovery preserves the reset outcome without restoring access', async () => {
  const state = fixture();
  const token = await inviteCustomer(state);
  await createCatalogGuestRedeemHandler(state.dependencies)(makeEvent('POST', { token, purpose: 'invite' }));
  const grant = JSON.parse([...state.stores.grants.data.values()][0]);
  let release;
  let entered;
  const waiting = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  let message;
  const admin = createCatalogGuestAdminHandler({
    ...state.dependencies, authorizeAdmin: async () => ({ ok: true, session: { email: ADMIN_EMAIL } }),
    sendRecoveryEmail: async value => { message = value; entered(); await gate; return { status: 'accepted' }; }
  });
  const resetting = admin(makeEvent('POST', resetPayload(grant.id, true)));
  await waiting;
  assert.equal(responseBody(await admin(makeEvent('POST', { action: 'delete', recordType: 'grant', id: grant.id }))).deleted, 1);
  release();
  assert.equal(responseBody(await resetting).emailStatus, 'accepted');
  const marker = await state.stores.grants.get(`grant:${grant.id}`, { type: 'json' });
  assert.equal(marker.status, 'deleted');
  assert.equal(marker.email, undefined);
  assert.equal(marker.deviceResetAudit[0].emailStatus, 'accepted');
  assert.equal((await createCatalogGuestRedeemHandler(state.dependencies)(
    makeEvent('POST', { token: emailToken(message, 'verify'), purpose: 'verify' })
  )).statusCode, 401);
});

test('Resend acceptance, rejection and ambiguous failures are distinguished with an idempotency key', async () => {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = 'mock-key';
  const message = { to: 'buyer@example.com', subject: 'Test', text: 'Test', html: '<p>Test</p>' };
  try {
    for (const [status, expected] of [[200, 'accepted'], [400, 'failed'], [500, 'unknown'], [409, 'unknown']]) {
      globalThis.fetch = async (_url, options) => {
        assert.equal(options.headers['Idempotency-Key'], 'catalog-reset/test');
        return { ok: status === 200, status };
      };
      assert.equal((await sendGuestEmailWithResult(message, 'catalog-reset/test')).status, expected);
    }
    globalThis.fetch = async () => { throw new Error('test network failure'); };
    assert.equal((await sendGuestEmailWithResult(message, 'catalog-reset/test')).status, 'unknown');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousKey;
  }
});

test('concurrent devices are unrestricted and session invalidation prevents stale authorization', async () => {
  const state = fixture();
  const token = await inviteCustomer(state);
  const redeem = createCatalogGuestRedeemHandler(state.dependencies);
  assert.equal((await redeem(makeEvent('POST', { token, purpose: 'invite' }))).statusCode, 200);
  const grant = JSON.parse([...state.stores.grants.data.values()][0]);
  const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444'];
  const results = await Promise.all(ids.map(id => redeem(makeEvent('POST', { token, purpose: 'invite' }, `${GUEST_DEVICE_COOKIE}=${id}`))));
  assert.equal(results.filter(result => result.statusCode === 200).length, 4);
  assert.equal((await state.stores.grants.get(`grant:${grant.id}`, { type: 'json' })).deviceHashes.length, 0);

  const admin = createCatalogGuestAdminHandler({
    ...state.dependencies, authorizeAdmin: async () => ({ ok: true, session: { email: ADMIN_EMAIL } })
  });
  assert.equal((await admin(makeEvent('POST', resetPayload(grant.id)))).statusCode, 200);
  let release;
  let entered;
  const gate = new Promise(resolve => { release = resolve; });
  const waiting = new Promise(resolve => { entered = resolve; });
  const original = state.stores.grants.setJSON;
  let blocked = false;
  state.stores.grants.setJSON = async (key, value, options) => {
    if (!blocked && value.deviceVersion === 1 && options?.onlyIfMatch) {
      blocked = true;
      entered();
      await gate;
    }
    return original(key, value, options);
  };
  const stale = redeem(makeEvent('POST', { token, purpose: 'invite' }, `${GUEST_DEVICE_COOKIE}=${ids[0]}`));
  await waiting;
  assert.equal((await admin(makeEvent('POST', resetPayload(grant.id)))).statusCode, 200);
  release();
  assert.equal((await stale).statusCode, 409);
  const final = await state.stores.grants.get(`grant:${grant.id}`, { type: 'json' });
  assert.deepEqual(final.deviceHashes, []);
  assert.equal(final.deviceVersion, 2);
  assert.equal(final.deviceResetAudit.length, 2);
  assert.equal((await admin(makeEvent('POST', { action: 'revoke', grantId: grant.id }))).statusCode, 200);
  assert.equal((await admin(makeEvent('POST', resetPayload(grant.id)))).statusCode, 409);
  assert.equal((await redeem(makeEvent('POST', { token, purpose: 'invite' }, `${GUEST_DEVICE_COOKIE}=${ids[0]}`))).statusCode, 401);
});

test('one-use verification is atomic and session failures leave the link reusable', async () => {
  const state = fixture();
  const token = await inviteCustomer(state);
  const redeem = createCatalogGuestRedeemHandler(state.dependencies);
  assert.equal((await redeem(makeEvent('POST', { token, purpose: 'invite' }))).statusCode, 200);
  await createCatalogGuestRequestLinkHandler(state.dependencies)(makeEvent('POST', { email: 'buyer@example.com' }));
  const verification = emailToken(state.emails.at(-1), 'verify');
  const cookies = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']
    .map(id => `${GUEST_DEVICE_COOKIE}=${id}`);
  const failure = createCatalogGuestRedeemHandler({
    ...state.dependencies, createSession: async () => { throw new Error('test failure'); }
  });
  assert.equal((await failure(makeEvent('POST', { token: verification, purpose: 'verify' }, cookies[0]))).statusCode, 503);
  const results = await Promise.all(cookies.map(cookie => redeem(makeEvent('POST', { token: verification, purpose: 'verify' }, cookie))));
  assert.deepEqual(results.map(result => result.statusCode).sort(), [200, 409]);
  const grant = JSON.parse([...state.stores.grants.data.values()][0]);
  assert.equal(grant.deviceHashes.length, 0);
});

test('concurrent first redemption and revocation cannot overwrite grant changes', async () => {
  const state = fixture();
  const token = await inviteCustomer(state);
  const redeem = createCatalogGuestRedeemHandler(state.dependencies);
  const cookies = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']
    .map(id => `${GUEST_DEVICE_COOKIE}=${id}`);
  const responses = await Promise.all(cookies.map(cookie => redeem(makeEvent('POST', { token, purpose: 'invite' }, cookie))));
  assert.deepEqual(responses.map(result => result.statusCode), [200, 200]);
  const grant = JSON.parse([...state.stores.grants.data.values()][0]);
  assert.equal(grant.deviceHashes.length, 0);
  const admin = createCatalogGuestAdminHandler({
    ...state.dependencies, authorizeAdmin: async () => ({ ok: true, session: { email: ADMIN_EMAIL } })
  });
  let release;
  let entered;
  const gate = new Promise(resolve => { release = resolve; });
  const waiting = new Promise(resolve => { entered = resolve; });
  const original = state.stores.grants.setJSON;
  let blocked = false;
  state.stores.grants.setJSON = async (key, value, options) => {
    if (!blocked && value.revokedAt && options?.onlyIfMatch) {
      blocked = true;
      entered();
      await gate;
    }
    return original(key, value, options);
  };
  const revoke = admin(makeEvent('POST', { action: 'revoke', grantId: grant.id }));
  await waiting;
  assert.equal((await admin(makeEvent('POST', resetPayload(grant.id)))).statusCode, 200);
  release();
  assert.equal((await revoke).statusCode, 200);
  const final = await state.stores.grants.get(`grant:${grant.id}`, { type: 'json' });
  assert.ok(final.revokedAt);
  assert.equal(final.deviceVersion, 1);
  assert.equal(final.deviceResetAudit.length, 1);
  assert.equal(final.expiresAt, grant.expiresAt);
});

test('Netlify Blobs conditional grant update retries a real SDK conflict', async () => {
  const { getStore } = await import('@netlify/blobs');
  let version = 1;
  let stored = { status: 'active', expiresAt: null, deviceHashes: [] };
  let puts = 0;
  const store = getStore({
    name: 'guest-grant-test', siteID: 'test', token: 'test', consistency: 'strong',
    edgeURL: 'https://example.invalid', uncachedEdgeURL: 'https://example.invalid',
    fetch: async (_url, options) => {
      if (options.method === 'get') {
        return new Response(JSON.stringify(stored), { status: 200, headers: { etag: `"${version}"` } });
      }
      assert.equal(options.method, 'put');
      puts++;
      if (puts === 1) {
        stored = { ...stored, sharedBy: 'sales@example.com' };
        version++;
      }
      if (options.headers['if-match'] !== `"${version}"`) return new Response(null, { status: 412 });
      stored = JSON.parse(options.body);
      version++;
      return new Response(null, { status: 200, headers: { etag: `"${version}"` } });
    }
  });
  const result = await updateGuestGrant(store, 'grant', async grant => ({ grant: { ...grant, deviceVersion: 1 } }));
  assert.equal(puts, 2);
  assert.equal(result.grant.sharedBy, 'sales@example.com');
  assert.equal(stored.deviceVersion, 1);
});

test('invitation opens automatically, preparing fresh browser cookies only once', async () => {
  const elements = new Map();
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector, {
      hidden: true, listeners: {}, classList: { toggle() {} },
      addEventListener(type, handler) { this.listeners[type] = handler; },
      querySelector() { return { textContent: '' }; }
    });
    return elements.get(selector);
  };
  const requests = [];
  let fragmentRemoved = false;
  const context = {
    document: { querySelector: element },
    location: { hash: `#invite=${'a'.repeat(43)}`, pathname: '/catalog-pdf/guest/', search: '' },
    history: { replaceState() { fragmentRemoved = true; } },
    URLSearchParams, setTimeout: () => 1, clearTimeout() {},
    fetch: async (url, options) => {
      requests.push({ url, options });
      if (url.endsWith('/redeem')) {
        assert.equal(fragmentRemoved, true);
        assert.equal(JSON.parse(options.body).purpose, 'invite');
        if (requests.filter(request => request.url.endsWith('/redeem')).length === 1) return { status: 428 };
        return { status: 200, ok: true, json: async () => ({
          authenticated: true, resource: 'catalog-guest', expiresAt: null, sharedBy: 'seller@primelinedist.com'
        }) };
      }
      return { status: 200, ok: true };
    }
  };
  const script = readFileSync(new URL('../../catalog-pdf/guest/guest-catalog.js', import.meta.url), 'utf8')
    .replace('initialize();', 'globalThis.guestInitialization = initialize();');
  runInNewContext(script, context);
  await context.guestInitialization;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests.filter(request => request.url.endsWith('/redeem')).length, 2);
  assert.equal(requests.filter(request => request.url.endsWith('/pdf')).length, 1);
  assert.equal(requests.some(request => request.url.endsWith('/session') || request.url.endsWith('/request-link')), false);
  assert.equal(element('#guestLinkPanel').hidden, true);
  assert.equal(element('#retryGuestInvitation').hidden, true);
  assert.equal(element('#guestViewer').hidden, false);
  assert.equal(element('#guestInviterEmail').textContent, 'seller@primelinedist.com');
});

test('failed automatic invitation redemption shows the error and allows a guarded retry', async () => {
  const elements = new Map();
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector, {
      hidden: true, listeners: {}, classList: { toggle() {} },
      addEventListener(type, handler) { this.listeners[type] = handler; },
      querySelector() { return { textContent: '' }; }
    });
    return elements.get(selector);
  };
  let requests = 0;
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const context = {
    document: { querySelector: element },
    location: { hash: `#invite=${'a'.repeat(43)}`, pathname: '/catalog-pdf/guest/', search: '' },
    history: { replaceState() {} }, URLSearchParams, setTimeout: () => 1, clearTimeout() {},
    fetch: async url => {
      assert.equal(url, '/api/catalog/guest/redeem');
      requests++;
      if (requests === 1) return { status: 401, ok: false, json: async () => ({ error: 'This catalog access has expired or been revoked.' }) };
      await pending;
      return { status: 401, ok: false, json: async () => ({ error: 'This catalog access has expired or been revoked.' }) };
    }
  };
  const script = readFileSync(new URL('../../catalog-pdf/guest/guest-catalog.js', import.meta.url), 'utf8')
    .replace('initialize();', 'globalThis.guestInitialization = initialize();');
  runInNewContext(script, context);
  await context.guestInitialization;
  assert.match(element('#guestStatus').textContent, /expired or been revoked/);
  assert.equal(element('#guestLinkPanel').hidden, true);
  assert.equal(element('#retryGuestInvitation').hidden, false);
  const first = element('#retryGuestInvitation').listeners.click();
  await element('#retryGuestInvitation').listeners.click();
  assert.equal(requests, 2);
  release();
  await first;
  assert.match(element('#guestStatus').textContent, /expired or been revoked/);
  assert.equal(element('#guestViewer').hidden, true);
});

test('single-use verification links still require confirmation and guard against duplicate clicks', async () => {
  const elements = new Map();
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector, {
      hidden: true, listeners: {}, classList: { toggle() {} },
      addEventListener(type, handler) { this.listeners[type] = handler; },
      querySelector() { return { textContent: '' }; }
    });
    return elements.get(selector);
  };
  let requests = 0;
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const context = {
    document: { querySelector: element },
    location: { hash: `#verify=${'b'.repeat(43)}`, pathname: '/catalog-pdf/guest/', search: '' },
    history: { replaceState() {} }, URLSearchParams, setTimeout: () => 1, clearTimeout() {},
    fetch: async (url, options) => {
      if (url.endsWith('/pdf')) return { ok: true };
      requests++;
      assert.equal(JSON.parse(options.body).purpose, 'verify');
      await pending;
      return { status: 200, ok: true, json: async () => ({ authenticated: true, resource: 'catalog-guest', expiresAt: null }) };
    }
  };
  const script = readFileSync(new URL('../../catalog-pdf/guest/guest-catalog.js', import.meta.url), 'utf8')
    .replace('initialize();', 'globalThis.guestInitialization = initialize();');
  runInNewContext(script, context);
  await context.guestInitialization;
  assert.equal(requests, 0);
  assert.equal(element('#guestLinkPanel').hidden, false);
  const first = element('#openGuestCatalog').listeners.click();
  await element('#openGuestCatalog').listeners.click();
  assert.equal(requests, 1);
  release();
  await first;
  assert.equal(element('#guestViewer').hidden, false);
});

test('unopened invitations remain valid for 30 days and expire afterward', async () => {
  const validState = fixture();
  const validToken = await inviteCustomer(validState);
  validState.setNow(validState.now + GUEST_INVITATION_LIFETIME_MS - 1);
  const stillValid = await createCatalogGuestRedeemHandler(validState.dependencies)(
    makeEvent('POST', { token: validToken, purpose: 'invite' })
  );
  assert.equal(stillValid.statusCode, 200);

  const expiredState = fixture();
  const expiredToken = await inviteCustomer(expiredState);
  expiredState.setNow(expiredState.now + GUEST_INVITATION_LIFETIME_MS + 1);
  const expired = await createCatalogGuestRedeemHandler(expiredState.dependencies)(
    makeEvent('POST', { token: expiredToken, purpose: 'invite' })
  );
  assert.equal(expired.statusCode, 401);
  assert.equal(expiredState.claims.data.size, 0);
  assert.equal(expiredState.stores.grants.data.size, 0);
});

test('an invitation with exhausted legacy slots works repeatedly in fresh browsers and incognito', async () => {
  const state = fixture();
  const token = await inviteCustomer(state);
  const redeem = createCatalogGuestRedeemHandler(state.dependencies);
  const first = await redeem(makeEvent('POST', { token, purpose: 'invite' }));
  const invitation = (await state.stores.invitations.get(
    `invitation:${(await state.stores.invitations.get(`token:${hashToken(token)}`, { type: 'json' })).invitationId}`,
    { type: 'json' }
  ));
  const grant = await state.stores.grants.get(`grant:${invitation.grantId}`, { type: 'json' });
  grant.deviceHashes = ['old-one', 'old-two', 'old-three'];
  await state.stores.grants.setJSON(`grant:${grant.id}`, grant);
  assert.equal(first.statusCode, 200);
  const sessionHandler = createCatalogGuestSessionHandler(state.dependencies);
  for (let i = 0; i < 10; i++) {
    const request = makeEvent('POST', { token, purpose: 'invite' });
    delete request.headers.cookie;
    const preparation = await redeem(request);
    assert.equal(preparation.statusCode, 428);
    request.headers.cookie = preparation.multiValueHeaders['Set-Cookie'][0].split(';')[0];
    const opened = await redeem(request);
    assert.equal(opened.statusCode, 200);
    assert.equal(responseBody(opened).expiresAt, grant.expiresAt);
    assert.equal(responseBody(opened).sharedBy, grant.sharedBy);
    const cookies = opened.multiValueHeaders['Set-Cookie'].map(value => value.split(';')[0]).join('; ');
    assert.equal((await sessionHandler(makeEvent('GET', undefined, cookies))).statusCode, 200);
    assert.equal((await createCatalogGuestPdfHandler(state.dependencies)(makeEvent('GET', undefined, cookies))).statusCode, 200);
    assert.equal((await redeem(request)).statusCode, 200);
  }
  const after = await state.stores.grants.get(`grant:${grant.id}`, { type: 'json' });
  assert.deepEqual(after, grant);
  assert.equal(state.stores.sessions.data.size, 21);
  const firstCookies = first.multiValueHeaders['Set-Cookie'].map(value => value.split(';')[0]).join('; ');
  assert.equal((await sessionHandler(makeEvent('GET', undefined, firstCookies))).statusCode, 200);
  await createCatalogGuestRequestLinkHandler(state.dependencies)(makeEvent('POST', { email: grant.email }));
  const verification = emailToken(state.emails.at(-1), 'verify');
  const freshDevice = `${GUEST_DEVICE_COOKIE}=${randomUUID()}`;
  assert.equal((await redeem(makeEvent('POST', { token: verification, purpose: 'verify' }, freshDevice))).statusCode, 200);
  assert.deepEqual((await state.stores.grants.get(`grant:${grant.id}`, { type: 'json' })).deviceHashes, grant.deviceHashes);
});

test('reused invitation expires with the authorized access period', async () => {
  const state = fixture();
  const token = await inviteCustomer(state, '7-days');
  const redeem = createCatalogGuestRedeemHandler(state.dependencies);
  const first = await redeem(makeEvent('POST', { token, purpose: 'invite' }));
  assert.equal(first.statusCode, 200);

  state.setNow(state.now + 7 * 24 * 60 * 60 * 1000 + 1);
  const expired = await redeem(makeEvent('POST', { token, purpose: 'invite' }));
  assert.equal(expired.statusCode, 401);
  assert.match(responseBody(expired).error, /expired or been revoked/i);
});

test('an expired session requires the original invitation or verified email, not just the device', async () => {
  const state = fixture();
  const token = await inviteCustomer(state, '3-months');
  const redeemed = await createCatalogGuestRedeemHandler(state.dependencies)(
    makeEvent('POST', { token, purpose: 'invite' })
  );
  const deviceCookie = redeemed.multiValueHeaders['Set-Cookie'][1].split(';')[0];
  const invitation = (await state.stores.invitations.get(
    `invitation:${(await state.stores.invitations.get(`token:${hashToken(token)}`, { type: 'json' })).invitationId}`,
    { type: 'json' }
  ));
  const grant = await state.stores.grants.get(`grant:${invitation.grantId}`, { type: 'json' });

  state.setNow(state.now + GUEST_SESSION_LIFETIME_SECONDS * 1000 + 1000);
  const sessionHandler = createCatalogGuestSessionHandler(state.dependencies);
  assert.equal((await sessionHandler(makeEvent('GET', undefined, deviceCookie))).statusCode, 401);
  const refreshed = await createCatalogGuestRedeemHandler(state.dependencies)(
    makeEvent('POST', { token, purpose: 'invite' }, deviceCookie)
  );
  assert.equal(refreshed.statusCode, 200);
  assert.equal(responseBody(refreshed).expiresAt, grant.expiresAt);
  const refreshedCookie = refreshed.multiValueHeaders['Set-Cookie'].map(cookie => cookie.split(';')[0]).join('; ');
  const viewerAccess = await createCatalogGuestPdfHandler(state.dependencies)(
    makeEvent('GET', undefined, refreshedCookie)
  );
  assert.equal(viewerAccess.statusCode, 200);
});

test('shared devices cannot recover another customer after missing, invalid, expired or revoked sessions', async () => {
  const state = fixture();
  const firstToken = await inviteCustomer(state, '3-months', 'alice@example.com', 'Alice Seller');
  state.dependencies.getEmployeeSession = async () => ({
    email: 'other@primelinedist.com', resource: 'catalog-pdf', expiresAt: state.now + 60000
  });
  const secondToken = await inviteCustomer(state, 'permanent', 'bob@example.com', 'Bob Seller');
  const redeem = createCatalogGuestRedeemHandler(state.dependencies);
  const first = await redeem(makeEvent('POST', { token: firstToken, purpose: 'invite' }));
  const second = await redeem(makeEvent('POST', { token: secondToken, purpose: 'invite' }));
  const cookie = response => response.multiValueHeaders['Set-Cookie'].map(value => value.split(';')[0]).join('; ');
  const firstCookie = cookie(first);
  const secondCookie = cookie(second);
  const deviceCookie = first.multiValueHeaders['Set-Cookie'][1].split(';')[0];
  const sessionHandler = createCatalogGuestSessionHandler(state.dependencies);
  const transfer = createCatalogGuestTransferHandler({ ...state.dependencies, getSigningSecret: () => transferSecret });
  for (const [cookies, customer, salesperson] of [
    [firstCookie, 'alice@example.com', 'sales@primelinedist.com'],
    [secondCookie, 'bob@example.com', 'other@primelinedist.com']
  ]) {
    assert.equal((await sessionHandler(makeEvent('GET', undefined, cookies))).statusCode, 200);
    const response = await transfer(makeEvent('POST', undefined, cookies));
    const payload = JSON.parse(Buffer.from(responseBody(response).credential.split('.')[1], 'base64url'));
    assert.equal(payload.customerEmail, customer);
    assert.equal(payload.sharedBy, salesperson);
  }
  for (const cookies of [deviceCookie, `${deviceCookie}; __Host-pl-guest-catalog-session=invalid`]) {
    assert.equal((await sessionHandler(makeEvent('GET', undefined, cookies))).statusCode, 401);
    assert.equal((await transfer(makeEvent('POST', undefined, cookies))).statusCode, 401);
  }

  const firstSessionId = firstCookie.match(/__Host-pl-guest-catalog-session=([^;]+)/)[1];
  const firstSession = await state.stores.sessions.get(`session:${firstSessionId}`, { type: 'json' });
  const firstGrant = await state.stores.grants.get(`grant:${firstSession.grantId}`, { type: 'json' });
  await state.stores.grants.setJSON(`grant:${firstGrant.id}`, { ...firstGrant, status: 'revoked', revokedAt: state.now });
  assert.equal((await sessionHandler(makeEvent('GET', undefined, firstCookie))).statusCode, 401);
  assert.equal((await transfer(makeEvent('POST', undefined, firstCookie))).statusCode, 401);
  assert.equal((await sessionHandler(makeEvent('GET', undefined, secondCookie))).statusCode, 200);
  await state.stores.grants.delete(`grant:${firstGrant.id}`);
  assert.equal((await sessionHandler(makeEvent('GET', undefined, firstCookie))).statusCode, 401);

  state.setNow(state.now + GUEST_SESSION_LIFETIME_SECONDS * 1000 + 1);
  assert.equal((await sessionHandler(makeEvent('GET', undefined, secondCookie))).statusCode, 401);
  assert.equal((await sessionHandler(makeEvent('GET', undefined, deviceCookie))).statusCode, 401);
  assert.equal((await transfer(makeEvent('POST', undefined, secondCookie))).statusCode, 401);
});

test('email recovery offers an explicit link for each salesperson and preserves the selected grant', async () => {
  const state = fixture();
  const firstToken = await inviteCustomer(state, '3-months', 'buyer@example.com', 'First Seller');
  state.dependencies.getEmployeeSession = async () => ({
    email: 'other@primelinedist.com', resource: 'catalog-pdf', expiresAt: state.now + 60000
  });
  const secondToken = await inviteCustomer(state, 'permanent', 'buyer@example.com', 'Second Seller');
  const redeem = createCatalogGuestRedeemHandler(state.dependencies);
  await redeem(makeEvent('POST', { token: firstToken, purpose: 'invite' }));
  await redeem(makeEvent('POST', { token: secondToken, purpose: 'invite' }));
  const invitations = await Promise.all([firstToken, secondToken].map(async token => {
    const pointer = await state.stores.invitations.get(`token:${hashToken(token)}`, { type: 'json' });
    return state.stores.invitations.get(`invitation:${pointer.invitationId}`, { type: 'json' });
  }));
  const response = await createCatalogGuestRequestLinkHandler(state.dependencies)(
    makeEvent('POST', { email: 'Buyer@Example.com' })
  );
  assert.equal(response.statusCode, 202);
  const message = state.emails.at(-1);
  assert.match(message.text, /First Seller.*sales@primelinedist\.com/);
  assert.match(message.text, /Second Seller.*other@primelinedist\.com/);
  for (const invitation of invitations) assert.ok(message.text.includes(invitation.id));
  const tokens = [...message.text.matchAll(/#verify=([A-Za-z0-9_-]{43})/g)].map(match => match[1]);
  assert.equal(tokens.length, 2);
  const transfer = createCatalogGuestTransferHandler({ ...state.dependencies, getSigningSecret: () => transferSecret });
  for (const token of tokens) {
    const pointer = await state.stores.verifications.get(`token:${hashToken(token)}`, { type: 'json' });
    const invitation = invitations.find(item => item.grantId === pointer.grantId);
    assert.ok(invitation);
    const recovered = await redeem(makeEvent('POST', { token, purpose: 'verify' }));
    assert.equal(recovered.statusCode, 200);
    const cookies = recovered.multiValueHeaders['Set-Cookie'].map(value => value.split(';')[0]).join('; ');
    const id = cookies.match(/__Host-pl-guest-catalog-session=([^;]+)/)[1];
    const session = await state.stores.sessions.get(`session:${id}`, { type: 'json' });
    const grant = await state.stores.grants.get(`grant:${session.grantId}`, { type: 'json' });
    assert.equal(grant.id, invitation.grantId);
    assert.equal(grant.invitationId, invitation.id);
    assert.equal(grant.expiresAt, invitation.expiresAt);
    assert.equal(grant.sharedBy, invitation.sharedBy);
    const signed = await transfer(makeEvent('POST', undefined, cookies));
    const claims = JSON.parse(Buffer.from(responseBody(signed).credential.split('.')[1], 'base64url'));
    assert.equal(claims.customerEmail, invitation.customerEmail);
    assert.equal(claims.sharedBy, invitation.sharedBy);
  }
});

test('a verification link cannot fall through to another grant after its invitation is revoked or deleted', async () => {
  for (const action of ['revoke', 'delete']) {
    const state = fixture();
    const firstToken = await inviteCustomer(state, '3-months');
    state.dependencies.getEmployeeSession = async () => ({
      email: 'other@primelinedist.com', resource: 'catalog-pdf', expiresAt: state.now + 60000
    });
    const secondToken = await inviteCustomer(state, 'permanent');
    const redeem = createCatalogGuestRedeemHandler(state.dependencies);
    await redeem(makeEvent('POST', { token: firstToken, purpose: 'invite' }));
    await redeem(makeEvent('POST', { token: secondToken, purpose: 'invite' }));
    const pointer = await state.stores.invitations.get(`token:${hashToken(firstToken)}`, { type: 'json' });
    const invitation = await state.stores.invitations.get(`invitation:${pointer.invitationId}`, { type: 'json' });
    await createCatalogGuestRequestLinkHandler(state.dependencies)(makeEvent('POST', { email: 'buyer@example.com' }));
    const tokens = [...state.emails.at(-1).text.matchAll(/#verify=([A-Za-z0-9_-]{43})/g)].map(match => match[1]);
    const pairs = await Promise.all(tokens.map(async token => ({
      token, pointer: await state.stores.verifications.get(`token:${hashToken(token)}`, { type: 'json' })
    })));
    const selected = pairs.find(pair => pair.pointer.grantId === invitation.grantId);
    const other = pairs.find(pair => pair.pointer.grantId !== invitation.grantId);
    const admin = createCatalogGuestAdminHandler({
      ...state.dependencies, authorizeAdmin: async () => ({ ok: true, session: { email: ADMIN_EMAIL } })
    });
    const request = action === 'revoke'
      ? { action, grantId: invitation.grantId }
      : { action, recordType: 'grant', id: invitation.grantId };
    assert.equal((await admin(makeEvent('POST', request))).statusCode, 200);
    assert.equal((await redeem(makeEvent('POST', { token: selected.token, purpose: 'verify' }))).statusCode, 401);
    const recovered = await redeem(makeEvent('POST', { token: other.token, purpose: 'verify' }));
    assert.equal(recovered.statusCode, 200);
    assert.equal(responseBody(recovered).sharedBy, 'other@primelinedist.com');
  }
});

test('permanent grants create only seven-day browser sessions and remain revocable', async () => {
  const state = fixture();
  const token = await inviteCustomer(state, 'permanent');
  const response = await createCatalogGuestRedeemHandler(state.dependencies)(
    makeEvent('POST', { token, purpose: 'invite' })
  );
  assert.equal(response.statusCode, 200);
  const cookie = response.multiValueHeaders['Set-Cookie'][0];
  assert.match(cookie, new RegExp(`Max-Age=${GUEST_SESSION_LIFETIME_SECONDS}`));
  const sessionId = cookie.match(/__Host-pl-guest-catalog-session=([^;]+)/)?.[1];
  const session = await state.stores.sessions.get(`session:${sessionId}`, { type: 'json' });
  const grant = await state.stores.grants.get(`grant:${session.grantId}`, { type: 'json' });
  assert.equal(grant.expiresAt, null);
  assert.equal(session.expiresAt, state.now + GUEST_SESSION_LIFETIME_SECONDS * 1000);

  const adminHandler = createCatalogGuestAdminHandler({
    ...state.dependencies,
    authorizeAdmin: async () => ({ ok: true, session: { email: 'pietro@primelinedist.com' } })
  });
  const revoke = await adminHandler(makeEvent('POST', { action: 'revoke', grantId: grant.id }));
  assert.equal(revoke.statusCode, 200);
  const sessionResponse = await createCatalogGuestSessionHandler(state.dependencies)(
    makeEvent('GET', undefined, cookie.split(';')[0])
  );
  assert.equal(sessionResponse.statusCode, 401);
});

test('expired guest browser sessions are deleted while grants remain independent', async () => {
  const state = fixture();
  const grant = {
    id: '98bd32e1-9af0-42fd-a1e8-a966e3d4579d',
    email: 'buyer@example.com',
    duration: 'permanent',
    createdAt: state.now,
    expiresAt: null,
    revokedAt: null,
    status: 'active'
  };
  const sessionId = 'c184cbba-94d8-4c8f-a565-ec2c149b8bd9';
  await state.stores.grants.setJSON(`grant:${grant.id}`, grant);
  await state.stores.sessions.setJSON(`session:${sessionId}`, {
    email: grant.email,
    grantId: grant.id,
    resource: 'catalog-guest',
    createdAt: state.now - 10_000,
    expiresAt: state.now - 1
  });
  const response = await createCatalogGuestSessionHandler(state.dependencies)(
    makeEvent('GET', undefined, `__Host-pl-guest-catalog-session=${sessionId}`)
  );
  assert.equal(response.statusCode, 401);
  assert.equal(await state.stores.sessions.get(`session:${sessionId}`), null);
  assert.ok(await state.stores.grants.get(`grant:${grant.id}`, { type: 'json' }));
});

test('active guests can request a one-use verification link without extending the grant', async () => {
  const state = fixture();
  const grant = {
    id: '98bd32e1-9af0-42fd-a1e8-a966e3d4579d',
    email: 'buyer@example.com',
    duration: '7-days',
    createdAt: state.now - 1000,
    expiresAt: state.now + 6 * 24 * 60 * 60 * 1000,
    revokedAt: null,
    status: 'active'
  };
  await state.stores.grants.setJSON(`grant:${grant.id}`, grant);

  const request = await createCatalogGuestRequestLinkHandler(state.dependencies)(
    makeEvent('POST', { email: 'Buyer@Example.com' })
  );
  assert.equal(request.statusCode, 202);
  assert.equal(state.emails.length, 1);
  const token = emailToken(state.emails[0], 'verify');
  const redeemed = await createCatalogGuestRedeemHandler(state.dependencies)(
    makeEvent('POST', { token, purpose: 'verify' })
  );
  assert.equal(redeemed.statusCode, 200);
  assert.equal(responseBody(redeemed).expiresAt, grant.expiresAt);
  assert.equal((await state.stores.grants.get(`grant:${grant.id}`, { type: 'json' })).expiresAt, grant.expiresAt);

  const replay = await createCatalogGuestRedeemHandler(state.dependencies)(
    makeEvent('POST', { token, purpose: 'verify' })
  );
  assert.equal(replay.statusCode, 409);
});

test('verification requests do not send links for unknown or expired grants', async () => {
  const state = fixture();
  const response = await createCatalogGuestRequestLinkHandler(state.dependencies)(
    makeEvent('POST', { email: 'unknown@example.com' })
  );
  assert.equal(response.statusCode, 202);
  assert.equal(state.emails.length, 0);
});

test('guest PDF endpoint returns the existing public catalog URL only after session validation', async () => {
  const state = fixture();
  const response = await createCatalogGuestPdfHandler({
    validateSession: async () => ({ session: {}, grant: {} })
  })(makeEvent('GET'));
  assert.equal(response.statusCode, 200);
  assert.equal(responseBody(response).url, CATALOG_PUBLIC_URL);

  const denied = await createCatalogGuestPdfHandler({
    validateSession: async () => null
  })(makeEvent('GET'));
  assert.equal(denied.statusCode, 401);
});

const transferSecret = 'test-only-transfer-signing-secret-123456789';

const createTransferFixture = async (duration = '7-days') => {
  const state = fixture();
  const invitationToken = await inviteCustomer(state, duration);
  const redeemed = await createCatalogGuestRedeemHandler(state.dependencies)(
    makeEvent('POST', { token: invitationToken, purpose: 'invite' })
  );
  const cookies = redeemed.multiValueHeaders['Set-Cookie'].map((cookie) => cookie.split(';')[0]).join('; ');
  const sessionId = cookies.match(/__Host-pl-guest-catalog-session=([^;]+)/)[1];
  const session = await state.stores.sessions.get(`session:${sessionId}`, { type: 'json' });
  const grant = await state.stores.grants.get(`grant:${session.grantId}`, { type: 'json' });
  const transfer = createCatalogGuestTransferHandler({
    ...state.dependencies,
    getSigningSecret: () => transferSecret
  });
  return { state, invitationToken, cookies, grant, transfer };
};

test('guest transfer signs the validated grant identity, not request data', async () => {
  const { state, grant, invitationToken, cookies, transfer } = await createTransferFixture();
  const event = makeEvent('POST', { customerEmail: 'other@example.com', sharedBy: 'other@primelinedist.com', pdfGrantId: randomUUID() }, cookies);
  const response = await transfer(event);
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['Cache-Control'], 'no-store');
  assert.equal(response.headers['Referrer-Policy'], 'no-referrer');

  const credential = responseBody(response).credential;
  const [headerPart, payloadPart, signature] = credential.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(headerPart, 'base64url')), { alg: 'HS256', typ: 'JWT' });
  assert.equal(signature, createHmac('sha256', transferSecret).update(`${headerPart}.${payloadPart}`).digest('base64url'));
  const claims = JSON.parse(Buffer.from(payloadPart, 'base64url'));
  assert.equal(claims.customerEmail, 'buyer@example.com');
  assert.equal(claims.sharedBy, 'sales@primelinedist.com');
  assert.equal(claims.pdfGrantId, grant.id);
  assert.equal(claims.pdfGrantExpiresAt, Math.floor(grant.expiresAt / 1000));
  assert.equal(claims.source, 'pdf_catalog_share');
  assert.equal(claims.iss, 'https://primelinedist.com');
  assert.equal(claims.aud, 'https://catalog.primelinedist.com');
  assert.equal(claims.iat, Math.floor(state.now / 1000));
  assert.equal(claims.exp, claims.iat + 300);
  assert.match(claims.jti, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(JSON.stringify(claims).includes(invitationToken), false);
  assert.equal(JSON.stringify(claims).includes(cookies), false);

  const next = responseBody(await transfer(event)).credential;
  assert.notEqual(JSON.parse(Buffer.from(next.split('.')[1], 'base64url')).jti, claims.jti);
});

test('guest transfer expiration is capped by finite grants and five minutes for permanent grants', async () => {
  const finite = await createTransferFixture();
  finite.grant.expiresAt = finite.state.now + 74_999;
  await finite.state.stores.grants.setJSON(`grant:${finite.grant.id}`, finite.grant);
  const response = await finite.transfer(makeEvent('POST', undefined, finite.cookies));
  const claims = JSON.parse(Buffer.from(responseBody(response).credential.split('.')[1], 'base64url'));
  assert.equal(claims.exp, Math.floor(finite.grant.expiresAt / 1000));
  assert.ok(claims.exp * 1000 <= finite.grant.expiresAt);
  assert.ok(claims.exp - claims.iat <= 300);

  const permanent = await createTransferFixture('permanent');
  const permanentResponse = await permanent.transfer(makeEvent('POST', undefined, permanent.cookies));
  const permanentClaims = JSON.parse(Buffer.from(responseBody(permanentResponse).credential.split('.')[1], 'base64url'));
  assert.equal(permanentClaims.exp - permanentClaims.iat, 300);
  assert.equal(permanentClaims.pdfGrantExpiresAt, null);

  finite.state.setNow(finite.grant.expiresAt - 500);
  assert.equal((await finite.transfer(makeEvent('POST', undefined, finite.cookies))).statusCode, 401);
  finite.state.setNow(finite.grant.expiresAt);
  assert.equal((await finite.transfer(makeEvent('POST', undefined, finite.cookies))).statusCode, 401);
});

test('guest transfer rejects missing sessions, expired or revoked grants, and wrong devices', async () => {
  const { state, grant, cookies, transfer } = await createTransferFixture();
  assert.equal((await transfer(makeEvent('POST'))).statusCode, 401);
  assert.equal((await transfer(makeEvent('POST', undefined, cookies.split('; ')[0]))).statusCode, 401);

  grant.revokedAt = state.now;
  await state.stores.grants.setJSON(`grant:${grant.id}`, grant);
  assert.equal((await transfer(makeEvent('POST', undefined, cookies))).statusCode, 401);

  grant.revokedAt = null;
  grant.expiresAt = state.now - 1;
  await state.stores.grants.setJSON(`grant:${grant.id}`, grant);
  assert.equal((await transfer(makeEvent('POST', undefined, cookies))).statusCode, 401);
});

test('guest transfer rejects cross-origin requests and unavailable signer or inviter details', async () => {
  const { state, grant, cookies, transfer } = await createTransferFixture();
  assert.equal((await transfer(makeEvent('GET', undefined, cookies))).statusCode, 405);
  const crossOrigin = makeEvent('POST', undefined, cookies);
  crossOrigin.headers.origin = 'https://example.com';
  assert.equal((await transfer(crossOrigin)).statusCode, 403);

  const unconfigured = createCatalogGuestTransferHandler({
    ...state.dependencies,
    getSigningSecret: () => ''
  });
  assert.equal((await unconfigured(makeEvent('POST', undefined, cookies))).statusCode, 503);
  grant.sharedBy = null;
  await state.stores.grants.setJSON(`grant:${grant.id}`, grant);
  assert.equal((await transfer(makeEvent('POST', undefined, cookies))).statusCode, 422);
});

test('guest Web Mode transfer requires a click and handles expired access', async () => {
  const elements = new Map();
  const element = (selector) => {
    if (!elements.has(selector)) {
      elements.set(selector, {
        hidden: true,
        disabled: false,
        textContent: '',
        classList: { toggle() {} },
        listeners: {},
        addEventListener(type, handler) { this.listeners[type] = handler; },
        querySelector() { return { textContent: '' }; }
      });
    }
    return elements.get(selector);
  };
  const requests = [];
  const redirects = [];
  let transferStatus = 200;
  const fetch = async (url) => {
    requests.push(url);
    if (url.endsWith('/session')) {
      return { status: 200, ok: true, json: async () => ({ authenticated: true, resource: 'catalog-guest', expiresAt: null }) };
    }
    if (url.endsWith('/pdf')) return { status: 200, ok: true };
    return { status: transferStatus, ok: transferStatus === 200, json: async () => ({ credential: 'header.payload.signature' }) };
  };
  const script = readFileSync(new URL('../../catalog-pdf/guest/guest-catalog.js', import.meta.url), 'utf8');
  runInNewContext(script, {
    document: { querySelector: element },
    location: { hash: '', pathname: '/catalog-pdf/guest/', search: '' },
    window: { location: { assign: (url) => redirects.push(url) } },
    URLSearchParams,
    fetch,
    setTimeout: () => 1,
    clearTimeout() {}
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(element('#catalogMode').hidden, false);
  assert.equal(requests.includes('/api/catalog/guest/transfer'), false);
  assert.deepEqual(redirects, []);

  await element('#guestWebTransfer').listeners.click();
  assert.deepEqual(redirects, ['https://catalog.primelinedist.com/#pdf_transfer=header.payload.signature']);

  transferStatus = 503;
  await element('#guestWebTransfer').listeners.click();
  assert.equal(redirects.length, 1);
  assert.match(element('#guestStatus').textContent, /could not be opened/i);
  assert.equal(element('#guestWebTransfer').disabled, false);

  transferStatus = 401;
  await element('#guestWebTransfer').listeners.click();
  assert.equal(redirects.length, 1);
  assert.equal(element('#guestRenewPanel').hidden, false);
  assert.equal(element('#catalogMode').hidden, true);
});

test('Catalog Mode remains hidden while an invitation is being redeemed', async () => {
  const elements = new Map();
  const element = (selector) => {
    if (!elements.has(selector)) {
      elements.set(selector, {
        hidden: true,
        classList: { toggle() {} },
        addEventListener() {},
        querySelector() { return {}; }
      });
    }
    return elements.get(selector);
  };
  const requests = [];
  let release;
  const waiting = new Promise(resolve => { release = resolve; });
  const context = {
    document: { querySelector: element },
    location: { hash: '#invite=sample', pathname: '/catalog-pdf/guest/', search: '' },
    history: { replaceState() {} },
    URLSearchParams,
    fetch: async (url) => {
      requests.push(url);
      await waiting;
      return { status: 401, ok: false, json: async () => ({ error: 'Invalid invitation.' }) };
    },
    setTimeout,
    clearTimeout
  };
  const script = readFileSync(new URL('../../catalog-pdf/guest/guest-catalog.js', import.meta.url), 'utf8')
    .replace('initialize();', 'globalThis.guestInitialization = initialize();');
  runInNewContext(script, context);
  assert.equal(element('#guestLinkPanel').hidden, true);
  assert.equal(element('#catalogMode').hidden, true);
  assert.deepEqual(requests, ['/api/catalog/guest/redeem']);
  release();
  await context.guestInitialization;
  assert.equal(element('#catalogMode').hidden, true);
});

test('staff Catalog Mode appears only after the employee session is verified', async () => {
  const script = readFileSync(new URL('../../catalog-pdf/catalog-pdf.js', import.meta.url), 'utf8');
  for (const result of [
    { authenticated: true, resource: 'catalog-pdf', role: 'staff' },
    { authenticated: true, resource: 'catalog-pdf', role: 'guest' }
  ]) {
    const elements = new Map();
    const element = (selector) => {
      if (!elements.has(selector)) {
        elements.set(selector, {
          hidden: true,
          classList: { toggle() {} },
          addEventListener() {},
          querySelector() { return {}; }
        });
      }
      return elements.get(selector);
    };
    const requests = [];
    runInNewContext(script, {
      document: { querySelector: element },
      fetch: async (url) => {
        requests.push(url);
        return { status: 200, ok: true, json: async () => result };
      },
      setTimeout: () => 1,
      clearTimeout() {}
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(element('#catalogMode').hidden, result.role !== 'staff');
    assert.deepEqual(requests, ['/api/access/catalog-session']);
  }
});

test('Catalog Mode explanation supports hover, focus and touch without blocking normal clicks', () => {
  const createElement = () => ({
    hidden: true,
    listeners: {},
    addEventListener(type, handler) { this.listeners[type] = handler; }
  });
  const mode = createElement();
  const switcher = createElement();
  const popover = createElement();
  mode.querySelector = (selector) => selector === '.catalog-mode-switch' ? switcher : popover;
  mode.contains = (target) => target === mode || target === switcher || target === popover;
  const doc = createElement();
  doc.querySelector = () => mode;
  let nextTimer = 0;
  const timers = new Map();
  runInNewContext(readFileSync(new URL('../../catalog-pdf/catalog-mode.js', import.meta.url), 'utf8'), {
    document: doc,
    setTimeout: (callback) => { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout: (id) => timers.delete(id)
  });

  switcher.listeners.mouseenter();
  assert.equal(popover.hidden, false);
  mode.listeners.mouseleave();
  assert.equal(popover.hidden, true);
  switcher.listeners.focusin();
  assert.equal(popover.hidden, false);
  doc.listeners.keydown({ key: 'Escape' });
  assert.equal(popover.hidden, true);
  mode.listeners.focusout({ relatedTarget: null });
  switcher.listeners.pointerdown({ pointerType: 'touch', clientX: 10, clientY: 10 });
  timers.get(nextTimer)();
  switcher.listeners.pointerup();
  assert.equal(popover.hidden, false);
  let prevented = false;
  let stopped = false;
  mode.listeners.click({ preventDefault() { prevented = true; }, stopPropagation() { stopped = true; } });
  assert.equal(prevented, true);
  assert.equal(stopped, true);
  doc.listeners.click({ target: {} });
  assert.equal(popover.hidden, true);

  switcher.listeners.pointerdown({ pointerType: 'touch', clientX: 10, clientY: 10 });
  switcher.listeners.pointerup();
  prevented = false;
  mode.listeners.click({ preventDefault() { prevented = true; }, stopPropagation() {} });
  assert.equal(prevented, false);

  switcher.listeners.pointerdown({ pointerType: 'touch', clientX: 10, clientY: 10 });
  switcher.listeners.pointermove({ clientX: 30, clientY: 10 });
  assert.equal(timers.has(nextTimer), false);
});

test('guest access cannot use the employee download endpoint', async () => {
  const response = await createCatalogStaffDownloadHandler({
    getEmployeeSession: async () => null
  })(makeEvent('GET', undefined, '__Host-pl-guest-catalog-session=guest-session'));
  assert.equal(response.statusCode, 401);
});

test('staff download requires an employee session and returns the existing public PDF as an attachment', async () => {
  const response = await createCatalogStaffDownloadHandler({
    getEmployeeSession: async () => ({ email: 'sales@primelinedist.com', resource: 'catalog-pdf' })
  })(makeEvent('GET'));
  assert.equal(response.statusCode, 302);
  assert.equal(response.headers.Location, `${CATALOG_PUBLIC_URL}?download=Prime-Line-Catalog-Autumn-2026.pdf`);
  assert.equal(response.headers['Cache-Control'], 'no-store');
});

test('guest token claims persist so sequential replays are rejected without Supabase storage', async () => {
  const store = createStore();
  const key = 'a'.repeat(64);
  const getStore = async () => store;
  assert.equal(await claimGuestToken(key, getStore), true);
  assert.equal(await claimGuestToken(key, getStore), false);
  const claim = await store.get(`claim:${key}`, { type: 'json' });
  assert.equal(typeof claim.claimedAt, 'number');
});

test('Admin guest operations require authorization and can reissue an expired invitation', async () => {
  const state = fixture();
  const originalToken = await inviteCustomer(state);
  await saveEmployeeProfile('pietro@primelinedist.com', 'Pietro Giordano', {
    getProfileStore: async () => state.stores.profiles,
    now: () => state.now
  });
  state.setNow(state.now + GUEST_INVITATION_LIFETIME_MS + 1);
  const tokenHash = hashToken(originalToken);
  const pointer = await state.stores.invitations.get(`token:${tokenHash}`, { type: 'json' });
  const handler = createCatalogGuestAdminHandler({
    ...state.dependencies,
    authorizeAdmin: async () => ({ ok: true, session: { email: 'pietro@primelinedist.com' } })
  });
  const response = await handler(makeEvent('POST', { action: 'reissue', invitationId: pointer.invitationId }));
  assert.equal(response.statusCode, 200);
  assert.equal(state.emails.length, 2);
  assert.notEqual(emailToken(state.emails[1], 'invite'), originalToken);
  assert.equal(state.emails[1].invitation.sharedBy, 'pietro@primelinedist.com');
  assert.equal(state.emails[1].invitation.sharedByName, 'Pietro Giordano');

  const denied = await createCatalogGuestAdminHandler({
    ...state.dependencies,
    authorizeAdmin: async () => ({ ok: false, reason: 'unauthorized' })
  })(makeEvent('GET'));
  assert.equal(denied.statusCode, 401);
});

test('individual deletion requires Super Admin and invalidates only the revoked invitation', async () => {
  const state = fixture();
  const token = await inviteCustomer(state);
  const otherToken = await inviteCustomer(state);
  const redeem = createCatalogGuestRedeemHandler(state.dependencies);
  const first = await redeem(makeEvent('POST', { purpose: 'invite', token }));
  assert.equal(first.statusCode, 200);
  const cookies = first.multiValueHeaders['Set-Cookie'].map(value => value.split(';')[0]).join('; ');
  assert.equal((await createCatalogGuestPdfHandler(state.dependencies)(makeEvent('GET', undefined, cookies))).statusCode, 200);
  await createCatalogGuestRequestLinkHandler(state.dependencies)(makeEvent('POST', { email: 'buyer@example.com' }));
  const verification = emailToken(state.emails.at(-1), 'verify');
  assert.equal((await redeem(makeEvent('POST', { purpose: 'invite', token: otherToken }))).statusCode, 200);
  const pointer = await state.stores.invitations.get(`token:${hashToken(token)}`, { type: 'json' });
  const invitation = await state.stores.invitations.get(`invitation:${pointer.invitationId}`, { type: 'json' });
  const admin = createCatalogGuestAdminHandler({
    ...state.dependencies, authorizeAdmin: async () => ({ ok: true, session: { email: ADMIN_EMAIL } })
  });
  const otherAdmin = createCatalogGuestAdminHandler({
    ...state.dependencies, authorizeAdmin: async () => ({ ok: true, session: { email: 'other@primelinedist.com' } })
  });
  const request = { action: 'delete', recordType: 'grant', id: invitation.grantId };
  assert.equal((await otherAdmin(makeEvent('POST', request))).statusCode, 403);
  assert.equal((await otherAdmin(makeEvent('POST', {
    action: 'delete-expired', asOf: state.now, records: [{ recordType: 'grant', id: invitation.grantId }]
  }))).statusCode, 403);
  assert.equal((await createCatalogGuestAdminHandler({
    ...state.dependencies, authorizeAdmin: async () => ({ ok: false })
  })(makeEvent('POST', request))).statusCode, 401);
  const crossOrigin = makeEvent('POST', request);
  crossOrigin.headers.origin = 'https://other.example.com';
  assert.equal((await admin(crossOrigin)).statusCode, 403);
  assert.equal((await admin(makeEvent('POST', { action: 'revoke', grantId: invitation.grantId }))).statusCode, 200);
  assert.equal(responseBody(await admin(makeEvent('POST', {
    action: 'delete-expired', asOf: state.now, records: [{ recordType: 'grant', id: invitation.grantId }]
  }))).deleted, 0);
  assert.equal(responseBody(await admin(makeEvent('POST', request))).deleted, 1);
  assert.equal(responseBody(await admin(makeEvent('POST', request))).deleted, 0);
  const marker = await state.stores.grants.get(`grant:${invitation.grantId}`, { type: 'json' });
  assert.equal(marker.status, 'deleted');
  assert.equal(marker.revokedBy, ADMIN_EMAIL);
  assert.equal(marker.deletedBy, ADMIN_EMAIL);
  assert.equal(marker.email, undefined);
  assert.equal((await redeem(makeEvent('POST', { purpose: 'invite', token }))).statusCode, 401);
  assert.equal((await redeem(makeEvent('POST', { purpose: 'verify', token: verification }))).statusCode, 401);
  assert.equal((await createCatalogGuestPdfHandler(state.dependencies)(makeEvent('GET', undefined, cookies))).statusCode, 401);
  assert.equal((await redeem(makeEvent('POST', { purpose: 'invite', token: otherToken }))).statusCode, 200);
  assert.equal(responseBody(await admin(makeEvent('GET'))).entries.length, 1);
});

for (const duration of ['7-days', 'permanent']) {
  test(`individual deletion immediately invalidates ${duration} access without affecting another invitation`, async () => {
    const state = fixture();
    const token = await inviteCustomer(state, duration);
    const redeem = createCatalogGuestRedeemHandler(state.dependencies);
    const first = await redeem(makeEvent('POST', { purpose: 'invite', token }));
    assert.equal(first.statusCode, 200);
    const cookies = first.multiValueHeaders['Set-Cookie'].map(value => value.split(';')[0]).join('; ');
    await createCatalogGuestRequestLinkHandler(state.dependencies)(makeEvent('POST', { email: 'buyer@example.com' }));
    const verification = emailToken(state.emails.at(-1), 'verify');
    const otherToken = await inviteCustomer(state, '7-days');
    assert.equal((await redeem(makeEvent('POST', { purpose: 'invite', token: otherToken }))).statusCode, 200);
    const pointer = await state.stores.invitations.get(`token:${hashToken(token)}`, { type: 'json' });
    const invitation = await state.stores.invitations.get(`invitation:${pointer.invitationId}`, { type: 'json' });
    const transfer = createCatalogGuestTransferHandler({
      ...state.dependencies, getSigningSecret: () => 'test-only-secret-that-is-long-enough'
    });
    assert.equal((await transfer(makeEvent('POST', {}, cookies))).statusCode, 200);
    const admin = createCatalogGuestAdminHandler({
      ...state.dependencies, authorizeAdmin: async () => ({ ok: true, session: { email: ADMIN_EMAIL } })
    });
    const rows = responseBody(await admin(makeEvent('GET'))).entries;
    const target = rows.find(row => row.id === invitation.grantId);
    assert.equal(target.canDelete, true);
    assert.equal(target.canBulkDelete, false);
    assert.equal(responseBody(await admin(makeEvent('POST', {
      action: 'delete-expired', asOf: state.now, records: [{ recordType: 'grant', id: invitation.grantId }]
    }))).deleted, 0);
    assert.equal(responseBody(await admin(makeEvent('POST', {
      action: 'delete', recordType: 'grant', id: invitation.grantId
    }))).deleted, 1);
    assert.equal((await transfer(makeEvent('POST', {}, cookies))).statusCode, 401);
    assert.equal((await createCatalogGuestPdfHandler(state.dependencies)(makeEvent('GET', undefined, cookies))).statusCode, 401);
    assert.equal((await redeem(makeEvent('POST', { purpose: 'verify', token: verification }))).statusCode, 401);
    assert.equal((await redeem(makeEvent('POST', { purpose: 'invite', token }))).statusCode, 401);
    assert.equal((await redeem(makeEvent('POST', { purpose: 'invite', token: otherToken }))).statusCode, 200);
    assert.equal((await state.stores.grants.get(`grant:${invitation.grantId}`, { type: 'json' })).deletedBy, ADMIN_EMAIL);
  });
}

test('all invitation states display delete only for Super Admin', async () => {
  const state = fixture();
  for (const [status, duration] of [['pending', '7-days'], ['revoked', '7-days'], ['reissued', '7-days'], ['pending', 'permanent']]) {
    const id = randomUUID();
    await state.stores.invitations.setJSON(`invitation:${id}`, {
      id, grantId: randomUUID(), customerEmail: 'buyer@example.com', duration, status,
      expiresAt: state.now + 100, usedAt: null
    });
  }
  const grantId = randomUUID();
  await state.stores.grants.setJSON(`grant:${grantId}`, {
    id: grantId, invitationId: randomUUID(), duration: '7-days', status: 'active', expiresAt: state.now + 100
  });
  for (const [email, allowed] of [[ADMIN_EMAIL, true], ['other@primelinedist.com', false]]) {
    const admin = createCatalogGuestAdminHandler({
      ...state.dependencies, authorizeAdmin: async () => ({ ok: true, session: { email } })
    });
    const rows = responseBody(await admin(makeEvent('GET'))).entries;
    assert.equal(rows.length, 5);
    assert.ok(rows.every(row => row.canDelete === allowed));
  }
});

test('deleting a pending invitation during activation blocks grant creation', async () => {
  const state = fixture();
  const token = await inviteCustomer(state, 'permanent');
  const pointer = await state.stores.invitations.get(`token:${hashToken(token)}`, { type: 'json' });
  const invitation = await state.stores.invitations.get(`invitation:${pointer.invitationId}`, { type: 'json' });
  const original = state.stores.grants.setJSON.bind(state.stores.grants);
  let release, entered;
  const waiting = new Promise(resolve => { entered = resolve; });
  const blocked = new Promise(resolve => { release = resolve; });
  state.stores.grants.setJSON = async (key, value, options) => {
    if (key === `grant:${invitation.grantId}` && value.status === 'active') {
      entered();
      await blocked;
    }
    return original(key, value, options);
  };
  const redemption = createCatalogGuestRedeemHandler(state.dependencies)(makeEvent('POST', { purpose: 'invite', token }));
  await waiting;
  const admin = createCatalogGuestAdminHandler({
    ...state.dependencies, authorizeAdmin: async () => ({ ok: true, session: { email: ADMIN_EMAIL } })
  });
  assert.equal(responseBody(await admin(makeEvent('POST', {
    action: 'delete', recordType: 'invitation', id: invitation.id
  }))).deleted, 1);
  release();
  assert.equal((await redemption).statusCode, 401);
  assert.equal((await state.stores.grants.get(`grant:${invitation.grantId}`, { type: 'json' })).status, 'deleted');
});

test('concurrent deletion by grant and invitation counts the record only once', async () => {
  const state = fixture();
  const token = await inviteCustomer(state, 'permanent');
  await createCatalogGuestRedeemHandler(state.dependencies)(makeEvent('POST', { purpose: 'invite', token }));
  const pointer = await state.stores.invitations.get(`token:${hashToken(token)}`, { type: 'json' });
  const invitation = await state.stores.invitations.get(`invitation:${pointer.invitationId}`, { type: 'json' });
  const admin = createCatalogGuestAdminHandler({
    ...state.dependencies, authorizeAdmin: async () => ({ ok: true, session: { email: ADMIN_EMAIL } })
  });
  const results = await Promise.all([
    admin(makeEvent('POST', { action: 'delete', recordType: 'invitation', id: invitation.id })),
    admin(makeEvent('POST', { action: 'delete', recordType: 'grant', id: invitation.grantId }))
  ]);
  assert.ok(results.every(response => response.statusCode === 200));
  assert.equal(results.reduce((total, response) => total + responseBody(response).deleted, 0), 1);
  assert.equal((await state.stores.grants.get(`grant:${invitation.grantId}`, { type: 'json' })).status, 'deleted');
  assert.equal((await state.stores.invitations.get(`invitation:${invitation.id}`, { type: 'json' })).status, 'deleted');
});

test('bulk deletion removes only expired non-permanent records, preserving audit and other access', async () => {
  const state = fixture();
  const admin = createCatalogGuestAdminHandler({
    ...state.dependencies, authorizeAdmin: async () => ({ ok: true, session: { email: ADMIN_EMAIL } })
  });
  const makeInvitation = async (duration, status, expiresAt) => {
    const id = randomUUID();
    await state.stores.invitations.setJSON(`invitation:${id}`, {
      id, grantId: randomUUID(), customerEmail: 'same@example.com', sharedBy: 'sales@primelinedist.com',
      duration, status, expiresAt, createdAt: state.now - 100, usedAt: null
    });
    return id;
  };
  const expired = await makeInvitation('7-days', 'pending', state.now - 1);
  const valid = await makeInvitation('7-days', 'pending', state.now + 100);
  const revokedValid = await makeInvitation('7-days', 'revoked', state.now + 100);
  const permanent = await makeInvitation('permanent', 'pending', state.now - 1);
  const grantId = randomUUID();
  const invitationId = randomUUID();
  await state.stores.invitations.setJSON(`invitation:${invitationId}`, {
    id: invitationId, grantId, usedAt: state.now - 200, duration: '7-days', status: 'redeemed',
    customerEmail: 'same@example.com', expiresAt: state.now - 1
  });
  await state.stores.grants.setJSON(`grant:${grantId}`, {
    id: grantId, invitationId, duration: '7-days', status: 'active', expiresAt: state.now - 1,
    email: 'same@example.com', deviceResetAudit: [{ action: 'reset-authorized-devices', timestamp: state.now - 100 }]
  });
  const permanentGrantId = randomUUID();
  await state.stores.grants.setJSON(`grant:${permanentGrantId}`, {
    id: permanentGrantId, invitationId: randomUUID(), duration: 'permanent', status: 'active',
    expiresAt: null, revokedAt: state.now - 1, email: 'same@example.com'
  });
  const rows = responseBody(await admin(makeEvent('GET'))).entries;
  assert.equal(rows.filter(row => row.canBulkDelete).length, 2);
  assert.equal(responseBody(await admin(makeEvent('POST', {
    action: 'delete-expired', asOf: state.now,
    records: rows.filter(row => row.canBulkDelete).map(({ recordType, id }) => ({ recordType, id }))
  }))).deleted, 2);
  assert.equal((await state.stores.invitations.get(`invitation:${expired}`, { type: 'json' })).status, 'deleted');
  assert.equal((await state.stores.invitations.get(`invitation:${invitationId}`, { type: 'json' })).status, 'deleted');
  assert.equal((await state.stores.grants.get(`grant:${grantId}`, { type: 'json' })).deviceResetAudit.length, 1);
  for (const id of [valid, revokedValid, permanent]) {
    assert.notEqual((await state.stores.invitations.get(`invitation:${id}`, { type: 'json' })).status, 'deleted');
  }
  for (const [recordType, id] of [['invitation', valid], ['invitation', permanent], ['grant', permanentGrantId]]) {
    assert.equal(responseBody(await admin(makeEvent('POST', { action: 'delete', recordType, id }))).deleted, 1);
  }
  assert.equal(responseBody(await admin(makeEvent('POST', { action: 'delete', recordType: 'invitation', id: revokedValid }))).deleted, 1);
});

test('concurrent renewal and deletion recheck eligibility with conditional writes', async () => {
  const state = fixture();
  const id = randomUUID();
  await state.stores.grants.setJSON(`grant:${id}`, {
    id, invitationId: randomUUID(), duration: '7-days', status: 'active', expiresAt: state.now - 1
  });
  const original = state.stores.grants.setJSON.bind(state.stores.grants);
  let raced = false;
  state.stores.grants.setJSON = async (key, value, options) => {
    if (!raced && value.status === 'deleted') {
      raced = true;
      const current = await state.stores.grants.get(key, { type: 'json' });
      await original(key, { ...current, expiresAt: state.now + 10000 });
    }
    return original(key, value, options);
  };
  const admin = createCatalogGuestAdminHandler({
    ...state.dependencies, authorizeAdmin: async () => ({ ok: true, session: { email: ADMIN_EMAIL } })
  });
  assert.equal(responseBody(await admin(makeEvent('POST', {
    action: 'delete-expired', asOf: state.now, records: [{ recordType: 'grant', id }]
  }))).deleted, 0);
  assert.equal((await state.stores.grants.get(`grant:${id}`, { type: 'json' })).expiresAt, state.now + 10000);
});

test('individual deletion wins a concurrent renewal without losing the updated audit', async () => {
  const state = fixture();
  const id = randomUUID();
  await state.stores.grants.setJSON(`grant:${id}`, {
    id, invitationId: randomUUID(), duration: '7-days', status: 'active', expiresAt: state.now + 100
  });
  const original = state.stores.grants.setJSON.bind(state.stores.grants);
  let raced = false;
  state.stores.grants.setJSON = async (key, value, options) => {
    if (!raced && value.status === 'deleted') {
      raced = true;
      const current = await state.stores.grants.get(key, { type: 'json' });
      await original(key, {
        ...current, expiresAt: state.now + 10000,
        deviceResetAudit: [{ action: 'reset-authorized-devices', timestamp: state.now }]
      });
    }
    return original(key, value, options);
  };
  const admin = createCatalogGuestAdminHandler({
    ...state.dependencies, authorizeAdmin: async () => ({ ok: true, session: { email: ADMIN_EMAIL } })
  });
  assert.equal(responseBody(await admin(makeEvent('POST', { action: 'delete', recordType: 'grant', id }))).deleted, 1);
  const marker = await state.stores.grants.get(`grant:${id}`, { type: 'json' });
  assert.equal(marker.originalExpiresAt, state.now + 10000);
  assert.equal(marker.deviceResetAudit.length, 1);
});

test('individual deletion refuses conflicting invitation links without changing another grant', async () => {
  const state = fixture();
  const id = randomUUID();
  const grantId = randomUUID();
  await state.stores.invitations.setJSON(`invitation:${id}`, {
    id, grantId, duration: '7-days', status: 'pending', expiresAt: state.now + 100
  });
  const grant = {
    id: grantId, invitationId: randomUUID(), duration: 'permanent', status: 'active', expiresAt: null
  };
  await state.stores.grants.setJSON(`grant:${grantId}`, grant);
  const admin = createCatalogGuestAdminHandler({
    ...state.dependencies, authorizeAdmin: async () => ({ ok: true, session: { email: ADMIN_EMAIL } })
  });
  assert.equal((await admin(makeEvent('POST', { action: 'delete', recordType: 'invitation', id }))).statusCode, 503);
  assert.deepEqual(await state.stores.grants.get(`grant:${grantId}`, { type: 'json' }), grant);
  assert.equal((await state.stores.invitations.get(`invitation:${id}`, { type: 'json' })).status, 'pending');
});

test('a concurrent revocation is preserved in the deletion audit', async () => {
  const state = fixture();
  const id = randomUUID();
  await state.stores.grants.setJSON(`grant:${id}`, {
    id, invitationId: randomUUID(), duration: '7-days', status: 'active', expiresAt: state.now - 1
  });
  const original = state.stores.grants.setJSON.bind(state.stores.grants);
  let raced = false;
  state.stores.grants.setJSON = async (key, value, options) => {
    if (!raced && value.status === 'deleted') {
      raced = true;
      const current = await state.stores.grants.get(key, { type: 'json' });
      await original(key, { ...current, revokedAt: state.now, revokedBy: ADMIN_EMAIL });
    }
    return original(key, value, options);
  };
  const admin = createCatalogGuestAdminHandler({
    ...state.dependencies, authorizeAdmin: async () => ({ ok: true, session: { email: ADMIN_EMAIL } })
  });
  assert.equal(responseBody(await admin(makeEvent('POST', { action: 'delete', recordType: 'grant', id }))).deleted, 1);
  const marker = await state.stores.grants.get(`grant:${id}`, { type: 'json' });
  assert.equal(marker.revokedAt, state.now);
  assert.equal(marker.revokedBy, ADMIN_EMAIL);
});

test('deletion fails closed when storage lacks conditional writes', async () => {
  const state = fixture();
  const id = randomUUID();
  await state.stores.invitations.setJSON(`invitation:${id}`, {
    id, grantId: randomUUID(), duration: '7-days', status: 'pending', expiresAt: state.now - 1
  });
  const original = state.stores.invitations.setJSON.bind(state.stores.invitations);
  state.stores.invitations.setJSON = async (key, value) => {
    await original(key, value);
  };
  const admin = createCatalogGuestAdminHandler({
    ...state.dependencies, authorizeAdmin: async () => ({ ok: true, session: { email: ADMIN_EMAIL } })
  });
  assert.equal((await admin(makeEvent('POST', { action: 'delete', recordType: 'invitation', id }))).statusCode, 503);
  assert.equal((await state.stores.invitations.get(`invitation:${id}`, { type: 'json' })).status, 'pending');
});

test('bulk deletion uses the confirmed expiry cutoff and excludes later expirations', async () => {
  const state = fixture();
  const id = randomUUID();
  await state.stores.invitations.setJSON(`invitation:${id}`, {
    id, grantId: randomUUID(), customerEmail: 'buyer@example.com', duration: '7-days',
    status: 'pending', expiresAt: state.now + 1, usedAt: null
  });
  const asOf = state.now;
  state.setNow(asOf + 2);
  const admin = createCatalogGuestAdminHandler({
    ...state.dependencies, authorizeAdmin: async () => ({ ok: true, session: { email: ADMIN_EMAIL } })
  });
  const records = [{ recordType: 'invitation', id }];
  assert.equal(responseBody(await admin(makeEvent('POST', { action: 'delete-expired', asOf, records }))).deleted, 0);
  assert.equal(responseBody(await admin(makeEvent('POST', { action: 'delete-expired', asOf: state.now, records }))).deleted, 1);
  assert.equal((await admin(makeEvent('POST', { action: 'delete-expired', asOf: state.now + 1, records }))).statusCode, 400);
});

test('a concurrent activation cannot resurrect a deleted invitation and duplicate deletes count once', async () => {
  const state = fixture();
  const token = await inviteCustomer(state);
  const pointer = await state.stores.invitations.get(`token:${hashToken(token)}`, { type: 'json' });
  const key = `invitation:${pointer.invitationId}`;
  const original = state.stores.invitations.setJSON.bind(state.stores.invitations);
  let release, entered;
  const waiting = new Promise(resolve => { entered = resolve; });
  const blocked = new Promise(resolve => { release = resolve; });
  state.stores.invitations.setJSON = async (recordKey, value, options) => {
    if (recordKey === key && value.status === 'activating') {
      entered();
      await blocked;
    }
    return original(recordKey, value, options);
  };
  const redemption = createCatalogGuestRedeemHandler(state.dependencies)(makeEvent('POST', { purpose: 'invite', token }));
  await waiting;
  state.setNow(state.now + GUEST_INVITATION_LIFETIME_MS + 1);
  const admin = createCatalogGuestAdminHandler({
    ...state.dependencies, authorizeAdmin: async () => ({ ok: true, session: { email: ADMIN_EMAIL } })
  });
  const payload = { action: 'delete', recordType: 'invitation', id: pointer.invitationId };
  const results = await Promise.all([admin(makeEvent('POST', payload)), admin(makeEvent('POST', payload))]);
  assert.equal(results.reduce((sum, response) => sum + responseBody(response).deleted, 0), 1);
  release();
  assert.equal((await redemption).statusCode, 401);
  assert.equal((await state.stores.invitations.get(key, { type: 'json' })).status, 'deleted');
});

test('a failed concurrent reissue cannot restore a deleted invitation', async () => {
  const state = fixture();
  const token = await inviteCustomer(state);
  const pointer = await state.stores.invitations.get(`token:${hashToken(token)}`, { type: 'json' });
  let release, entered;
  const waiting = new Promise(resolve => { entered = resolve; });
  const blocked = new Promise(resolve => { release = resolve; });
  const admin = createCatalogGuestAdminHandler({
    ...state.dependencies,
    authorizeAdmin: async () => ({ ok: true, session: { email: ADMIN_EMAIL } }),
    sendInvitation: async () => { entered(); await blocked; return false; }
  });
  const reissue = admin(makeEvent('POST', { action: 'reissue', invitationId: pointer.invitationId }));
  await waiting;
  const deleted = await admin(makeEvent('POST', {
    action: 'delete', recordType: 'invitation', id: pointer.invitationId
  }));
  assert.equal(responseBody(deleted).deleted, 1);
  release();
  assert.equal((await reissue).statusCode, 502);
  assert.equal((await state.stores.invitations.get(`invitation:${pointer.invitationId}`, { type: 'json' })).status, 'deleted');
});
