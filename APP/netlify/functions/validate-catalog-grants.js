import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { adaptNetlifyHandler } from '../shared/adapt-netlify-handler.js';
import { getActiveGrant, getGrantStore, hashToken, jsonResponse, normalizeEmail, parseBody } from '../shared/catalog-guest-access.js';
import { getTransferClaimStore } from './catalog-web-transfer.js';

const ISSUER = 'https://catalog.primelinedist.com';
const AUDIENCE = 'https://primelinedist.com/.netlify/functions/validate-catalog-grants';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CUSTOMER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STAFF_EMAIL = /^[^\s@]+@primelinedist\.com$/;
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');

const decodeJson = value => {
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.toString('base64url') !== value) throw new Error('Invalid encoding');
  const parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid JSON');
  return parsed;
};

export const verifyGrantValidationRequest = (credential, secret, nowSeconds) => {
  if (typeof credential !== 'string' || credential.length > 65536 ||
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
    const email = normalizeEmail(claims.customerEmail);
    if (header.alg !== 'HS256' || header.typ !== 'JWT' || 'crit' in header || 'b64' in header ||
        claims.iss !== ISSUER || claims.aud !== AUDIENCE || claims.source !== 'web_pdf_grant_validation_request' ||
        typeof claims.sub !== 'string' || !CUSTOMER_ID.test(claims.sub) ||
        typeof claims.jti !== 'string' || !UUID.test(claims.jti) ||
        !email || claims.customerEmail !== email ||
        !Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp) ||
        claims.iat > nowSeconds + 30 || claims.exp <= nowSeconds || claims.exp - claims.iat !== 30 ||
        !Array.isArray(claims.grants) || !claims.grants.length) return null;
    const ids = new Set();
    for (const candidate of claims.grants) {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate) ||
          typeof candidate.pdfGrantId !== 'string' || !UUID.test(candidate.pdfGrantId) ||
          candidate.pdfGrantId !== candidate.pdfGrantId.toLowerCase() ||
          candidate.customerEmail !== email ||
          !normalizeEmail(candidate.invitingStaffEmail) ||
          candidate.invitingStaffEmail !== normalizeEmail(candidate.invitingStaffEmail) ||
          !STAFF_EMAIL.test(candidate.invitingStaffEmail) || ids.has(candidate.pdfGrantId)) return null;
      ids.add(candidate.pdfGrantId);
    }
    return claims;
  } catch {
    return null;
  }
};

export const createValidateCatalogGrantsHandler = (dependencies = {}) => async event => {
  if (event.httpMethod !== 'POST') return jsonResponse({ code: 'method_not_allowed', error: 'Method not allowed.' }, 405);
  const payload = (dependencies.parseBody || parseBody)(event, 90000);
  if (!payload || typeof payload.credential !== 'string') {
    return jsonResponse({ code: 'invalid_request', error: 'Invalid validation request.' }, 400);
  }
  const secret = (dependencies.getSigningSecret || (() => process.env.PDF_CATALOG_TRANSFER_SECRET))();
  if (typeof secret !== 'string' || !secret.trim() || Buffer.byteLength(secret) < 32) {
    console.error('PDF grant validation signing is not configured.');
    return jsonResponse({ code: 'grant_validation_unavailable', error: 'Grant validation is unavailable.' }, 503);
  }
  const now = dependencies.now || Date.now;
  const claims = verifyGrantValidationRequest(payload.credential, secret, Math.floor(now() / 1000));
  const invalid = () => jsonResponse({ code: 'invalid_or_expired_validation_request', error: 'Validation request is invalid or expired.' }, 401);
  if (!claims) return invalid();

  try {
    const claimStore = await (dependencies.getClaimStore || getTransferClaimStore)();
    const claimed = await claimStore.setJSON(`claim:${hashToken(claims.jti)}`, { expiresAt: claims.exp * 1000 }, { onlyIfNew: true });
    if (!claimed || claimed.modified !== true || claims.exp * 1000 <= now()) return invalid();
    const grantStore = await (dependencies.getGrantStore || getGrantStore)();
    const grants = [];
    for (const candidate of claims.grants) {
      const grant = await grantStore.get(`grant:${candidate.pdfGrantId}`, { type: 'json' });
      if (grant?.id !== candidate.pdfGrantId || grant.status !== 'active' ||
          !getActiveGrant(grant, now()) || grant.email !== candidate.customerEmail ||
          grant.sharedBy !== candidate.invitingStaffEmail) continue;
      const expiresAt = grant.expiresAt === null ? null : Math.floor(grant.expiresAt / 1000);
      if (expiresAt !== null && (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(now() / 1000))) continue;
      grants.push({
        pdfGrantId: grant.id,
        customerEmail: grant.email,
        invitingStaffEmail: grant.sharedBy,
        status: 'active',
        revokedAt: null,
        expiresAt
      });
    }
    if (claims.exp * 1000 <= now()) return invalid();
    const issuedAt = Math.floor(now() / 1000);
    const header = encode({ alg: 'HS256', typ: 'JWT' });
    const body = encode({
      iss: 'https://primelinedist.com', aud: ISSUER, source: 'home_pdf_grant_validation',
      sub: claims.sub, customerEmail: claims.customerEmail, requestJti: claims.jti,
      jti: randomUUID(), iat: issuedAt, exp: issuedAt + 60,
      grants: grants.filter(grant => grant.expiresAt === null || grant.expiresAt > issuedAt)
    });
    const input = `${header}.${body}`;
    const credential = `${input}.${createHmac('sha256', secret).update(input).digest('base64url')}`;
    if (credential.length > 65536) throw new Error('Validation response is too large.');
    if (claims.exp * 1000 <= now()) return invalid();
    return jsonResponse({ credential });
  } catch {
    console.error('PDF grant validation could not check authoritative state.');
    return jsonResponse({ code: 'grant_validation_unavailable', error: 'Grant validation is unavailable.' }, 503);
  }
};

export default adaptNetlifyHandler(createValidateCatalogGrantsHandler());
