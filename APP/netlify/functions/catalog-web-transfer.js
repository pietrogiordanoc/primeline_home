import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { adaptNetlifyHandler } from '../shared/adapt-netlify-handler.js';
import { isSameOrigin } from '../shared/admin-auth.js';
import {
  GUEST_DEVICE_COOKIE, getActiveGrant, getEmployeeCatalogSession,
  getGrantStore, getGuestSessionStore, getStore, hashDeviceId, hashToken,
  jsonResponse, normalizeEmail, parseBody, readCookie, validateGuestSession
} from '../shared/catalog-guest-access.js';
import { verifyWebStaff } from '../shared/catalog-web-staff.js';

const ISSUER = 'https://catalog.primelinedist.com';
const AUDIENCE = 'https://primelinedist.com/.netlify/functions/catalog-web-transfer';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AUTH_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CORPORATE_EMAIL = /^[^\s@]+@primelinedist\.com$/;
const CLAIM_STORE = 'prime-line-web-transfer-claims';

export const getTransferClaimStore = () => getStore(CLAIM_STORE);

const decodeJson = (value) => {
  const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
};

export const verifyTransferCredential = (credential, secret, nowSeconds) => {
  if (typeof credential !== 'string' || credential.length > 6000 ||
      typeof secret !== 'string' || !secret.trim() || Buffer.byteLength(secret) < 32) return null;
  const parts = credential.split('.');
  if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) return null;
  try {
    const expected = createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
    const signature = Buffer.from(parts[2], 'base64url');
    if (signature.length !== expected.length || signature.toString('base64url') !== parts[2] ||
        !timingSafeEqual(expected, signature)) return null;
    const header = decodeJson(parts[0]);
    const claims = decodeJson(parts[1]);
    const email = normalizeEmail(claims?.email);
    if (!header || header.alg !== 'HS256' || header.typ !== 'JWT' || 'crit' in header || 'b64' in header || !claims ||
        claims.iss !== ISSUER || claims.aud !== AUDIENCE || claims.source !== 'web_catalog_mode' ||
        !AUTH_UUID.test(claims.sub || '') || !UUID.test(claims.jti || '') ||
        !email || claims.email !== email || !Number.isSafeInteger(claims.iat) ||
        !Number.isSafeInteger(claims.exp) || claims.iat > nowSeconds + 30 ||
        claims.exp <= nowSeconds || claims.exp <= claims.iat || claims.exp - claims.iat > 120) return null;
    if (claims.userType === 'staff') {
      if (!CORPORATE_EMAIL.test(email) || typeof claims.staffId !== 'string' ||
          !claims.staffId || claims.staffId.length > 128 ||
          typeof claims.staffRole !== 'string' || !claims.staffRole || claims.staffRole.length > 128) return null;
    } else if (claims.userType === 'customer') {
      if (typeof claims.customerId !== 'string' || !claims.customerId || claims.customerId.length > 128) return null;
    } else return null;
    return claims;
  } catch {
    return null;
  }
};

export const createCatalogWebTransferHandler = (dependencies = {}) => async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);
  if (!(dependencies.isSameOrigin || isSameOrigin)(event)) return jsonResponse({ error: 'Request could not be completed.' }, 403);
  const now = dependencies.now || Date.now;
  const secret = (dependencies.getSigningSecret || (() => process.env.PDF_CATALOG_TRANSFER_SECRET))();
  if (typeof secret !== 'string' || !secret.trim() || Buffer.byteLength(secret) < 32) {
    console.error('Web catalog transfer signing is not configured.');
    return jsonResponse({ error: 'Catalog transfer is temporarily unavailable.' }, 503);
  }
  const payload = (dependencies.parseBody || parseBody)(event);
  const claims = verifyTransferCredential(payload?.credential, secret, Math.floor(now() / 1000));
  if (!claims) return jsonResponse({ error: 'This transfer is invalid or expired.' }, 401);

  try {
    const claimStore = await (dependencies.getClaimStore || getTransferClaimStore)();
    const claim = await claimStore.setJSON(`claim:${hashToken(claims.jti)}`, { expiresAt: claims.exp * 1000 }, { onlyIfNew: true });
    if (!claim || claim.modified !== true) return jsonResponse({ error: 'This transfer has already been used.' }, 409);
    if (claims.exp * 1000 <= now()) return jsonResponse({ error: 'This transfer is invalid or expired.' }, 401);

    if (claims.userType === 'staff') {
      const verified = await (dependencies.verifyStaff || verifyWebStaff)({
        email: claims.email, authUserId: claims.sub, staffId: claims.staffId
      });
      if (!verified) return jsonResponse({ error: 'Employee catalog access could not be authorized.' }, 403);
      if (claims.exp * 1000 <= now()) return jsonResponse({ error: 'This transfer is invalid or expired.' }, 401);
      const existing = await (dependencies.getEmployeeSession || getEmployeeCatalogSession)(
        event, dependencies.getEmployeeStore, now()
      );
      if (claims.exp * 1000 <= now()) return jsonResponse({ error: 'This transfer is invalid or expired.' }, 401);
      if (existing?.email === claims.email) return jsonResponse({ resource: 'catalog-pdf' });
      const store = await (dependencies.getEmployeeStore || (() => getStore('prime-line-access')))();
      const sessionId = randomUUID();
      const lifetime = 7 * 24 * 60 * 60;
      const createdAt = now();
      await store.setJSON(`session:${sessionId}`, {
        email: claims.email, resource: 'catalog-pdf', source: 'web_catalog_mode',
        authUserId: claims.sub, staffId: claims.staffId, createdAt, expiresAt: createdAt + lifetime * 1000
      });
      if (claims.exp * 1000 <= now()) return jsonResponse({ error: 'This transfer is invalid or expired.' }, 401);
      return jsonResponse({ resource: 'catalog-pdf' }, 200, [
        `access_session=${sessionId}; Max-Age=${lifetime}; Path=/; HttpOnly; Secure; SameSite=Lax`
      ]);
    }

    const deviceId = readCookie(event, GUEST_DEVICE_COOKIE);
    if (!UUID.test(deviceId)) {
      return jsonResponse({ error: 'Open your existing catalog invitation on this device to continue.', code: 'invitation_required' }, 403);
    }
    const deviceHash = hashDeviceId(deviceId);
    const existing = await (dependencies.validateGuestSession || validateGuestSession)(event, {
      getGrantStore: dependencies.getGrantStore || getGrantStore,
      getGuestSessionStore: dependencies.getGuestSessionStore || getGuestSessionStore,
      now
    });
    if (claims.exp * 1000 <= now()) return jsonResponse({ error: 'This transfer is invalid or expired.' }, 401);
    if (existing?.session?.deviceHash === deviceHash &&
        normalizeEmail(existing.grant?.email) === claims.email &&
        getActiveGrant(existing.grant, now()) &&
        Array.isArray(existing.grant.deviceHashes) && existing.grant.deviceHashes.includes(deviceHash)) {
      if (claims.exp * 1000 <= now()) return jsonResponse({ error: 'This transfer is invalid or expired.' }, 401);
      return jsonResponse({ resource: 'catalog-guest' });
    }
    return jsonResponse({ error: 'Open your catalog invitation or verify your email to continue.', code: 'invitation_required' }, 403);
  } catch {
    console.error('Web catalog transfer could not be completed.');
    return jsonResponse({ error: 'Catalog transfer is temporarily unavailable.' }, 503);
  }
};

export default adaptNetlifyHandler(createCatalogWebTransferHandler());
