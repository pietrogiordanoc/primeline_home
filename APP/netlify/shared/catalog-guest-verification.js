import {
  GUEST_VERIFICATION_LIFETIME_MS,
  createOpaqueToken,
  escapeHtml,
  getPublicBaseUrl,
  getVerificationStore,
  hashToken,
  sendGuestEmail
} from './catalog-guest-access.js';

export const createGuestVerification = async (grant, dependencies = {}) => {
  const now = dependencies.now || Date.now;
  const token = (dependencies.createToken || createOpaqueToken)();
  const tokenHash = (dependencies.hashToken || hashToken)(token);
  const store = await (dependencies.getVerificationStore || getVerificationStore)();
  const record = {
    grantId: grant.id,
    email: grant.email,
    tokenHash,
    createdAt: now(),
    expiresAt: now() + GUEST_VERIFICATION_LIFETIME_MS,
    usedAt: null
  };
  await store.setJSON(`verification:${grant.id}:${tokenHash}`, record);
  await store.setJSON(`token:${tokenHash}`, { grantId: grant.id });
  return { token, tokenHash, grant };
};

export const removeGuestVerification = async ({ grant, tokenHash }, dependencies = {}) => {
  const store = await (dependencies.getVerificationStore || getVerificationStore)();
  await store.delete(`verification:${grant.id}:${tokenHash}`);
  await store.delete(`token:${tokenHash}`);
};

export const sendVerificationEmail = async (email, links, dependencies = {}) => {
  const baseUrl = (dependencies.getPublicBaseUrl || getPublicBaseUrl)();
  const choices = links.map(({ token, grant }, index) => {
    const link = `${baseUrl}/catalog-pdf/guest/#verify=${encodeURIComponent(token)}`;
    const expiration = grant.expiresAt === null
      ? 'No expiration'
      : new Date(grant.expiresAt).toLocaleDateString('en-US', { dateStyle: 'long', timeZone: 'UTC' });
    const salesperson = [grant.sharedByName, grant.sharedBy].filter(Boolean).join(' - ') || 'Sales representative unavailable';
    const reference = grant.invitationId || grant.id;
    return { link, expiration, salesperson, label: `Invitation ${index + 1} (reference ${reference})` };
  });
  const safeEmail = escapeHtml(email);
  const textChoices = choices.map(({ label, salesperson, expiration, link }) =>
    `${label}\nInvited by: ${salesperson}\nExpires: ${expiration}\n${link}`
  ).join('\n\n');
  const htmlChoices = choices.map(({ label, salesperson, expiration, link }) => `
    <div style="margin-top:20px;padding:14px;border:1px solid #eeeae3;">
      <strong>${escapeHtml(label)}</strong><br>
      Invited by: ${escapeHtml(salesperson)}<br>
      Expires: ${escapeHtml(expiration)}<br>
      <a href="${link}" style="display:inline-block;margin-top:12px;padding:14px 22px;background:#17284d;color:#fff;text-decoration:none;font-size:12px;font-weight:bold;letter-spacing:1px;">OPEN CATALOG</a>
    </div>
  `).join('');
  return (dependencies.sendEmail || sendGuestEmail)({
    to: email,
    subject: 'Prime Line | Verify your catalog access',
    text: `Choose the invitation you want to open. Each link is valid once and does not extend access.\n\n${textChoices}`,
    html: `
      <div style="margin:0;background:#f7f6f2;padding:40px 18px;font-family:Arial,Helvetica,sans-serif;color:#17284d;">
        <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e7e3dc;">
          <div style="padding:26px 24px;text-align:center;border-bottom:1px solid #eeeae3;">
            <img src="${baseUrl}/images/Logo1500.png" width="180" alt="Prime Line" style="display:block;width:180px;height:auto;margin:0 auto;">
          </div>
          <div style="padding:34px 28px;text-align:center;">
            <div style="color:#c4933b;font-size:11px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;">Catalog Access</div>
            <h1 style="margin:14px 0;color:#17284d;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:400;">Verify your access</h1>
            <p style="color:#737984;font-size:13px;line-height:1.6;">Choose the invitation for ${safeEmail} that you want to open. Each link is valid once and does not extend access.</p>
            ${htmlChoices}
          </div>
          <div style="padding:16px 22px;text-align:center;border-top:1px solid #eeeae3;color:#969ba3;font-size:11px;">Each verification link expires in 15 minutes and can be used once.</div>
        </div>
      </div>
    `
  });
};
