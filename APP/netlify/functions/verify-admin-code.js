import { randomUUID, timingSafeEqual } from 'node:crypto';
import {
  ADMIN_CHALLENGE_COOKIE,
  ADMIN_EMAIL,
  ADMIN_RESOURCE,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_LIFETIME_SECONDS,
  checkRateLimit,
  getAdminStore,
  hashOtp,
  hashValue,
  isSameOrigin,
  jsonResponse,
  makeCookie,
  parseJsonBody,
  readCookie
} from '../shared/admin-auth.js';

const CODE_LIFETIME_MS = 10 * 60 * 1000;
const MAX_CHALLENGE_ATTEMPTS = 5;
const VERIFY_WINDOW_MS = 60 * 60 * 1000;
const GENERIC_ERROR = 'The code is invalid or expired. Request a new code and try again.';

const matchesHash = (submitted, expected) => {
  if (typeof expected !== 'string' || !/^[0-9a-f]{64}$/i.test(expected)) return false;
  const submittedBuffer = Buffer.from(submitted, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  return submittedBuffer.length === expectedBuffer.length && timingSafeEqual(submittedBuffer, expectedBuffer);
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);
  if (!isSameOrigin(event)) return jsonResponse({ error: 'Request could not be completed.' }, 403);

  const { payload, error } = parseJsonBody(event);
  if (error || typeof payload.code !== 'string' || !/^\d{6}$/.test(payload.code)) {
    return jsonResponse({ error: GENERIC_ERROR }, error === 'too-large' ? 413 : 401);
  }

  const challengeId = readCookie(event, ADMIN_CHALLENGE_COOKIE);
  if (!/^[0-9a-f-]{36}$/i.test(challengeId)) return jsonResponse({ error: GENERIC_ERROR }, 401);

  try {
    const store = await getAdminStore();
    const verifyAllowed = await checkRateLimit(
      store,
      `admin:rate:verify:${hashValue(ADMIN_EMAIL)}`,
      15,
      VERIFY_WINDOW_MS
    );
    if (!verifyAllowed) return jsonResponse({ error: GENERIC_ERROR }, 401);

    const key = `admin:challenge:${challengeId}`;
    const challenge = await store.get(key, { type: 'json' });
    const activeChallengeId = await store.get(`admin:active-challenge:${hashValue(ADMIN_EMAIL)}`);
    if (
      !challenge ||
      activeChallengeId !== challengeId ||
      challenge.email !== ADMIN_EMAIL ||
      challenge.resource !== ADMIN_RESOURCE ||
      !Number.isFinite(challenge.expiresAt) ||
      challenge.expiresAt <= Date.now()
    ) {
      if (challenge) await store.delete(key);
      return jsonResponse({ error: GENERIC_ERROR }, 401);
    }

    if (challenge.attempts >= MAX_CHALLENGE_ATTEMPTS) {
      return jsonResponse({ error: GENERIC_ERROR }, 401);
    }

    if (!matchesHash(hashOtp(challengeId, payload.code), challenge.codeHash)) {
      challenge.attempts += 1;
      if (challenge.attempts >= MAX_CHALLENGE_ATTEMPTS) {
        await store.delete(key);
        await store.delete(`admin:active-challenge:${hashValue(ADMIN_EMAIL)}`);
      } else {
        await store.setJSON(key, challenge);
      }
      return jsonResponse({ error: GENERIC_ERROR }, 401);
    }

    const sessionId = randomUUID();
    await store.setJSON(`admin:session:${sessionId}`, {
      email: ADMIN_EMAIL,
      resource: ADMIN_RESOURCE,
      createdAt: Date.now(),
      expiresAt: Date.now() + ADMIN_SESSION_LIFETIME_SECONDS * 1000
    });
    await store.delete(key);
    await store.delete(`admin:active-challenge:${hashValue(ADMIN_EMAIL)}`);

    return jsonResponse(
      { authenticated: true },
      200,
      [
        makeCookie(ADMIN_SESSION_COOKIE, sessionId, ADMIN_SESSION_LIFETIME_SECONDS),
        makeCookie(ADMIN_CHALLENGE_COOKIE, '', 0)
      ]
    );
  } catch (error) {
    console.error('Admin OTP verification could not be processed.', error);
    return jsonResponse({ error: 'Verification is temporarily unavailable.' }, 503);
  }
};
