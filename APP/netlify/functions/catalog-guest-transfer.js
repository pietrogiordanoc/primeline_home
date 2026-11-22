import { createHmac, randomUUID } from 'node:crypto';
import { adaptNetlifyHandler } from '../shared/adapt-netlify-handler.js';
import { isSameOrigin } from '../shared/admin-auth.js';
import {
  getActiveGrant,
  jsonResponse,
  normalizeEmail,
  validateGuestSession
} from '../shared/catalog-guest-access.js';

const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

export const createCatalogGuestTransferHandler = (dependencies = {}) => async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);
  if (!(dependencies.isSameOrigin || isSameOrigin)(event)) {
    return jsonResponse({ error: 'Request could not be completed.' }, 403);
  }

  const now = dependencies.now || Date.now;
  try {
    const authenticated = await (dependencies.validateSession || validateGuestSession)(event, {
      ...dependencies,
      now
    });
    const issuedAt = Math.floor(now() / 1000);
    if (!authenticated || !getActiveGrant(authenticated.grant, now())) {
      return jsonResponse({ error: 'Active catalog access is required.' }, 401);
    }

    const { grant } = authenticated;
    const customerEmail = normalizeEmail(grant.email);
    const sharedBy = normalizeEmail(grant.sharedBy);
    if (!customerEmail || !sharedBy || !/^[^\s@]+@primelinedist\.com$/.test(sharedBy)) {
      return jsonResponse({ error: 'Invitation details are unavailable. Please contact your sales representative.' }, 422);
    }

    const expiresAt = Math.min(
      issuedAt + 300,
      grant.expiresAt === null ? issuedAt + 300 : Math.floor(grant.expiresAt / 1000)
    );
    if (expiresAt <= issuedAt) {
      return jsonResponse({ error: 'Active catalog access is required.' }, 401);
    }

    const secret = (dependencies.getSigningSecret || (() => process.env.PDF_CATALOG_TRANSFER_SECRET))();
    if (typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < 32 || !secret.trim()) {
      console.error('PDF catalog transfer signing is not configured.');
      return jsonResponse({ error: 'Web Catalog transfer is temporarily unavailable.' }, 503);
    }

    const header = encode({ alg: 'HS256', typ: 'JWT' });
    const payload = encode({
      iss: 'https://primelinedist.com',
      aud: 'https://catalog.primelinedist.com',
      customerEmail,
      sharedBy,
      source: 'pdf_catalog_share',
      iat: issuedAt,
      exp: expiresAt,
      jti: randomUUID()
    });
    const signingInput = `${header}.${payload}`;
    const signature = createHmac('sha256', secret).update(signingInput).digest('base64url');
    return jsonResponse({ credential: `${signingInput}.${signature}` });
  } catch {
    console.error('PDF catalog transfer could not be created.');
    return jsonResponse({ error: 'Web Catalog transfer is temporarily unavailable.' }, 503);
  }
};

export default adaptNetlifyHandler(createCatalogGuestTransferHandler());
