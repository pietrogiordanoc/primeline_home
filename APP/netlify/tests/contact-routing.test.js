import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTACT_ROUTING_CONFIG_KEY,
  CONTACT_ROUTING_STORE_NAME,
  isProductionContext,
  loadRoutingConfig,
  normalizeUsState,
  resolveRecipients,
  saveRoutingConfig,
  validateRoutingConfig
} from '../shared/contact-routing.js';
import { adaptNetlifyHandler } from '../shared/adapt-netlify-handler.js';
import sendContact, {
  buildContactSubject,
  processContactEvent as contactHandler
} from '../functions/send-contact.js';
import adminRoutingHandler from '../functions/contact-routing-admin.js';

const validSubmission = {
  inquiryType: 'Product Inquiry',
  firstName: 'Alex',
  lastName: 'Buyer',
  email: 'alex@example.com',
  companyName: 'Example Foods',
  businessType: 'Restaurant / Hotel',
  phone: '555-0100',
  website: 'https://example.com',
  address1: '10 Main Street',
  address2: '',
  city: 'New York',
  state: 'NY',
  postalCode: '10001',
  country: 'US',
  message: 'Please send more information.',
  contact_website: ''
};

const postEvent = (payload) => ({
  httpMethod: 'POST',
  body: JSON.stringify(payload),
  isBase64Encoded: false
});

const createMemoryStore = (blobs = new Map(), overrides = {}) => ({
  async get(key, options) {
    if (overrides.get) return overrides.get(key, options);
    const value = blobs.get(key);
    return value === undefined ? null : JSON.parse(JSON.stringify(value));
  },
  async setJSON(key, value) {
    if (overrides.setJSON) return overrides.setJSON(key, value);
    blobs.set(key, JSON.parse(JSON.stringify(value)));
  }
});

const validConfig = {
  generalRecipients: [{ id: 'general-1', email: 'info@primelinedist.com', enabled: true }],
  stateRules: [{
    id: 'ny-rule',
    countryCode: 'US',
    state: 'New York',
    recipients: ['route@example.com'],
    enabled: true
  }]
};

test('normalizes US state names and codes exactly', () => {
  assert.equal(normalizeUsState('NY'), 'NY');
  assert.equal(normalizeUsState('New York'), 'NY');
  assert.equal(normalizeUsState('York'), '');
  assert.equal(globalThis.PRIME_LINE_CONTACT_DATA.usStates.length, 51);
  assert.equal(globalThis.PRIME_LINE_CONTACT_DATA.countries[0].code, 'US');
  assert.deepEqual(
    globalThis.PRIME_LINE_CONTACT_DATA.countries.slice(1).map((country) => country.name),
    [...globalThis.PRIME_LINE_CONTACT_DATA.countries.slice(1).map((country) => country.name)].sort((a, b) => a.localeCompare(b))
  );
});

test('returns the initial default configuration when the Blob key is absent', async () => {
  const store = createMemoryStore();
  const config = await loadRoutingConfig(store);
  assert.equal(CONTACT_ROUTING_STORE_NAME, 'prime-line-contact-routing');
  assert.equal(CONTACT_ROUTING_CONFIG_KEY, 'contact-routing-config');
  assert.deepEqual(config.generalRecipients, [{
    id: 'default-info',
    email: 'info@primelinedist.com',
    enabled: true
  }]);
  assert.deepEqual(config.stateRules, []);
  assert.equal(config.updatedAt, null);
});

test('saves and reads the single configuration document across store instances', async () => {
  const blobs = new Map();
  const saved = await saveRoutingConfig(
    validConfig,
    createMemoryStore(blobs),
    { deploy: { context: 'production' } }
  );
  const read = await loadRoutingConfig(createMemoryStore(blobs));
  assert.equal(Date.parse(saved.updatedAt) > 0, true);
  assert.deepEqual(read, saved);
  assert.equal(blobs.size, 1);
  assert.equal(blobs.has(CONTACT_ROUTING_CONFIG_KEY), true);
});

test('migrates saved single-state rules to states arrays without losing settings', async () => {
  const legacyDocument = {
    generalRecipients: [{ id: 'legacy-general', email: 'all@example.com', enabled: false }, {
      id: 'legacy-fallback',
      email: 'info@primelinedist.com',
      enabled: true
    }],
    stateRules: [{
      id: 'legacy-ny',
      countryCode: 'US',
      state: 'New York',
      recipients: ['route@example.com'],
      enabled: false
    }],
    updatedAt: '2026-10-28T12:00:00.000Z'
  };
  const migrated = await loadRoutingConfig(createMemoryStore(new Map([
    [CONTACT_ROUTING_CONFIG_KEY, legacyDocument]
  ])));

  assert.deepEqual(migrated.stateRules, [{
    id: 'legacy-ny',
    countryCode: 'US',
    states: ['NY'],
    recipients: ['route@example.com'],
    enabled: false
  }]);
  assert.deepEqual(migrated.generalRecipients, legacyDocument.generalRecipients);
  assert.equal(migrated.updatedAt, legacyDocument.updatedAt);
});

test('blocks configuration writes outside production', async () => {
  let writeCalls = 0;
  const store = createMemoryStore(new Map(), {
    setJSON: async () => { writeCalls += 1; }
  });
  assert.equal(isProductionContext({ deploy: { context: 'deploy-preview' } }), false);
  assert.equal(isProductionContext(undefined), false);
  await assert.rejects(
    saveRoutingConfig(validConfig, store, { deploy: { context: 'deploy-preview' } }),
    /only be changed in production/
  );
  assert.equal(writeCalls, 0);
});

test('surfaces Blob read and write failures', async () => {
  const failingStore = createMemoryStore(new Map(), {
    get: async () => { throw new Error('mock read failure'); },
    setJSON: async () => { throw new Error('mock write failure'); }
  });
  await assert.rejects(loadRoutingConfig(failingStore), /mock read failure/);
  await assert.rejects(
    saveRoutingConfig(validConfig, failingStore, { deploy: { context: 'production' } }),
    /mock write failure/
  );
});

test('Netlify handler adapter forwards production and preview deploy contexts', async () => {
  const handler = adaptNetlifyHandler(async (_event, context) =>
    new Response(context.deploy.context)
  );
  const request = new Request('https://primelinedist.com/api/admin/contact-routing');

  assert.equal(
    await (await handler(request, { deploy: { context: 'production' } })).text(),
    'production'
  );
  assert.equal(
    await (await handler(request, { deploy: { context: 'deploy-preview' } })).text(),
    'deploy-preview'
  );
});

test('validates recipient configuration and rejects malformed email types', () => {
  assert.equal(validateRoutingConfig({
    generalRecipients: [{ id: 'one', email: {}, enabled: true }],
    stateRules: []
  }).ok, false);

  const validation = validateRoutingConfig({
    generalRecipients: [{ id: 'one', email: 'Info@Example.com', enabled: true }],
    stateRules: [{
      id: 'rule-one',
      countryCode: 'US',
      state: 'New York',
      recipients: ['route@example.com'],
      enabled: true
    }]
  });
  assert.equal(validation.ok, true);
  assert.deepEqual(validation.config.stateRules[0].states, ['NY']);
});

test('resolves enabled general and exact state-rule recipients without duplicates', () => {
  const config = {
    generalRecipients: [
      { id: 'one', email: 'info@example.com', enabled: true },
      { id: 'two', email: 'disabled@example.com', enabled: false }
    ],
    stateRules: [
      { id: 'ny', countryCode: 'US', state: 'NY', recipients: ['INFO@example.com', 'ny@example.com'], enabled: true },
      { id: 'ca', countryCode: 'US', state: 'CA', recipients: ['ca@example.com'], enabled: true },
      { id: 'off', countryCode: 'US', state: 'NY', recipients: ['off@example.com'], enabled: false }
    ]
  };
  assert.deepEqual(resolveRecipients({ country: 'US', state: 'NY' }, config), ['info@example.com', 'ny@example.com']);
  assert.deepEqual(resolveRecipients({ country: 'US', state: 'CA' }, config), ['info@example.com', 'ca@example.com']);
  assert.deepEqual(resolveRecipients({ country: 'US', state: 'FL' }, config), ['info@example.com']);
});

test('validates multiple state arrays, permits overlapping rules and deduplicates recipients', () => {
  const validation = validateRoutingConfig({
    generalRecipients: [{ id: 'general', email: 'info@example.com', enabled: true }],
    stateRules: [
      { id: 'tri-state', countryCode: 'US', states: ['NY', 'NJ', 'CT', 'New York'], recipients: ['m@example.com', 'M@example.com'], enabled: true },
      { id: 'ny-overlap', countryCode: 'US', states: ['NY'], recipients: ['info@example.com', 'other@example.com'], enabled: true },
      { id: 'disabled', countryCode: 'US', states: ['CT'], recipients: ['disabled@example.com'], enabled: false }
    ]
  });

  assert.equal(validation.ok, true);
  assert.deepEqual(validation.config.stateRules[0].states, ['NY', 'NJ', 'CT']);
  assert.deepEqual(validation.config.stateRules[0].recipients, ['m@example.com']);
  assert.deepEqual(resolveRecipients({ country: 'US', state: 'NY' }, validation.config), [
    'info@example.com',
    'm@example.com',
    'other@example.com'
  ]);
  assert.deepEqual(resolveRecipients({ country: 'US', state: 'CT' }, validation.config), [
    'info@example.com',
    'm@example.com'
  ]);
});

test('rejects invalid multi-state values and multiple international provinces', () => {
  const base = {
    generalRecipients: [{ id: 'general', email: 'info@example.com', enabled: true }],
    stateRules: []
  };
  assert.equal(validateRoutingConfig({
    ...base,
    stateRules: [{ id: 'bad', countryCode: 'US', states: ['NY', 'Unknown'], recipients: ['route@example.com'], enabled: true }]
  }).ok, false);
  assert.equal(validateRoutingConfig({
    ...base,
    stateRules: [{ id: 'intl', countryCode: 'CA', states: ['ON', 'QC'], recipients: ['route@example.com'], enabled: true }]
  }).ok, false);
});

test('builds a bounded Contact Us subject without header control characters', () => {
  assert.equal(
    buildContactSubject({ firstName: 'Pedro', lastName: 'Perez', companyName: 'ABC Restaurant' }),
    'PRIME LINE | Contact Us — Pedro Perez | ABC Restaurant'
  );
  assert.equal(
    buildContactSubject({ firstName: 'Pedro', lastName: 'Perez' }),
    'PRIME LINE | Contact Us — Pedro Perez'
  );
  assert.equal(
    buildContactSubject({
      firstName: 'Pedro\r\nBcc: forged',
      lastName: 'Perez\u0000',
      companyName: 'ABC\r\nBcc: forged'
    }),
    'PRIME LINE | Contact Us — Pedro Bcc: forged Perez | ABC Bcc: forged'
  );

  const longSubject = buildContactSubject({
    firstName: 'A'.repeat(80),
    lastName: 'B'.repeat(80),
    companyName: 'C'.repeat(160)
  });
  assert.ok(longSubject.length <= 180);
  assert.doesNotMatch(longSubject, /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/);
});

test('rejects invalid public submission and honeypot without sending email', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return { ok: true, status: 200 };
  };
  try {
    const missing = await contactHandler(postEvent({ ...validSubmission, companyName: '' }));
    assert.equal(missing.statusCode, 400);
    const invalidEmail = await contactHandler(postEvent({ ...validSubmission, email: 'not-an-email' }));
    assert.equal(invalidEmail.statusCode, 400);
    const spam = await contactHandler(postEvent({ ...validSubmission, contact_website: 'bot-filled' }));
    assert.equal(spam.statusCode, 400);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('sends a valid submission to the explicit fallback with escaped fields', async () => {
  const previous = {
    apiKey: process.env.RESEND_API_KEY,
    fromEmail: process.env.FROM_EMAIL,
    fetch: globalThis.fetch,
    consoleError: console.error
  };
  process.env.RESEND_API_KEY = 'test-key';
  process.env.FROM_EMAIL = 'info@primelinedist.com';
  let requestBody;
  console.error = () => {};
  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return { ok: true, status: 200, json: async () => ({ data: requestBody.map((_email, index) => ({ id: `mock-${index}` })) }) };
  };
  try {
    const response = await contactHandler(postEvent({
      ...validSubmission,
      firstName: '<Alex>'
    }));
    assert.equal(response.statusCode, 200);
    assert.equal(JSON.parse(response.body).sent, true);
    assert.equal(requestBody.length, 1);
    assert.deepEqual(requestBody[0].to, ['info@primelinedist.com']);
    assert.equal(requestBody[0].reply_to, 'alex@example.com');
    assert.equal(requestBody[0].subject, 'PRIME LINE | Contact Us — <Alex> Buyer | Example Foods');
    assert.match(requestBody[0].html, /&lt;Alex&gt;/);
    assert.match(requestBody[0].text, /Address Line 1: 10 Main Street/);
  } finally {
    if (previous.apiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previous.apiKey;
    if (previous.fromEmail === undefined) delete process.env.FROM_EMAIL;
    else process.env.FROM_EMAIL = previous.fromEmail;
    globalThis.fetch = previous.fetch;
    console.error = previous.consoleError;
  }
});

test('modern public Contact Us handler keeps the explicit fallback when Blobs is unavailable', async () => {
  const previous = {
    apiKey: process.env.RESEND_API_KEY,
    fromEmail: process.env.FROM_EMAIL,
    fetch: globalThis.fetch,
    consoleError: console.error,
    blobsContext: globalThis.netlifyBlobsContext
  };
  process.env.RESEND_API_KEY = 'test-key';
  process.env.FROM_EMAIL = 'info@primelinedist.com';
  console.error = () => {};
  globalThis.netlifyBlobsContext = undefined;
  let requestBody;
  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: requestBody.map((_email, index) => ({ id: `mock-${index}` })) })
    };
  };

  try {
    const response = await sendContact(new Request('https://primelinedist.com/api/contact/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validSubmission)
    }));

    assert.equal(response.status, 200);
    assert.equal((await response.json()).sent, true);
    assert.deepEqual(requestBody.map((email) => email.to), [['info@primelinedist.com']]);
  } finally {
    if (previous.apiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previous.apiKey;
    if (previous.fromEmail === undefined) delete process.env.FROM_EMAIL;
    else process.env.FROM_EMAIL = previous.fromEmail;
    globalThis.fetch = previous.fetch;
    console.error = previous.consoleError;
    if (previous.blobsContext === undefined) delete globalThis.netlifyBlobsContext;
    else globalThis.netlifyBlobsContext = previous.blobsContext;
  }
});

test('reports provider failure rather than a false success', async () => {
  const previous = {
    apiKey: process.env.RESEND_API_KEY,
    fromEmail: process.env.FROM_EMAIL,
    fetch: globalThis.fetch,
    consoleError: console.error
  };
  process.env.RESEND_API_KEY = 'test-key';
  process.env.FROM_EMAIL = 'info@primelinedist.com';
  console.error = () => {};
  globalThis.fetch = async () => ({ ok: false, status: 503 });
  try {
    const response = await contactHandler(postEvent(validSubmission));
    assert.equal(response.statusCode, 502);
    assert.equal(JSON.parse(response.body).sent, undefined);
  } finally {
    if (previous.apiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previous.apiKey;
    if (previous.fromEmail === undefined) delete process.env.FROM_EMAIL;
    else process.env.FROM_EMAIL = previous.fromEmail;
    globalThis.fetch = previous.fetch;
    console.error = previous.consoleError;
  }
});

test('admin routing API rejects unauthorized and cross-origin updates', async () => {
  const unauthorized = await adminRoutingHandler(new Request(
    'https://primelinedist.com/api/admin/contact-routing',
    { method: 'GET' }
  ));
  assert.equal(unauthorized.status, 401);

  const csrf = await adminRoutingHandler(new Request(
    'https://primelinedist.com/api/admin/contact-routing',
    {
      method: 'PUT',
      headers: { origin: 'https://attacker.example' },
      body: '{}'
    }
  ));
  assert.equal(csrf.status, 403);
});
