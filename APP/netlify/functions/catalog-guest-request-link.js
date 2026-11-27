import { adaptNetlifyHandler } from '../shared/adapt-netlify-handler.js';
import { isSameOrigin } from '../shared/admin-auth.js';
import {
  checkGuestRateLimit,
  getGrantStore,
  hashEmail,
  isGuestDuration,
  jsonResponse,
  listStoreRecords,
  normalizeEmail,
  parseBody
} from '../shared/catalog-guest-access.js';
import { createGuestVerification, removeGuestVerification, sendVerificationEmail } from '../shared/catalog-guest-verification.js';

const genericResponse = () => jsonResponse({
  message: 'If active catalog access exists, you may receive a one-time verification link. If you do not receive one, contact the employee who invited you.'
}, 202);

export const createCatalogGuestRequestLinkHandler = (dependencies = {}) => async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);
  if (!(dependencies.isSameOrigin || isSameOrigin)(event)) return jsonResponse({ error: 'Request could not be completed.' }, 403);
  const payload = (dependencies.parseBody || parseBody)(event);
  const email = (dependencies.normalizeEmail || normalizeEmail)(payload?.email);
  if (!payload || !email) return jsonResponse({ error: 'Enter a valid email address.' }, 400);

  const now = dependencies.now || Date.now;
  const hash = (dependencies.hashEmail || hashEmail)(email);
  try {
    if (!(await (dependencies.rateLimit || checkGuestRateLimit)(hash, 3, 60 * 60 * 1000, now))) return genericResponse();

    const grantStore = await (dependencies.getGrantStore || getGrantStore)();
    const grants = await (dependencies.listRecords || listStoreRecords)(grantStore, 'grant:');
    const activeGrants = grants.filter((item) =>
      item.email === email &&
      isGuestDuration(item.duration) &&
      item.status === 'active' &&
      !item.revokedAt &&
      (item.expiresAt === null || (Number.isFinite(item.expiresAt) && item.expiresAt > now()))
    );
    if (!activeGrants.length) return genericResponse();

    const links = [];
    for (const grant of activeGrants) {
      links.push(await createGuestVerification(grant, { ...dependencies, now }));
    }
    const sent = await sendVerificationEmail(email, links, dependencies);
    if (!sent) {
      for (const link of links) await removeGuestVerification(link, dependencies);
      console.error('Resend rejected a catalog guest verification email.');
    }
    return genericResponse();
  } catch {
    console.error('Catalog guest verification link request failed.');
    return jsonResponse({ error: 'Catalog verification is temporarily unavailable.' }, 503);
  }
};

export default adaptNetlifyHandler(createCatalogGuestRequestLinkHandler());
