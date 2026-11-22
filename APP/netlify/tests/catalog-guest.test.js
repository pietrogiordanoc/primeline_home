import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import {
  CATALOG_PUBLIC_URL,
  GUEST_DEVICE_COOKIE,
  GUEST_MAX_DEVICES,
  GUEST_SESSION_LIFETIME_SECONDS,
  GUEST_INVITATION_LIFETIME_MS,
  claimGuestToken,
  createGuestSession,
  getGrantExpiresAt,
  hashEmail,
  hashDeviceId,
  hashToken,
  saveEmployeeProfile,
  sendCatalogInvitationEmail,
  sendCatalogShareNotification
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
    async setJSON(key, value) {
      data.set(key, JSON.stringify(value));
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
    ...(cookie ? { cookie } : {})
  }
});

const responseBody = (response) => JSON.parse(response.body);
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
    assert.match(message.html, /used on up to 3 devices/);
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
  )).deviceHashes.length, 1);
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

test('reusable invitation permits three devices and blocks a fourth with sales guidance', async () => {
  const state = fixture();
  const token = await inviteCustomer(state);
  const redeem = createCatalogGuestRedeemHandler(state.dependencies);
  const first = await redeem(makeEvent('POST', { token, purpose: 'invite' }));
  const firstDevice = first.multiValueHeaders['Set-Cookie'][1].split(';')[0];
  const secondDevice = `${GUEST_DEVICE_COOKIE}=11111111-1111-4111-8111-111111111111`;
  const thirdDevice = `${GUEST_DEVICE_COOKIE}=22222222-2222-4222-8222-222222222222`;
  const fourthDevice = `${GUEST_DEVICE_COOKIE}=33333333-3333-4333-8333-333333333333`;

  const second = await redeem(makeEvent('POST', { token, purpose: 'invite' }, secondDevice));
  const third = await redeem(makeEvent('POST', { token, purpose: 'invite' }, thirdDevice));
  const fourth = await redeem(makeEvent('POST', { token, purpose: 'invite' }, fourthDevice));
  const invitation = (await state.stores.invitations.get(
    `invitation:${(await state.stores.invitations.get(`token:${hashToken(token)}`, { type: 'json' })).invitationId}`,
    { type: 'json' }
  ));
  const grant = await state.stores.grants.get(`grant:${invitation.grantId}`, { type: 'json' });
  const fourthResult = responseBody(fourth);

  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.equal(third.statusCode, 200);
  assert.equal(fourth.statusCode, 403);
  assert.equal(fourthResult.code, 'device_limit');
  assert.match(fourthResult.error, /contact your sales representative/i);
  assert.equal(GUEST_MAX_DEVICES, 3);
  assert.equal(grant.deviceHashes.length, 3);
  assert.equal(state.stores.sessions.data.size, 3);

  const sameFirstDevice = await redeem(makeEvent('POST', { token, purpose: 'invite' }, firstDevice));
  assert.equal(sameFirstDevice.statusCode, 200);
  assert.equal((await state.stores.grants.get(`grant:${grant.id}`, { type: 'json' })).deviceHashes.length, 3);
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

test('same device renews its short browser session while its grant is still active', async () => {
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
  const refreshed = await createCatalogGuestSessionHandler(state.dependencies)(
    makeEvent('GET', undefined, deviceCookie)
  );
  assert.equal(refreshed.statusCode, 200);
  assert.equal(responseBody(refreshed).authenticated, true);
  assert.equal(responseBody(refreshed).expiresAt, grant.expiresAt);
  assert.equal(refreshed.multiValueHeaders['Set-Cookie'].length, 2);

  const refreshedCookie = `${refreshed.multiValueHeaders['Set-Cookie'][0].split(';')[0]}; ${deviceCookie}`;
  const viewerAccess = await createCatalogGuestPdfHandler(state.dependencies)(
    makeEvent('GET', undefined, refreshedCookie)
  );
  assert.equal(viewerAccess.statusCode, 200);
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
  assert.equal(replay.statusCode, 401);
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
  const { state, invitationToken, cookies, transfer } = await createTransferFixture();
  const event = makeEvent('POST', { customerEmail: 'other@example.com', sharedBy: 'other@primelinedist.com' }, cookies);
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

test('an unredeemed invitation does not show the Catalog Mode switcher', async () => {
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
  runInNewContext(readFileSync(new URL('../../catalog-pdf/guest/guest-catalog.js', import.meta.url), 'utf8'), {
    document: { querySelector: element },
    location: { hash: '#invite=sample', pathname: '/catalog-pdf/guest/', search: '' },
    history: { replaceState() {} },
    URLSearchParams,
    fetch: async (url) => { requests.push(url); },
    setTimeout,
    clearTimeout
  });
  assert.equal(element('#guestLinkPanel').hidden, false);
  assert.equal(element('#catalogMode').hidden, true);
  assert.deepEqual(requests, []);
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
