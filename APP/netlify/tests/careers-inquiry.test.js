import test from 'node:test';
import assert from 'node:assert/strict';
import careersInquiry, {
  buildCareerSubject,
  processCareerInquiryEvent,
  resolveCareerState
} from '../functions/send-careers-inquiry.js';

const validInquiry = {
  name: 'Maria Garcia',
  email: 'maria@example.com',
  phone: '555-0100',
  position: 'Driver',
  division: 'Los Angeles, California',
  startDate: '2026-12-01',
  employmentStatus: 'Employed',
  message: 'I would be excited to join the Prime Line team.',
  resumeLink: 'https://example.com/maria-resume.pdf',
  resume: null,
  careers_website: ''
};

const postEvent = (payload) => ({
  httpMethod: 'POST',
  body: JSON.stringify(payload)
});

test('builds a Job Application subject with the applicant name before the final reference', () => {
  assert.equal(
    buildCareerSubject({ name: 'Maria Garcia' }, 'JI-20261111-A7K4'),
    'PRIME LINE | Job Application | Maria Garcia | JI-20261111-A7K4'
  );
  assert.equal(
    buildCareerSubject({ name: 'Maria\r\nBcc: forged' }, 'JI-20261111-A7K4'),
    'PRIME LINE | Job Application | Maria Bcc: forged | JI-20261111-A7K4'
  );
});

test('maps each Careers division to its configured state routing rule', () => {
  assert.equal(resolveCareerState('Florida'), 'FL');
  assert.equal(resolveCareerState('Central Florida'), 'FL');
  assert.equal(resolveCareerState('Orlando, Florida'), 'FL');
  assert.equal(resolveCareerState('New York, New York'), 'NY');
  assert.equal(resolveCareerState('Las Vegas, Nevada'), 'NV');
  assert.equal(resolveCareerState('Los Angeles, California'), 'CA');
});

test('rejects invalid public inquiries before sending email', async () => {
  const previousFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return { ok: true, status: 200 };
  };
  try {
    for (const payload of [
      { ...validInquiry, email: 'invalid' },
      { ...validInquiry, division: 'Unknown' },
      { ...validInquiry, careers_website: 'bot-filled' },
      { ...validInquiry, resumeLink: 'javascript:alert(1)' }
    ]) {
      const response = await processCareerInquiryEvent(postEvent(payload));
      assert.equal(response.statusCode, 400);
    }
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('delivers an inquiry to the configured general and location recipients without exposing recipients', async () => {
  const previous = {
    apiKey: process.env.RESEND_API_KEY,
    fromEmail: process.env.FROM_EMAIL,
    fetch: globalThis.fetch,
    blobsContext: globalThis.netlifyBlobsContext,
    consoleError: console.error
  };
  process.env.RESEND_API_KEY = 'test-key';
  process.env.FROM_EMAIL = 'info@primelinedist.com';
  globalThis.netlifyBlobsContext = undefined;
  console.error = () => {};
  let requestBody;
  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return { ok: true, status: 200 };
  };
  try {
    const response = await processCareerInquiryEvent(postEvent(validInquiry));
    assert.equal(response.statusCode, 200);
    const result = JSON.parse(response.body);
    assert.equal(result.sent, true);
    assert.match(result.reference, /^JI-\d{8}-[A-Z0-9]{4}$/);
    assert.deepEqual(requestBody.to, ['info@primelinedist.com']);
    assert.equal(requestBody.bcc, undefined);
    assert.equal(requestBody.reply_to, 'maria@example.com');
    assert.match(requestBody.subject, /^PRIME LINE \| Job Application \| Maria Garcia \| JI-\d{8}-[A-Z0-9]{4}$/);
    assert.match(requestBody.html, /Los Angeles, California/);
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

test('includes an optional résumé as a Resend attachment', async () => {
  const previous = {
    apiKey: process.env.RESEND_API_KEY,
    fromEmail: process.env.FROM_EMAIL,
    fetch: globalThis.fetch,
    blobsContext: globalThis.netlifyBlobsContext,
    consoleError: console.error
  };
  process.env.RESEND_API_KEY = 'test-key';
  process.env.FROM_EMAIL = 'info@primelinedist.com';
  globalThis.netlifyBlobsContext = undefined;
  console.error = () => {};
  let requestBody;
  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return { ok: true, status: 200 };
  };
  try {
    const response = await careersInquiry(new Request('https://primelinedist.com/api/careers/send-inquiry', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...validInquiry,
        resume: {
          name: 'Maria Garcia Resume.pdf',
          dataUrl: 'data:application/pdf;base64,JVBERi0xLjQK'
        }
      })
    }));
    assert.equal(response.status, 200);
    assert.deepEqual(requestBody.attachments, [{
      filename: 'Maria-Garcia-Resume.pdf',
      content: 'JVBERi0xLjQK'
    }]);
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
