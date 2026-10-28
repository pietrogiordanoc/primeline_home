import { randomInt, randomUUID } from 'node:crypto';
import { adaptNetlifyHandler } from '../shared/adapt-netlify-handler.js';
import {
  ADMIN_CHALLENGE_COOKIE,
  ADMIN_EMAIL,
  ADMIN_RESOURCE,
  checkRateLimit,
  hashOtp,
  hashValue,
  isSameOrigin,
  jsonResponse,
  makeCookie,
  parseJsonBody,
  getAdminStore,
  readCookie
} from '../shared/admin-auth.js';

const CODE_LIFETIME_MS = 10 * 60 * 1000;
const REQUEST_WINDOW_MS = 15 * 60 * 1000;
const GENERIC_RESPONSE = {
  message: 'If this address is authorized, a verification code has been sent.'
};

const genericResponse = (event, challengeId = '') => {
  const existingChallenge = readCookie(event, ADMIN_CHALLENGE_COOKIE);
  const cookieId = challengeId || existingChallenge || randomUUID();
  return jsonResponse(
    GENERIC_RESPONSE,
    202,
    [makeCookie(ADMIN_CHALLENGE_COOKIE, cookieId, CODE_LIFETIME_MS / 1000)]
  );
};

const sendCode = async (code) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  let response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.FROM_EMAIL || 'info@primelinedist.com',
        to: [ADMIN_EMAIL],
        subject: 'Your Prime Line Admin verification code',
        text: `Your Prime Line Admin verification code is ${code}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`,
        html: `
          <div style="margin:0;background:#f7f6f2;padding:40px 18px;font-family:Arial,Helvetica,sans-serif;color:#17284d;">
            <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e7e3dc;">
              <div style="padding:28px 24px;text-align:center;border-bottom:1px solid #eeeae3;">
                <img src="https://primelinehome.netlify.app/images/Logo1500.png" width="180" alt="Prime Line" style="display:block;width:180px;height:auto;margin:0 auto;">
              </div>
              <div style="padding:38px 28px;text-align:center;">
                <div style="color:#c4933b;font-size:11px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;">Private Administration</div>
                <h1 style="margin:14px 0;color:#17284d;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:400;">Verification code</h1>
                <p style="color:#737984;font-size:14px;line-height:1.6;">Enter this code to sign in to Prime Line Admin.</p>
                <div style="display:inline-block;margin:14px 0;padding:14px 22px;border:1px solid #d9dce1;color:#17284d;font-family:Georgia,'Times New Roman',serif;font-size:34px;letter-spacing:8px;">${code}</div>
                <p style="color:#737984;font-size:12px;">This code expires in 10 minutes.</p>
              </div>
            </div>
          </div>
        `
      })
    });
  } catch (error) {
    console.error('Admin OTP email request failed.', error);
    return false;
  }

  if (!response.ok) {
    console.error('Admin OTP email was rejected by the provider.', { status: response.status });
    return false;
  }
  return true;
};

export const createRequestAdminCodeHandler = (sendVerificationCode = sendCode) => async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);
  if (!isSameOrigin(event)) return jsonResponse({ error: 'Request could not be completed.' }, 403);

  const { payload, error } = parseJsonBody(event);
  if (error || typeof payload.email !== 'string' || payload.email.length > 254) {
    return jsonResponse({ error: 'Invalid request.' }, error === 'too-large' ? 413 : 400);
  }

  const email = payload.email.trim().toLowerCase();
  if (email !== ADMIN_EMAIL) return genericResponse(event);

  let store;
  try {
    store = await getAdminStore();
    const emailKey = hashValue(ADMIN_EMAIL);
    const allowed = await checkRateLimit(
      store,
      `admin:rate:request:${emailKey}`,
      3,
      REQUEST_WINDOW_MS
    );
    if (!allowed) return genericResponse(event);

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const challengeId = randomUUID();
    const now = Date.now();
    const activeChallengeKey = `admin:active-challenge:${emailKey}`;
    const previousChallengeId = await store.get(activeChallengeKey);
    if (previousChallengeId) await store.delete(`admin:challenge:${previousChallengeId}`);
    await store.setJSON(`admin:challenge:${challengeId}`, {
      email: ADMIN_EMAIL,
      resource: ADMIN_RESOURCE,
      codeHash: hashOtp(challengeId, code),
      attempts: 0,
      createdAt: now,
      expiresAt: now + CODE_LIFETIME_MS
    });
    await store.set(activeChallengeKey, challengeId);

    if (!(await sendVerificationCode(code))) {
      await store.delete(`admin:challenge:${challengeId}`);
      await store.delete(activeChallengeKey);
      return genericResponse(event);
    }

    return genericResponse(event, challengeId);
  } catch (error) {
    console.error('Admin OTP request could not be processed.', error);
    return genericResponse(event);
  }
};

export default adaptNetlifyHandler(createRequestAdminCodeHandler());
