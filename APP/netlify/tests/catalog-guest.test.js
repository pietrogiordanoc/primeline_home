import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATALOG_PUBLIC_URL,
  GUEST_SESSION_LIFETIME_SECONDS,
  GUEST_INVITATION_LIFETIME_MS,
  claimGuestToken,
  createGuestSession,
  getGrantExpiresAt,
  hashEmail,
  hashToken,
  saveEmployeeProfile,
  sendCatalogInvitationEmail
} from '../shared/catalog-guest-access.js';
import { createCatalogGuestAdminHandler } from '../functions/catalog-guest-admin.js';
import { createCatalogGuestRedeemHandler } from '../functions/catalog-guest-redeem.js';
import { createCatalogGuestRequestLinkHandler } from '../functions/catalog-guest-request-link.js';
import { createCatalogGuestSessionHandler } from '../functions/catalog-guest-session.js';
import { createCatalogGuestPdfHandler } from '../functions/catalog-guest-pdf.js';
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
    getPublicBaseUrl: () => 'https://primelinedist.com',
    rateLimit: async () => true,
    now: () => timestamp
  };
  return {
    stores,
    emails,
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
    assert.match(message.html, /expires in 48 hours and can be used once/);
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
  assert.match(cookies[0], /HttpOnly; Secure; SameSite=Strict/);
  assert.match(cookies[0], new RegExp(`Max-Age=${GUEST_SESSION_LIFETIME_SECONDS}`));
  const sessionId = cookies[0].match(/__Host-pl-guest-catalog-session=([^;]+)/)?.[1];
  const session = await state.stores.sessions.get(`session:${sessionId}`, { type: 'json' });
  assert.equal(session.resource, 'catalog-guest');
  assert.equal(session.expiresAt, state.now + GUEST_SESSION_LIFETIME_SECONDS * 1000);
  const sessionResponse = await createCatalogGuestSessionHandler(state.dependencies)(
    makeEvent('GET', undefined, cookies[0].split(';')[0])
  );
  assert.equal(responseBody(sessionResponse).sharedBy, 'sales@primelinedist.com');
  assert.equal(responseBody(sessionResponse).sharedByName, 'Taylor Morgan');
});

test('invitation redemption rejects sequential replays and persists a token claim', async () => {
  const state = fixture();
  const token = await inviteCustomer(state);
  const handler = createCatalogGuestRedeemHandler(state.dependencies);
  const first = await handler(makeEvent('POST', { token, purpose: 'invite' }));
  const replay = await handler(makeEvent('POST', { token, purpose: 'invite' }));
  assert.equal(first.statusCode, 200);
  assert.equal(replay.statusCode, 401);
  assert.equal(state.stores.grants.data.size, 1);
  assert.equal(state.stores.sessions.data.size, 1);
});

test('expired 48-hour invitations are rejected before creating a token claim', async () => {
  const state = fixture();
  const token = await inviteCustomer(state);
  state.setNow(state.now + GUEST_INVITATION_LIFETIME_MS + 1);
  const response = await createCatalogGuestRedeemHandler(state.dependencies)(
    makeEvent('POST', { token, purpose: 'invite' })
  );
  assert.equal(response.statusCode, 401);
  assert.equal(state.claims.data.size, 0);
  assert.equal(state.stores.grants.data.size, 0);
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
