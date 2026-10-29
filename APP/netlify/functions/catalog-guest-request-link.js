import { adaptNetlifyHandler } from '../shared/adapt-netlify-handler.js';
import { isSameOrigin } from '../shared/admin-auth.js';
import {
  GUEST_VERIFICATION_LIFETIME_MS,
  checkGuestRateLimit,
  createOpaqueToken,
  escapeHtml,
  getGrantStore,
  getVerificationStore,
  hashEmail,
  hashToken,
  isGuestDuration,
  jsonResponse,
  listStoreRecords,
  normalizeEmail,
  parseBody,
  sendGuestEmail
} from '../shared/catalog-guest-access.js';

const genericResponse = () => jsonResponse({
  message: 'If active catalog access exists, you may receive a one-time verification link. If you do not receive one, contact the employee who invited you.'
}, 202);

const getPublicBaseUrl = () => {
  const parsed = new URL(process.env.URL || 'https://primelinedist.com');
  if (parsed.protocol !== 'https:') throw new Error('Invalid public site URL.');
  return parsed.origin;
};

const sendVerificationEmail = async (email, token, grant, dependencies) => {
  const baseUrl = (dependencies.getPublicBaseUrl || getPublicBaseUrl)();
  const link = `${baseUrl}/catalog-pdf/guest/#verify=${encodeURIComponent(token)}`;
  const durationText = grant.expiresAt === null
    ? 'No expiration'
    : new Date(grant.expiresAt).toLocaleDateString('en-US', { dateStyle: 'long', timeZone: 'UTC' });
  const safeEmail = escapeHtml(email);
  const safeDuration = escapeHtml(durationText);
  return (dependencies.sendEmail || sendGuestEmail)({
    to: email,
    subject: 'Prime Line | Verify your catalog access',
    text: `Use this one-time link to open the catalog: ${link}\n\nYour authorized access remains valid until ${durationText}.`,
    html: `
      <div style="margin:0;background:#f7f6f2;padding:40px 18px;font-family:Arial,Helvetica,sans-serif;color:#17284d;">
        <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e7e3dc;">
          <div style="padding:26px 24px;text-align:center;border-bottom:1px solid #eeeae3;">
            <img src="${baseUrl}/images/Logo1500.png" width="180" alt="Prime Line" style="display:block;width:180px;height:auto;margin:0 auto;">
          </div>
          <div style="padding:34px 28px;text-align:center;">
            <div style="color:#c4933b;font-size:11px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;">Catalog Access</div>
            <h1 style="margin:14px 0;color:#17284d;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:400;">Verify your access</h1>
            <p style="color:#737984;font-size:13px;line-height:1.6;">This one-time link is for ${safeEmail}. Your catalog access remains authorized until ${safeDuration}.</p>
            <a href="${link}" style="display:inline-block;margin-top:12px;padding:14px 22px;background:#17284d;color:#fff;text-decoration:none;font-size:12px;font-weight:bold;letter-spacing:1px;">OPEN CATALOG</a>
          </div>
          <div style="padding:16px 22px;text-align:center;border-top:1px solid #eeeae3;color:#969ba3;font-size:11px;">This verification link expires in 15 minutes and can be used once.</div>
        </div>
      </div>
    `
  });
};

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
    activeGrants.sort((a, b) => {
      if (a.expiresAt === null) return b.expiresAt === null ? b.createdAt - a.createdAt : -1;
      if (b.expiresAt === null) return 1;
      return b.expiresAt - a.expiresAt;
    });
    const grant = activeGrants[0];
    if (!grant) return genericResponse();

    const token = (dependencies.createToken || createOpaqueToken)();
    const tokenHash = (dependencies.hashToken || hashToken)(token);
    const verificationStore = await (dependencies.getVerificationStore || getVerificationStore)();
    const record = {
      grantId: grant.id,
      email,
      tokenHash,
      createdAt: now(),
      expiresAt: now() + GUEST_VERIFICATION_LIFETIME_MS,
      usedAt: null
    };
    await verificationStore.setJSON(`verification:${grant.id}:${tokenHash}`, record);
    await verificationStore.setJSON(`token:${tokenHash}`, { grantId: grant.id });
    const sent = await sendVerificationEmail(email, token, grant, dependencies);
    if (!sent) {
      await verificationStore.delete(`verification:${grant.id}:${tokenHash}`);
      await verificationStore.delete(`token:${tokenHash}`);
      console.error('Resend rejected a catalog guest verification email.');
    }
    return genericResponse();
  } catch {
    console.error('Catalog guest verification link request failed.');
    return jsonResponse({ error: 'Catalog verification is temporarily unavailable.' }, 503);
  }
};

export default adaptNetlifyHandler(createCatalogGuestRequestLinkHandler());
