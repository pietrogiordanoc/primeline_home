const MAX_REQUEST_BYTES = 20 * 1024;
const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const MAX_PHONE_LENGTH = 50;
const MAX_MESSAGE_LENGTH = 5000;
const SENDER_EMAIL = 'info@primelinedist.com';
const RECIPIENT_EMAIL = 'info@primelinedist.com';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

const buildEmail = ({ name, email, phone, message }) => {
  const phoneValue = phone || 'Not provided';
  const escaped = {
    name: escapeHtml(name),
    email: escapeHtml(email),
    phone: escapeHtml(phoneValue),
    message: escapeHtml(message)
  };

  return {
    text: [
      'PRIME LINE | New Website Inquiry',
      '',
      `Name: ${name}`,
      `Email: ${email}`,
      `Phone: ${phoneValue}`,
      '',
      'Message:',
      message
    ].join('\n'),
    html: `
      <div style="margin:0;background:#f7f6f2;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#17284d;">
        <div style="width:100%;max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e7e3dc;">
          <div style="padding:28px 24px;text-align:center;border-bottom:1px solid #eeeae3;">
            <img src="https://primelinehome.netlify.app/images/Logo1500.png" width="180" alt="Prime Line" style="display:block;width:180px;max-width:100%;height:auto;margin:0 auto;">
          </div>
          <div style="padding:30px 24px;">
            <h1 style="margin:0 0 24px;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:400;line-height:1.2;color:#17284d;">New Website Inquiry</h1>
            <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;line-height:1.6;">
              <tr><th align="left" style="width:120px;padding:12px 10px 12px 0;border-bottom:1px solid #eeeae3;color:#737984;font-weight:600;">Name</th><td style="padding:12px 0;border-bottom:1px solid #eeeae3;overflow-wrap:anywhere;">${escaped.name}</td></tr>
              <tr><th align="left" style="padding:12px 10px 12px 0;border-bottom:1px solid #eeeae3;color:#737984;font-weight:600;">Email</th><td style="padding:12px 0;border-bottom:1px solid #eeeae3;overflow-wrap:anywhere;">${escaped.email}</td></tr>
              <tr><th align="left" style="padding:12px 10px 12px 0;border-bottom:1px solid #eeeae3;color:#737984;font-weight:600;">Phone</th><td style="padding:12px 0;border-bottom:1px solid #eeeae3;overflow-wrap:anywhere;">${escaped.phone}</td></tr>
              <tr><th align="left" valign="top" style="padding:12px 10px 12px 0;color:#737984;font-weight:600;">Message</th><td style="padding:12px 0;white-space:pre-wrap;overflow-wrap:anywhere;">${escaped.message}</td></tr>
            </table>
          </div>
          <div style="padding:18px 24px;text-align:center;border-top:1px solid #eeeae3;color:#737984;font-size:11px;line-height:1.5;">
            Prime Line<br>Importers of Selected Specialty Foods
          </div>
        </div>
      </div>
    `
  };
};

const getFromAddress = () => {
  const configuredFrom = (process.env.FROM_EMAIL || SENDER_EMAIL).trim();
  const address = configuredFrom.match(/<([^<>]+)>/)?.[1]?.trim() || configuredFrom;
  return address.toLowerCase() === SENDER_EMAIL ? `Prime Line <${SENDER_EMAIL}>` : null;
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
  if (payload.website !== undefined && payload.website !== null) {
    if (typeof payload.website !== 'string' || payload.website.trim()) {
      return json({ error: 'Invalid submission.' }, 400);
    }
  }

  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const email = typeof payload.email === 'string' ? payload.email.trim() : '';
  const phone = typeof payload.phone === 'string' ? payload.phone.trim() : '';
  const message = typeof payload.message === 'string' ? payload.message.trim() : '';
  if (!name || name.length > MAX_NAME_LENGTH) return json({ error: 'Please enter your name (up to 120 characters).' }, 400);
  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    return json({ error: 'Please enter a valid email address.' }, 400);
  }
  if (payload.phone !== undefined && typeof payload.phone !== 'string') return json({ error: 'Please enter a valid phone number.' }, 400);
  if (phone.length > MAX_PHONE_LENGTH) return json({ error: 'Phone must be 50 characters or fewer.' }, 400);
  if (!message || message.length > MAX_MESSAGE_LENGTH) {
    return json({ error: 'Please enter a message (up to 5000 characters).' }, 400);
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = getFromAddress();
  if (!apiKey || !from) return json({ error: 'Email sending is not configured. Please try again later.' }, 503);

  const emailContent = buildEmail({ name, email, phone, message });
  let resendResponse;
  try {
    resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: [RECIPIENT_EMAIL],
        subject: 'PRIME LINE | New Website Inquiry',
        reply_to: email,
        text: emailContent.text,
        html: emailContent.html
      })
    });
  } catch {
    console.error('Contact email delivery request failed.');
    return json({ error: 'Your message could not be sent. Please try again later.' }, 502);
  }

  if (!resendResponse.ok) {
    console.error('Contact email delivery was rejected by the email provider.', { status: resendResponse.status });
    return json({ error: 'Your message could not be sent. Please try again later.' }, 502);
  }

  return json({ sent: true, message: 'Thank you. Your message has been sent.' });
};
