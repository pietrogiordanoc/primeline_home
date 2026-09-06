const crypto = require('node:crypto');
const { getStore } = require('@netlify/blobs');

const CODE_LIFETIME_MS = 10 * 60 * 1000;
const COOKIE_LIFETIME_SECONDS = 10 * 60;
const allowedDomain = '@primelinedist.com';

const json = (body, statusCode = 200, headers = {}) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(body)
});

const cookie = (name, value, maxAge) => `${name}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  const email = String(payload.email || '').trim().toLowerCase();
  const resource = String(payload.resource || '').trim();
  if (!email.endsWith(allowedDomain) || !resource) {
    return json({ error: 'Invalid request.' }, 400);
  }

  const code = String(crypto.randomInt(0, 1000)).padStart(3, '0');
  const challengeId = crypto.randomUUID();
  const store = getStore({ name: 'prime-line-access', consistency: 'strong' });
  await store.setJSON(`challenge:${challengeId}`, {
    email,
    resource,
    codeHash: crypto.createHash('sha256').update(code).digest('hex'),
    attempts: 0,
    createdAt: Date.now(),
    expiresAt: Date.now() + CODE_LIFETIME_MS
  });

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.FROM_EMAIL || 'info@primelinedist.com',
      to: [email],
      subject: 'Your Prime Line access code',
      text: `Your Prime Line access code is ${code}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`
    })
  });

  if (!resendResponse.ok) {
    await store.delete(`challenge:${challengeId}`);
    return json({ error: 'Could not send access code.' }, 502);
  }

  return json(
    { message: 'Access code sent.' },
    200,
    { 'Set-Cookie': cookie('access_challenge', challengeId, COOKIE_LIFETIME_SECONDS) }
  );
};
