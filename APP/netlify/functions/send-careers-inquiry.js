import { randomBytes } from 'node:crypto';
import { adaptNetlifyHandler } from '../shared/adapt-netlify-handler.js';
import {
  DEFAULT_CAREERS_ROUTING_CONFIG,
  loadCareersRoutingConfig,
  isValidEmail,
  resolveRecipients
} from '../shared/contact-routing.js';

const MAX_REQUEST_BYTES = 5 * 1024 * 1024;
const MAX_RESUME_BYTES = 3 * 1024 * 1024;
const SENDER_EMAIL = 'info@primelinedist.com';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EMPLOYMENT_STATUSES = new Set(['Employed', 'Self-Employed', 'Unemployed', 'Student']);

const json = (body, statusCode = 200, extraHeaders = {}) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders
  },
  body: JSON.stringify(body)
});

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[character]);

const sanitizeSubjectPart = (value) => typeof value === 'string'
  ? value.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, ' ').replace(/\s+/g, ' ').trim()
  : '';

const stringField = (payload, name, maxLength, { required = false } = {}) => {
  const value = payload[name];
  if (value === undefined || value === null) return required ? null : '';
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length > maxLength || (required && !trimmed)) return null;
  return trimmed;
};

const validResumeLink = (value) => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

export const parseResume = (value) => {
  if (!value) return { resume: null };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { error: 'Invalid résumé upload.' };
  const name = stringField(value, 'name', 180, { required: true });
  const dataUrl = stringField(value, 'dataUrl', MAX_REQUEST_BYTES, { required: true });
  if (!name || !dataUrl) return { error: 'Invalid résumé upload.' };
  const match = dataUrl.match(/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match || match[1] !== 'application/pdf' || !name.toLocaleLowerCase('en-US').endsWith('.pdf')) {
    return { error: 'Only PDF résumés are accepted.' };
  }
  const content = Buffer.from(match[2], 'base64');
  if (content.toString('base64') !== match[2]) return { error: 'The selected file is not a valid PDF document.' };
  if (!content.length || content.length > MAX_RESUME_BYTES) return { error: 'Please upload a résumé no larger than 3 MB.' };
  if (content.subarray(0, 5).toString('ascii') !== '%PDF-') return { error: 'The selected file is not a valid PDF document.' };
  const safeName = name.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'resume';
  return { resume: { filename: safeName, content: content.toString('base64') } };
};

const validateSubmission = (payload, careersConfig) => {
  const inquiry = {
    name: stringField(payload, 'name', 160, { required: true }),
    email: stringField(payload, 'email', 254, { required: true }),
    phone: stringField(payload, 'phone', 50, { required: true }),
    position: stringField(payload, 'position', 120, { required: true }),
    division: stringField(payload, 'division', 120, { required: true }),
    startDate: stringField(payload, 'startDate', 10, { required: true }),
    employmentStatus: stringField(payload, 'employmentStatus', 40, { required: true }),
    message: stringField(payload, 'message', 2000),
    resumeLink: stringField(payload, 'resumeLink', 2048)
  };
  if (Object.values(inquiry).some((value) => value === null)) {
    return { error: 'Please complete all required fields and check their length.' };
  }
  if (!EMAIL_PATTERN.test(inquiry.email) || !isValidEmail(inquiry.email)) {
    return { error: 'Please enter a valid email address.' };
  }
  if (
    !careersConfig.positions.includes(inquiry.position)
    || !careersConfig.divisions.includes(inquiry.division)
    || !EMPLOYMENT_STATUSES.has(inquiry.employmentStatus)
  ) {
    return { error: 'Please choose valid application details.' };
  }
  if (!DATE_PATTERN.test(inquiry.startDate) || Number.isNaN(Date.parse(`${inquiry.startDate}T00:00:00Z`))) {
    return { error: 'Please provide a valid available start date.' };
  }
  if (!validResumeLink(inquiry.resumeLink)) return { error: 'Please provide a valid résumé link.' };
  const resumeResult = parseResume(payload.resume);
  if (resumeResult.error) return resumeResult;
  return { inquiry, resume: resumeResult.resume };
};

const getFromAddress = () => {
  const configuredFrom = (process.env.FROM_EMAIL || SENDER_EMAIL).trim();
  const address = configuredFrom.match(/<([^<>]+)>/)?.[1]?.trim() || configuredFrom;
  return address.toLowerCase() === SENDER_EMAIL ? `Prime Line <${SENDER_EMAIL}>` : null;
};

const createReference = () => {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const suffix = Array.from(randomBytes(4), (byte) => alphabet[byte % alphabet.length]).join('');
  return `JI-${date}-${suffix}`;
};

export const buildCareerSubject = (inquiry, reference) => {
  const name = sanitizeSubjectPart(inquiry?.name).slice(0, 120) || 'New Applicant';
  return `PRIME LINE | Job Application | ${name} | ${reference}`;
};

const buildEmail = (inquiry, reference) => {
  const rows = [
    ['Reference', reference],
    ['Applicant', inquiry.name],
    ['Email', inquiry.email],
    ['Phone Number', inquiry.phone],
    ['Position of Interest', inquiry.position],
    ['Division or Location', inquiry.division],
    ['Available Start Date', inquiry.startDate],
    ['Current Employment Status', inquiry.employmentStatus],
    ['Cover Letter or Message', inquiry.message || 'Not provided'],
    ['Résumé Link', inquiry.resumeLink || 'Not provided']
  ];
  const escapedRows = rows.map(([label, value]) => `
    <tr>
      <th align="left" valign="top" style="width:185px;padding:12px 12px 12px 0;border-bottom:1px solid #eeeae3;color:#737984;font-weight:600;">${escapeHtml(label)}</th>
      <td style="padding:12px 0;border-bottom:1px solid #eeeae3;overflow-wrap:anywhere;white-space:pre-wrap;">${escapeHtml(value)}</td>
    </tr>
  `).join('');
  return {
    text: [
      'PRIME LINE | Job Application',
      `Reference: ${reference}`,
      '',
      ...rows.map(([label, value]) => `${label}: ${value}`)
    ].join('\n'),
    html: `
      <div style="margin:0;background:#f7f6f2;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#17284d;">
        <div style="width:100%;max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e7e3dc;">
          <div style="padding:28px 24px;text-align:center;border-bottom:1px solid #eeeae3;">
            <img src="https://primelinedist.com/images/Logo1500.png" width="180" alt="Prime Line" style="display:block;width:180px;max-width:100%;height:auto;margin:0 auto;">
          </div>
          <div style="padding:30px 24px;">
            <p style="margin:0 0 8px;color:#737984;font-size:12px;letter-spacing:1px;text-transform:uppercase;">${escapeHtml(reference)}</p>
            <h1 style="margin:0 0 24px;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:400;line-height:1.2;color:#17284d;">New Job Application</h1>
            <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;line-height:1.6;">${escapedRows}</table>
          </div>
          <div style="padding:18px 24px;text-align:center;border-top:1px solid #eeeae3;color:#737984;font-size:11px;line-height:1.5;">
            Prime Line<br>Importers of Selected Specialty Foods
          </div>
        </div>
      </div>
    `
  };
};

export const processCareerInquiryEvent = async (event) => {
  if (event.httpMethod === 'GET') {
    try {
      const config = await loadCareersRoutingConfig();
      return json(
        { positions: config.positions, divisions: config.divisions },
        200,
        { 'Cache-Control': 'public, max-age=300' }
      );
    } catch (error) {
      console.error('Join Our Team form options could not be loaded.', error);
      return json({ error: 'Job application options are temporarily unavailable.' }, 503);
    }
  }
  if (event.httpMethod !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const body = typeof event.body === 'string' ? event.body : '';
  if (Buffer.byteLength(body, 'utf8') > MAX_REQUEST_BYTES) return json({ error: 'The request is too large.' }, 413);

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return json({ error: 'Invalid request.' }, 400);
  if (typeof payload.careers_website !== 'string' || payload.careers_website.trim()) {
    return json({ error: 'Invalid submission.' }, 400);
  }

  let config;
  try {
    config = await loadCareersRoutingConfig();
  } catch (error) {
    console.error('Join Our Team configuration could not be loaded.', error);
    config = DEFAULT_CAREERS_ROUTING_CONFIG;
  }

  const validation = validateSubmission(payload, config);
  if (validation.error) return json({ error: validation.error }, 400);
  const { inquiry, resume } = validation;

  const apiKey = process.env.RESEND_API_KEY;
  const from = getFromAddress();
  if (!apiKey || !from) return json({ error: 'Email sending is not configured. Please try again later.' }, 503);

  const recipients = resolveRecipients({ country: 'US', state: '' }, config);
  const reference = createReference();
  const email = buildEmail(inquiry, reference);
  const delivery = {
    from,
    to: [recipients[0]],
    reply_to: inquiry.email,
    subject: buildCareerSubject(inquiry, reference),
    text: email.text,
    html: email.html
  };
  if (recipients.length > 1) delivery.bcc = recipients.slice(1);
  if (resume) delivery.attachments = [resume];

  let response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(delivery)
    });
  } catch (error) {
    console.error('Career inquiry email delivery request failed.', error);
    return json({ error: 'Your inquiry could not be sent. Please try again later.' }, 502);
  }
  if (!response.ok) {
    console.error('Career inquiry email delivery failed.', { status: response.status });
    return json({ error: 'Your inquiry could not be sent. Please try again later.' }, 502);
  }
  return json({ sent: true, reference, resumeReceived: Boolean(resume) });
};

export default adaptNetlifyHandler(processCareerInquiryEvent);
