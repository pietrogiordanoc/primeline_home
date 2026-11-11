import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import careersInquiry, {
  buildApplicationSubject,
  buildCareerDelivery,
  buildCareerSubject,
  parseResume,
  processCareerInquiryEvent
} from '../functions/send-careers-inquiry.js';

const createSubmissionId = (timestamp = Date.now()) => `JI-${timestamp}-${randomUUID()}`;
const validInquiry = (overrides = {}) => ({
  name: 'Maria Garcia',
  email: 'maria@example.com',
  phone: '555-0100',
  position: 'Driver',
  division: 'Los Angeles, California',
  startDate: '2026-12-01',
  employmentStatus: 'Employed',
  message: 'I would be excited to join the Prime Line team.',
  resumeLink: '',
  resume: null,
  careers_website: '',
  submissionId: createSubmissionId(),
  ...overrides
});

const postEvent = (payload) => ({
  httpMethod: 'POST',
  body: JSON.stringify(payload)
});

const createPdf = async (targetBytes) => {
  const document = await PDFDocument.create();
  document.addPage();
  const original = Buffer.from(await document.save());
  if (!targetBytes) return original;
  assert.ok(targetBytes >= original.length);
  const padded = Buffer.alloc(targetBytes, 0x20);
  original.copy(padded);
  return padded;
};

const asResume = (bytes, name = 'Maria Resume.pdf') => ({
  name,
  dataUrl: `data:application/pdf;base64,${bytes.toString('base64')}`
});

const runWithResend = async (fetchMock, callback, { captureLogs = false } = {}) => {
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
  globalThis.fetch = fetchMock;
  if (!captureLogs) console.error = () => {};
  try {
    return await callback();
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
};

test('builds distinct Join Our Team and reserved Full Job Inquiry subjects', () => {
  assert.equal(
    buildCareerSubject({ name: 'Maria Garcia' }, 'JI-20261111-A7K4'),
    'PRIME LINE | Join Our Team | Maria Garcia | JI-20261111-A7K4'
  );
  assert.equal(
    buildCareerSubject({ name: 'Maria\r\nBcc: forged' }, 'JI-20261111-A7K4'),
    'PRIME LINE | Join Our Team | Maria Bcc: forged | JI-20261111-A7K4'
  );
  assert.equal(
    buildApplicationSubject('fullJobInquiry', { name: 'Maria Garcia' }, 'FJI-20261111-A7K4'),
    'PRIME LINE | Full Job Inquiry | Maria Garcia | FJI-20261111-A7K4'
  );
});

test('validates genuine PDF files and accepts an exact 3 MiB résumé', async () => {
  const smallPdf = await createPdf();
  assert.deepEqual(await parseResume(asResume(smallPdf)), {
    resume: {
      filename: 'Maria-Resume.pdf',
      content: smallPdf.toString('base64')
    }
  });

  const exactLimitPdf = await createPdf(3 * 1024 * 1024);
  const exactResult = await parseResume(asResume(exactLimitPdf));
  assert.equal(exactResult.resume.content, exactLimitPdf.toString('base64'));

  const oversizedPdf = await createPdf(3 * 1024 * 1024 + 1);
  assert.match((await parseResume(asResume(oversizedPdf))).error, /Maximum PDF file size: 3 MB/);
  assert.match((await parseResume({
    name: 'resume.doc',
    dataUrl: `data:application/msword;base64,${smallPdf.toString('base64')}`
  })).error, /Only PDF/);
  assert.match((await parseResume({
    name: 'resume.pdf',
    dataUrl: 'data:application/pdf;base64,JVBERi0xLjQK'
  })).error, /valid PDF/);
});

test('preserves internal recipient, Reply-To, BCC and résumé attachment behavior', () => {
  const resume = { filename: 'applicant-resume.pdf', content: 'JVBERi0=' };
  const delivery = buildCareerDelivery(
    { name: 'Maria Garcia', email: 'maria@example.com' },
    'JI-20261111-A7K4',
    ['hr@example.com', 'recruiting@example.com'],
    resume
  );
  assert.equal(delivery.to[0], 'hr@example.com');
  assert.deepEqual(delivery.bcc, ['recruiting@example.com']);
  assert.equal(delivery.reply_to, 'maria@example.com');
  assert.deepEqual(delivery.attachments, [resume]);
  assert.match(delivery.subject, /Maria Garcia \| JI-20261111-A7K4$/);
});

test('rejects invalid data, oversized requests and expired idempotency attempts before sending', async () => {
  let fetchCalls = 0;
  const fetchMock = async () => {
    fetchCalls += 1;
    return { ok: true, status: 200 };
  };
  await runWithResend(fetchMock, async () => {
    const invalidPayloads = [
      validInquiry({ email: 'invalid' }),
      validInquiry({ division: 'Unknown' }),
      validInquiry({ careers_website: 'bot-filled' }),
      validInquiry({ resumeLink: 'javascript:alert(1)' }),
      validInquiry({ professionalLinks: ['not a valid URL'] }),
      validInquiry({ professionalLinks: 'not-an-array' }),
      validInquiry({ submissionId: undefined })
    ];
    for (const payload of invalidPayloads) {
      const response = await processCareerInquiryEvent(postEvent(payload));
      assert.equal(response.statusCode, payload.submissionId ? 400 : 409);
    }

    const expired = validInquiry({ submissionId: createSubmissionId(Date.now() - 24 * 60 * 60 * 1000) });
    assert.equal((await processCareerInquiryEvent(postEvent(expired))).statusCode, 409);

    const oversizedBody = validInquiry({ extra: 'x'.repeat(5 * 1024 * 1024) });
    assert.equal((await processCareerInquiryEvent(postEvent(oversizedBody))).statusCode, 413);
    assert.equal(fetchCalls, 0);
  });
});

test('normalizes optional résumé and professional links and includes them in the internal email', async () => {
  const requests = [];
  const payload = validInquiry({
    resumeLink: 'www.example.com/resume',
    professionalLinks: ['linkedin.com/in/maria', 'https://instagram.com/maria', '']
  });
  await runWithResend(async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return { ok: true, status: 200 };
  }, async () => {
    const response = await processCareerInquiryEvent(postEvent(payload));
    assert.equal(response.statusCode, 200);
    assert.equal(requests.length, 2);
    assert.match(requests[0].text, /Résumé Link: https:\/\/www\.example\.com\/resume/);
    assert.match(requests[0].text, /Professional & Social Links: https:\/\/linkedin\.com\/in\/maria\nhttps:\/\/instagram\.com\/maria/);
    assert.match(requests[0].html, /https:\/\/www\.example\.com\/resume/);
    assert.match(requests[0].html, /https:\/\/linkedin\.com\/in\/maria/);
    assert.match(requests[0].html, /https:\/\/instagram\.com\/maria/);
    assert.doesNotMatch(requests[1].text, /linkedin\.com|instagram\.com/);
  });
});

test('sends an internal notification and a separate applicant confirmation with one reference', async () => {
  const requests = [];
  const maliciousName = 'Maria <img src=x onerror=alert(1)> Garcia';
  const payload = validInquiry({ name: maliciousName });
  await runWithResend(async (_url, options) => {
    requests.push({ headers: options.headers, body: JSON.parse(options.body) });
    return { ok: true, status: 200 };
  }, async () => {
    const response = await processCareerInquiryEvent(postEvent(payload));
    assert.equal(response.statusCode, 200);
    const result = JSON.parse(response.body);
    assert.equal(result.sent, true);
    assert.equal(result.internalAcceptedByResend, true);
    assert.match(result.reference, /^JI-\d{8}-[A-Z0-9]{4}$/);
    assert.deepEqual(result.confirmation, { acceptedByResend: true, deliveryConfirmed: false });
    assert.equal(result.resumeReceived, false);

    assert.equal(requests.length, 2);
    const [internal, applicant] = requests;
    assert.deepEqual(internal.body.to, ['info@primelinedist.com']);
    assert.equal(internal.body.bcc, undefined);
    assert.equal(internal.body.reply_to, payload.email);
    assert.equal(internal.body.subject, `PRIME LINE | Join Our Team | ${maliciousName} | ${result.reference}`);
    assert.match(internal.body.html, /Division or Location/);
    assert.match(internal.body.html, /Available Start Date/);
    assert.match(internal.body.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.match(internal.headers['Idempotency-Key'], /\/internal$/);

    assert.deepEqual(applicant.body.to, [payload.email]);
    assert.equal(applicant.body.reply_to, 'info@primelinedist.com');
    assert.equal(applicant.body.subject, `PRIME LINE | Application Received | ${result.reference}`);
    assert.equal(applicant.body.bcc, undefined);
    assert.equal(applicant.body.attachments, undefined);
    assert.match(applicant.body.text, /Dear Maria,/);
    assert.match(applicant.body.text, new RegExp(result.reference));
    assert.match(applicant.body.html, /Dear Maria,/);
    assert.doesNotMatch(applicant.body.html, /<img src=x onerror=alert\(1\)>/);
    assert.match(applicant.headers['Idempotency-Key'], /\/confirmation$/);
  });
});

test('keeps internal delivery successful when applicant confirmation fails', async () => {
  const logs = [];
  const previousError = console.error;
  console.error = (...values) => logs.push(values);
  let requestCount = 0;
  try {
    await runWithResend(async () => {
      requestCount += 1;
      return { ok: requestCount === 1, status: requestCount === 1 ? 200 : 503 };
    }, async () => {
      const response = await processCareerInquiryEvent(postEvent(validInquiry()));
      assert.equal(response.statusCode, 200);
      const result = JSON.parse(response.body);
      assert.equal(result.sent, true);
      assert.equal(result.confirmation.acceptedByResend, false);
      assert.equal(result.confirmation.deliveryConfirmed, false);
    }, { captureLogs: true });
  } finally {
    console.error = previousError;
  }
  assert.equal(requestCount, 2);
  assert.ok(logs.some(([message]) => /applicant confirmation/.test(message)));
  assert.doesNotMatch(JSON.stringify(logs), /maria@example\.com|Maria Garcia/);
});

test('does not send applicant confirmation when internal notification is rejected', async () => {
  let requestCount = 0;
  await runWithResend(async () => {
    requestCount += 1;
    return { ok: false, status: 503 };
  }, async () => {
    const response = await processCareerInquiryEvent(postEvent(validInquiry()));
    assert.equal(response.statusCode, 502);
    assert.equal(JSON.parse(response.body).sent, undefined);
  });
  assert.equal(requestCount, 1);
});

test('retries reuse the same reference and Resend idempotency keys', async () => {
  const requests = [];
  const acceptedKeys = new Map();
  await runWithResend(async (_url, options) => {
    const key = options.headers['Idempotency-Key'];
    const body = options.body;
    if (acceptedKeys.has(key)) {
      assert.equal(acceptedKeys.get(key), body);
    } else {
      acceptedKeys.set(key, body);
    }
    requests.push(key);
    return { ok: true, status: 200 };
  }, async () => {
    const payload = validInquiry();
    const first = JSON.parse((await processCareerInquiryEvent(postEvent(payload))).body);
    const second = JSON.parse((await processCareerInquiryEvent(postEvent(payload))).body);
    assert.equal(second.reference, first.reference);
  });
  assert.equal(requests.length, 4);
  assert.equal(new Set(requests).size, 2);
});

test('attaches exactly the selected 3 MiB PDF to the internal email only', async () => {
  const selectedPdf = await createPdf(3 * 1024 * 1024);
  const requests = [];
  await runWithResend(async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return { ok: true, status: 200 };
  }, async () => {
    const response = await processCareerInquiryEvent(postEvent(validInquiry({ resume: asResume(selectedPdf) })));
    assert.equal(response.statusCode, 200);
    assert.equal(JSON.parse(response.body).resumeReceived, true);
  });
  assert.deepEqual(requests[0].attachments, [{
    filename: 'Maria-Resume.pdf',
    content: selectedPdf.toString('base64')
  }]);
  assert.equal(requests[1].attachments, undefined);
  assert.equal(requests[1].to[0], 'maria@example.com');
});

test('rejects an oversized PDF on the server without contacting Resend', async () => {
  const oversizedPdf = await createPdf(3 * 1024 * 1024 + 1);
  let requestCount = 0;
  await runWithResend(async () => {
    requestCount += 1;
    return { ok: true, status: 200 };
  }, async () => {
    const response = await processCareerInquiryEvent(postEvent(validInquiry({ resume: asResume(oversizedPdf) })));
    assert.equal(response.statusCode, 400);
    assert.match(JSON.parse(response.body).error, /Maximum PDF file size: 3 MB/);
  });
  assert.equal(requestCount, 0);
});

test('rejects a fake PDF and non-PDF extension without sending email', async () => {
  const fakePdf = { name: 'fake.pdf', dataUrl: 'data:application/pdf;base64,JVBERi0xLjQK' };
  let requestCount = 0;
  await runWithResend(async () => {
    requestCount += 1;
    return { ok: true, status: 200 };
  }, async () => {
    for (const resume of [fakePdf, { ...fakePdf, name: 'document.docx' }]) {
      const response = await processCareerInquiryEvent(postEvent(validInquiry({ resume })));
      assert.equal(response.statusCode, 400);
    }
  });
  assert.equal(requestCount, 0);
});

test('Netlify handler adapter serves the same POST workflow', async () => {
  await runWithResend(async () => ({ ok: true, status: 200 }), async () => {
    const response = await careersInquiry(new Request('https://primelinedist.com/.netlify/functions/send-careers-inquiry', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validInquiry())
    }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).sent, true);
  });
});
