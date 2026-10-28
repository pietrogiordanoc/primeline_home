import '../../assets/js/contact-form-data.js';
import {
  DEFAULT_ROUTING_CONFIG,
  isValidEmail,
  loadRoutingConfig,
  normalizeCountryCode,
  normalizeUsState,
  resolveRecipients
} from '../shared/contact-routing.js';

const MAX_REQUEST_BYTES = 20 * 1024;
const SENDER_EMAIL = 'info@primelinedist.com';
const SUBJECT = 'PRIME LINE | New Website Inquiry';
const DATA = globalThis.PRIME_LINE_CONTACT_DATA;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INQUIRY_TYPES = new Set(DATA.inquiryTypes);
const BUSINESS_TYPES = new Set(DATA.businessTypes);
const COUNTRIES = new Set(DATA.countryCodes);

const json = (body, statusCode = 200, headers = {}) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers
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

const stringField = (payload, name, maxLength, { required = false } = {}) => {
  const value = payload[name];
  if (value === undefined || value === null) return required ? null : '';
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length > maxLength || (required && !trimmed)) return null;
  return trimmed;
};

const validateSubmission = (payload) => {
  const result = {
    inquiryType: stringField(payload, 'inquiryType', 80, { required: true }),
    firstName: stringField(payload, 'firstName', 80, { required: true }),
    lastName: stringField(payload, 'lastName', 80, { required: true }),
    email: stringField(payload, 'email', 254, { required: true }),
    companyName: stringField(payload, 'companyName', 160, { required: true }),
    businessType: stringField(payload, 'businessType', 100, { required: true }),
    phone: stringField(payload, 'phone', 50, { required: true }),
    website: stringField(payload, 'website', 2048),
    address1: stringField(payload, 'address1', 160, { required: true }),
    address2: stringField(payload, 'address2', 160),
    city: stringField(payload, 'city', 100, { required: true }),
    state: stringField(payload, 'state', 100),
    postalCode: stringField(payload, 'postalCode', 20, { required: true }),
    country: normalizeCountryCode(payload.country),
    message: stringField(payload, 'message', 5000, { required: true })
  };

  if (Object.values(result).some((value) => value === null)) {
    return { error: 'Please complete all required fields and check their length.' };
  }
  if (!INQUIRY_TYPES.has(result.inquiryType) || !BUSINESS_TYPES.has(result.businessType)) {
    return { error: 'Please choose a valid inquiry and business type.' };
  }
  if (!result.country || !COUNTRIES.has(result.country)) return { error: 'Please choose a valid country.' };
  if (!EMAIL_PATTERN.test(result.email) || !isValidEmail(result.email)) {
    return { error: 'Please enter a valid email address.' };
  }
  if (result.website) {
    try {
      const websiteUrl = new URL(result.website);
      if (!['http:', 'https:'].includes(websiteUrl.protocol) || websiteUrl.username || websiteUrl.password) {
        return { error: 'Please enter a valid website URL.' };
      }
    } catch {
      return { error: 'Please enter a valid website URL.' };
    }
  }
  if (result.country === 'US') {
    const stateCode = normalizeUsState(result.state);
    if (!stateCode) return { error: 'Please choose a valid US state.' };
    result.state = stateCode;
  }

  return { contact: result };
};

const getFromAddress = () => {
  const configuredFrom = (process.env.FROM_EMAIL || SENDER_EMAIL).trim();
  const address = configuredFrom.match(/<([^<>]+)>/)?.[1]?.trim() || configuredFrom;
  return address.toLowerCase() === SENDER_EMAIL ? `Prime Line <${SENDER_EMAIL}>` : null;
};

const buildEmail = (contact) => {
  const countryName = DATA.countries.find((country) => country.code === contact.country)?.name || contact.country;
  const rows = [
    ['Inquiry Type', contact.inquiryType],
    ['First Name', contact.firstName],
    ['Last Name', contact.lastName],
    ['Email', contact.email],
    ['Company Name', contact.companyName],
    ['Business Type', contact.businessType],
    ['Phone Number', contact.phone],
    ['Website', contact.website || 'Not provided'],
    ['Address Line 1', contact.address1],
    ['Address Line 2', contact.address2 || 'Not provided'],
    ['City', contact.city],
    ['State / Province', contact.state || 'Not provided'],
    ['ZIP / Postal Code', contact.postalCode],
    ['Country', countryName],
    ['Message', contact.message]
  ];
  const escapedRows = rows.map(([label, value]) => `
    <tr>
      <th align="left" valign="top" style="width:145px;padding:12px 12px 12px 0;border-bottom:1px solid #eeeae3;color:#737984;font-weight:600;">${escapeHtml(label)}</th>
      <td style="padding:12px 0;border-bottom:1px solid #eeeae3;overflow-wrap:anywhere;white-space:pre-wrap;">${escapeHtml(value)}</td>
    </tr>
  `).join('');
  const text = [
    SUBJECT,
    '',
    ...rows.map(([label, value]) => `${label}: ${value || 'Not provided'}`)
  ].join('\n');

  return {
    text,
    html: `
      <div style="margin:0;background:#f7f6f2;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#17284d;">
        <div style="width:100%;max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e7e3dc;">
          <div style="padding:28px 24px;text-align:center;border-bottom:1px solid #eeeae3;">
            <img src="https://primelinehome.netlify.app/images/Logo1500.png" width="180" alt="Prime Line" style="display:block;width:180px;max-width:100%;height:auto;margin:0 auto;">
          </div>
          <div style="padding:30px 24px;">
            <h1 style="margin:0 0 24px;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:400;line-height:1.2;color:#17284d;">New Website Inquiry</h1>
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

const createDelivery = (recipient, from, email, contact) => ({
  from,
  to: [recipient],
  subject: SUBJECT,
  reply_to: contact.email,
  text: email.text,
  html: email.html
});

const deliverEmails = async (recipients, from, email, contact) => {
  const response = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(recipients.map((recipient) => createDelivery(recipient, from, email, contact)))
  });
  if (!response.ok) return { delivered: 0, failed: recipients.length, status: response.status };

  let result;
  try {
    result = await response.json();
  } catch {
    return { delivered: 0, failed: recipients.length, status: response.status };
  }
  const delivered = Array.isArray(result.data)
    ? result.data.filter((entry) => entry && typeof entry.id === 'string').length
    : 0;
  return { delivered, failed: Math.max(0, recipients.length - delivered), status: response.status };
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json({ error: 'Method not allowed.' }, 405, { Allow: 'POST' });

  const encodedBody = typeof event.body === 'string' ? event.body : '';
  if (event.isBase64Encoded && encodedBody.length > Math.ceil(MAX_REQUEST_BYTES * 4 / 3)) {
    return json({ error: 'The request is too large.' }, 413);
  }
  const bodyBuffer = event.isBase64Encoded
    ? Buffer.from(encodedBody, 'base64')
    : Buffer.from(encodedBody, 'utf8');
  if (bodyBuffer.byteLength > MAX_REQUEST_BYTES) return json({ error: 'The request is too large.' }, 413);

  let payload;
  try {
    payload = JSON.parse(bodyBuffer.toString('utf8'));
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return json({ error: 'Invalid request.' }, 400);
  }
  if (payload.contact_website !== undefined && payload.contact_website !== null) {
    if (typeof payload.contact_website !== 'string') return json({ error: 'Invalid submission.' }, 400);
    if (payload.contact_website.trim()) return json({ error: 'Invalid submission.' }, 400);
  }

  const validation = validateSubmission(payload);
  if (validation.error) return json({ error: validation.error }, 400);
  const contact = validation.contact;

  const apiKey = process.env.RESEND_API_KEY;
  const from = getFromAddress();
  if (!apiKey || !from) return json({ error: 'Email sending is not configured. Please try again later.' }, 503);

  let config = DEFAULT_ROUTING_CONFIG;
  try {
    config = await loadRoutingConfig();
  } catch (error) {
    console.error('Contact routing configuration unavailable; using the explicit fallback recipient.', error);
  }
  const recipients = resolveRecipients(contact, config);
  const email = buildEmail(contact);
  let delivery;
  try {
    delivery = await deliverEmails(recipients, from, email, contact);
  } catch {
    console.error('Contact email batch delivery request failed.');
    return json({ error: 'Your message could not be sent. Please try again later.' }, 502);
  }

  if (delivery.failed) {
    console.error('Contact email delivery had failures.', {
      delivered: delivery.delivered,
      failed: delivery.failed,
      status: delivery.status
    });
  }
  if (!delivery.delivered) return json({ error: 'Your message could not be sent. Please try again later.' }, 502);

  return json({
    sent: true,
    message: delivery.failed
      ? 'Your message was delivered to our team, but some notifications may be delayed.'
      : 'Thank you. Your message has been sent.'
  });
};
