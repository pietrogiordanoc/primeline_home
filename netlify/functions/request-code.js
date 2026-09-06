import { createHash, randomInt, randomUUID } from 'node:crypto';

const CODE_LIFETIME_MS = 10 * 60 * 1000;
const COOKIE_LIFETIME_SECONDS = 10 * 60;
const allowedDomain = '@primelinedist.com';

const json = (body, statusCode = 200, headers = {}) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(body)
});

const cookie = (name, value, maxAge) => `${name}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;

const getAccessStore = async () => {
  const { getStore } = await import('@netlify/blobs');
  return getStore({
    name: 'prime-line-access',
    consistency: 'strong',
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_AUTH_TOKEN
  });
};

export const handler = async (event) => {
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

  const code = String(randomInt(0, 1000)).padStart(3, '0');
  const challengeId = randomUUID();
  const store = await getAccessStore();
  await store.setJSON(`challenge:${challengeId}`, {
    email,
    resource,
    codeHash: createHash('sha256').update(code).digest('hex'),
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
      text: `Your Prime Line access code is ${code}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`,
      html: `
        <div style="margin:0;background:#f7f6f2;padding:42px 20px;font-family:Arial,Helvetica,sans-serif;color:#17284d;">
          <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e7e3dc;">
            <div style="padding:30px 34px 24px;text-align:center;border-bottom:1px solid #eeeae3;">
              <img src="https://primelinehome.netlify.app/images/Logo1500.png" width="180" alt="Prime Line" style="display:block;width:180px;height:auto;margin:0 auto;">
            </div>
            <div style="padding:42px 34px 46px;text-align:center;">
              <div style="color:#c4933b;font-size:11px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;">Private Access</div>
              <h1 style="margin:14px 0 12px;color:#17284d;font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:400;">Your access code</h1>
              <p style="margin:0 auto 28px;max-width:350px;color:#737984;font-size:14px;line-height:1.6;">Use this code to continue to your Prime Line private access page.</p>
              <div style="display:inline-block;min-width:180px;padding:16px 24px;border:1px solid #d9dce1;color:#17284d;font-family:Georgia,'Times New Roman',serif;font-size:34px;letter-spacing:10px;line-height:1;">${code}</div>
              <p style="margin:24px 0 0;color:#737984;font-size:12px;line-height:1.5;">This code expires in 10 minutes and can only be used once.</p>
            </div>
            <div style="padding:18px 24px;text-align:center;border-top:1px solid #eeeae3;color:#969ba3;font-size:11px;line-height:1.5;">If you did not request this code, you can safely ignore this email.</div>
          </div>
        </div>
      `
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
