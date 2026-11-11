import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { adaptNetlifyHandler } from '../shared/adapt-netlify-handler.js';
import {
  DEFAULT_CAREERS_ROUTING_CONFIG,
  loadCareersRoutingConfig,
  isValidEmail,
  resolveRecipients
} from '../shared/contact-routing.js';

const MAX_REQUEST_BYTES = 5 * 1024 * 1024;
const MAX_RESUME_BYTES = 3 * 1024 * 1024;
const MAX_PROFESSIONAL_LINKS = 10;
const MAX_IDEMPOTENCY_AGE_MS = 23 * 60 * 60 * 1000;
const SENDER_EMAIL = 'info@primelinedist.com';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EMPLOYMENT_STATUSES = new Set(['Employed', 'Self-Employed', 'Unemployed', 'Student']);
const APPLICATION_TYPES = Object.freeze({
  joinOurTeam: { referencePrefix: 'JI', subjectLabel: 'Join Our Team' },
  fullJobInquiry: { referencePrefix: 'FJI', subjectLabel: 'Full Job Inquiry' }
});

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

const normalizeOptionalUrl = (value) => {
  if (!value) return '';
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    if (!['https:', 'http:'].includes(url.protocol)
      || !url.hostname.includes('.')
      || url.username
      || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
};

const parseProfessionalLinks = (value) => {
  if (value === undefined || value === null) return { links: [] };
  if (!Array.isArray(value) || value.length > MAX_PROFESSIONAL_LINKS) {
    return { error: 'Please provide up to 10 valid professional or social links.' };
  }
  const links = [];
  for (const entry of value) {
    if (typeof entry !== 'string') return { error: 'Please provide valid professional or social links.' };
    const trimmed = entry.trim();
    if (!trimmed) continue;
    if (trimmed.length > 2048) return { error: 'Professional and social links must be 2048 characters or fewer.' };
    const normalized = normalizeOptionalUrl(trimmed);
    if (!normalized) return { error: 'Please provide valid professional or social links.' };
    links.push(normalized);
  }
  return { links };
};

export const parseResume = async (value) => {
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
  if (!content.length || content.length > MAX_RESUME_BYTES) return { error: 'Maximum PDF file size: 3 MB.' };
  if (content.subarray(0, 5).toString('ascii') !== '%PDF-') return { error: 'The selected file is not a valid PDF document.' };
  try {
    const pdf = await PDFDocument.load(content);
    if (!pdf.getPageCount()) return { error: 'The selected file is not a valid PDF document.' };
  } catch {
    return { error: 'The selected file is not a valid PDF document.' };
  }
  const safeName = name.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'resume';
  return { resume: { filename: safeName, content: content.toString('base64') } };
};

const validateSubmission = async (payload, careersConfig) => {
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
  inquiry.resumeLink = normalizeOptionalUrl(inquiry.resumeLink);
  if (inquiry.resumeLink === null) return { error: 'Please provide a valid résumé link.' };
  const professionalLinksResult = parseProfessionalLinks(payload.professionalLinks);
  if (professionalLinksResult.error) return professionalLinksResult;
  inquiry.professionalLinks = professionalLinksResult.links;
  const resumeResult = await parseResume(payload.resume);
  if (resumeResult.error) return resumeResult;
  return { inquiry, resume: resumeResult.resume };
};

const getFromAddress = () => {
  const configuredFrom = (process.env.FROM_EMAIL || SENDER_EMAIL).trim();
  const address = configuredFrom.match(/<([^<>]+)>/)?.[1]?.trim() || configuredFrom;
  return address.toLowerCase() === SENDER_EMAIL ? `Prime Line <${SENDER_EMAIL}>` : null;
};

const createReference = (submissionId, type = 'joinOurTeam') => {
  const applicationType = APPLICATION_TYPES[type];
  const timestamp = Number(submissionId.match(/^[A-Z]+-(\d{13})-/)?.[1]);
  const date = new Date(timestamp).toISOString().slice(0, 10).replaceAll('-', '');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const entropy = createHash('sha256').update(submissionId).digest();
  const suffix = Array.from(entropy.subarray(0, 4), (byte) => alphabet[byte % alphabet.length]).join('');
  return `${applicationType.referencePrefix}-${date}-${suffix}`;
};

export const buildApplicationSubject = (type, inquiry, reference) => {
  const applicationType = APPLICATION_TYPES[type];
  if (!applicationType) throw new Error('Unsupported application type.');
  const name = sanitizeSubjectPart(inquiry?.name).slice(0, 120) || 'New Applicant';
  return `PRIME LINE | ${applicationType.subjectLabel} | ${name} | ${reference}`;
};

export const buildCareerSubject = (inquiry, reference) => buildApplicationSubject('joinOurTeam', inquiry, reference);

const getSubmissionId = (value) => {
  if (typeof value !== 'string') return null;
  const match = value.match(/^JI-(\d{13})-([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i);
  if (!match) return null;
  const timestamp = Number(match[1]);
  const age = Date.now() - timestamp;
  if (!Number.isSafeInteger(timestamp) || age < -60_000 || age > MAX_IDEMPOTENCY_AGE_MS) return null;
  return value;
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
    ['Résumé Link', inquiry.resumeLink || 'Not provided'],
    ['Professional & Social Links', inquiry.professionalLinks?.join('\n') || 'Not provided']
  ];
  const escapedRows = rows.map(([label, value]) => `
    <tr>
      <th align="left" valign="top" style="width:185px;padding:12px 12px 12px 0;border-bottom:1px solid #eeeae3;color:#737984;font-weight:600;">${escapeHtml(label)}</th>
      <td style="padding:12px 0;border-bottom:1px solid #eeeae3;overflow-wrap:anywhere;white-space:pre-wrap;">${escapeHtml(value)}</td>
    </tr>
  `).join('');
  return {
    text: [
      'PRIME LINE | Join Our Team',
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

export const buildCareerDelivery = (inquiry, reference, recipients, resume) => {
  const email = buildEmail(inquiry, reference);
  const delivery = {
    from: `Prime Line <${SENDER_EMAIL}>`,
    to: [recipients[0]],
    reply_to: inquiry.email,
    subject: buildApplicationSubject('joinOurTeam', inquiry, reference),
    text: email.text,
    html: email.html
  };
  if (recipients.length > 1) delivery.bcc = recipients.slice(1);
  if (resume) delivery.attachments = [resume];
  return delivery;
};

const buildApplicantConfirmation = (inquiry, reference) => {
  const firstName = inquiry.name.trim().split(/\s+/)[0] || 'Applicant';
  return {
    subject: `PRIME LINE | Application Received | ${reference}`,
    text: `Dear ${firstName},

Thank you for your interest in joining Prime Line!

We're pleased to confirm that your application has been successfully received.

Our team will review your information as opportunities become available that match your experience and interests.

What Happens Next?

There is no need to submit the same application again. Your information has already been received, and submitting additional copies will not speed up the review process.

Please understand that, due to the number of applications we receive, we may not be able to respond individually to every candidate.

However, your interest is genuinely appreciated. If your qualifications align with an available opportunity, a member of our team may contact you directly.

Thank you again for considering Prime Line. We wish you every success in your professional journey!

Warm regards,

Prime Line Recruitment Team

www.primelinedist.com

Application Reference: ${reference}

This is an automated confirmation. No reply is required.`,
    html: `
      <div style="margin:0;background:#f7f6f2;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#17284d;">
        <div style="width:100%;max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e7e3dc;border-radius:8px;overflow:hidden;">
          <div style="padding:24px;text-align:center;border-bottom:1px solid #eeeae3;">
            <img src="https://primelinedist.com/images/Logo1500.png" width="160" alt="Prime Line" style="display:block;width:160px;max-width:100%;height:auto;margin:0 auto;">
          </div>
          <div style="padding:28px 32px;font-size:15px;line-height:1.65;">
            <p style="margin:0 0 16px;">Dear ${escapeHtml(firstName)},</p>
            <p style="margin:0 0 14px;">Thank you for your interest in joining Prime Line!</p>
            <p style="margin:0 0 14px;">We're pleased to confirm that your application has been successfully received.</p>
            <p style="margin:0 0 20px;">Our team will review your information as opportunities become available that match your experience and interests.</p>
            <h1 style="margin:0 0 8px;font-size:17px;line-height:1.4;color:#17284d;">What Happens Next?</h1>
            <p style="margin:0 0 14px;">There is no need to submit the same application again. Your information has already been received, and submitting additional copies will not speed up the review process.</p>
            <p style="margin:0 0 14px;">Please understand that, due to the number of applications we receive, we may not be able to respond individually to every candidate.</p>
            <p style="margin:0 0 14px;">However, your interest is genuinely appreciated. If your qualifications align with an available opportunity, a member of our team may contact you directly.</p>
            <p style="margin:0 0 18px;">Thank you again for considering Prime Line. We wish you every success in your professional journey!</p>
            <p style="margin:0 0 14px;">Warm regards,<br><strong>Prime Line Recruitment Team</strong></p>
            <p style="margin:0 0 20px;"><a href="http://www.primelinedist.com" style="color:#17284d;">www.primelinedist.com</a></p>
            <div style="padding:13px 15px;background:#f4f6f8;border-radius:4px;">
              <span style="display:block;color:#737984;font-size:10px;font-weight:700;letter-spacing:1px;">APPLICATION REFERENCE</span>
              <strong style="display:block;margin-top:4px;font-size:17px;letter-spacing:.04em;">${escapeHtml(reference)}</strong>
            </div>
            <p style="margin:16px 0 0;color:#737984;font-size:11px;">This is an automated confirmation. No reply is required.</p>
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
  const submissionId = getSubmissionId(payload.submissionId);
  if (!submissionId) {
    return json({ error: 'This submission attempt has expired or is invalid. Reload the form to try again.' }, 409);
  }

  let config;
  try {
    config = await loadCareersRoutingConfig();
  } catch (error) {
    console.error('Join Our Team configuration could not be loaded.', error);
    config = DEFAULT_CAREERS_ROUTING_CONFIG;
  }

  const validation = await validateSubmission(payload, config);
  if (validation.error) return json({ error: validation.error }, 400);
  const { inquiry, resume } = validation;

  const apiKey = process.env.RESEND_API_KEY;
  const from = getFromAddress();
  if (!apiKey || !from) return json({ error: 'Email sending is not configured. Please try again later.' }, 503);

  const recipients = resolveRecipients({ country: 'US', state: '' }, config);
  const reference = createReference(submissionId);
  const delivery = buildCareerDelivery(inquiry, reference, recipients, resume);

  let internalResponse;
  try {
    internalResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `join-our-team/${submissionId}/internal`
      },
      body: JSON.stringify(delivery)
    });
  } catch {
    console.error('Join Our Team internal email request failed.');
    return json({ error: 'Your inquiry could not be sent. Please try again later.' }, 502);
  }
  if (!internalResponse.ok) {
    console.error('Join Our Team internal email was not accepted by Resend.', { status: internalResponse.status });
    return json({ error: 'Your inquiry could not be sent. Please try again later.' }, 502);
  }

  const confirmation = buildApplicantConfirmation(inquiry, reference);
  let confirmationAccepted = false;
  try {
    const confirmationResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `join-our-team/${submissionId}/confirmation`
      },
      body: JSON.stringify({
        from,
        to: [inquiry.email],
        reply_to: SENDER_EMAIL,
        subject: confirmation.subject,
        text: confirmation.text,
        html: confirmation.html
      })
    });
    if (confirmationResponse.ok) {
      confirmationAccepted = true;
    } else {
      console.error('Join Our Team applicant confirmation was not accepted by Resend.', { status: confirmationResponse.status });
    }
  } catch {
    console.error('Join Our Team applicant confirmation request failed.');
  }

  return json({
    sent: true,
    internalAcceptedByResend: true,
    reference,
    resumeReceived: Boolean(resume),
    confirmation: {
      acceptedByResend: confirmationAccepted,
      deliveryConfirmed: false
    }
  });
};

export default adaptNetlifyHandler(processCareerInquiryEvent);
