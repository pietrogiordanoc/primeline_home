import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { hashValue } from './admin-auth.js';

export const GUEST_INVITATION_STORE = 'prime-line-guest-invitations';
export const GUEST_GRANT_STORE = 'prime-line-guest-grants';
export const GUEST_SESSION_STORE = 'prime-line-guest-sessions';
export const GUEST_VERIFICATION_STORE = 'prime-line-guest-verifications';
export const GUEST_CLAIM_STORE = 'prime-line-guest-claims';
export const GUEST_SESSION_COOKIE = '__Host-pl-guest-catalog-session';
export const GUEST_INVITATION_LIFETIME_MS = 48 * 60 * 60 * 1000;
export const GUEST_VERIFICATION_LIFETIME_MS = 15 * 60 * 1000;
export const GUEST_SESSION_LIFETIME_SECONDS = 7 * 24 * 60 * 60;
export const CATALOG_PUBLIC_URL = 'https://fcdrjlzqrbvnbsehkqgm.supabase.co/storage/v1/object/public/PDF%20Catalog/Autumn%202026.pdf';
export const GUEST_DURATIONS = Object.freeze({
  '24-hours': '24 Hours',
  '7-days': '7 Days',
  '1-month': '1 Month',
  '3-months': '3 Months',
  permanent: 'Permanent'
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STAFF_EMAIL_PATTERN = /^[^\s@]+@primelinedist\.com$/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const jsonResponse = (body, statusCode = 200, cookies = []) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer'
  },
  ...(cookies.length ? { multiValueHeaders: { 'Set-Cookie': cookies } } : {}),
  body: JSON.stringify(body)
});

export const parseBody = (event, maxBytes = 8192) => {
  const body = typeof event.body === 'string' ? event.body : '';
  const bytes = event.isBase64Encoded ? Buffer.from(body, 'base64') : Buffer.from(body, 'utf8');
  if (bytes.byteLength > maxBytes) return null;
  try {
    const parsed = JSON.parse(bytes.toString('utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const normalizeEmail = (value) => {
  if (typeof value !== 'string') return '';
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : '';
};

export const isGuestDuration = (value) => Object.hasOwn(GUEST_DURATIONS, value);

export const getGrantExpiresAt = (duration, startTime) => {
  if (duration === 'permanent') return null;
  if (duration === '24-hours') return startTime + 24 * 60 * 60 * 1000;
  if (duration === '7-days') return startTime + 7 * 24 * 60 * 60 * 1000;
  if (duration !== '1-month' && duration !== '3-months') return undefined;

  const months = duration === '1-month' ? 1 : 3;
  const date = new Date(startTime);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.getTime();
};

export const createOpaqueToken = () => randomBytes(32).toString('base64url');
export const hashToken = (token) => createHash('sha256').update(token).digest('hex');
export const createId = () => randomUUID();

export const getStore = async (name) => {
  const { getStore: getNetlifyStore } = await import('@netlify/blobs');
  return getNetlifyStore({ name, consistency: 'strong' });
};

export const getInvitationStore = () => getStore(GUEST_INVITATION_STORE);
export const getGrantStore = () => getStore(GUEST_GRANT_STORE);
export const getGuestSessionStore = () => getStore(GUEST_SESSION_STORE);
export const getVerificationStore = () => getStore(GUEST_VERIFICATION_STORE);
export const getGuestClaimStore = () => getStore(GUEST_CLAIM_STORE);

export const readCookie = (event, name) => {
  const header = event.headers?.cookie || event.headers?.Cookie || '';
  const value = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return value ? value.slice(name.length + 1) : '';
};

export const guestSessionCookie = (sessionId, maxAge) =>
  `${GUEST_SESSION_COOKIE}=${sessionId}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Strict`;

export const clearGuestSessionCookie = () =>
  `${GUEST_SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`;

export const claimGuestToken = async (claimKey, getClaimStore = getGuestClaimStore) => {
  if (!/^[0-9a-f]{64}$/.test(claimKey)) return false;
  const store = await getClaimStore();
  const key = `claim:${claimKey}`;
  if (await store.get(key)) return false;
  await store.setJSON(key, { claimedAt: Date.now() });
  return true;
};

export const hashEmail = (email) => hashValue(email);

export const normalizeStaffFullName = (value) => {
  if (typeof value !== 'string') return '';
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name || name.length > 120 || /[\u0000-\u001f\u007f-\u009f]/.test(name)) return '';
  return name;
};

export const getEmployeeProfileStore = () => getStore('prime-line-access');

export const getEmployeeProfile = async (email, storeFactory = getEmployeeProfileStore) => {
  const verifiedEmail = typeof email === 'string' && STAFF_EMAIL_PATTERN.test(email)
    ? email.trim().toLowerCase()
    : '';
  if (!verifiedEmail) return { email: '', fullName: '' };
  const store = await storeFactory();
  const profile = await store.get(`staff-profile:${hashEmail(verifiedEmail)}`, { type: 'json' });
  return {
    email: verifiedEmail,
    fullName: profile?.email === verifiedEmail ? normalizeStaffFullName(profile.fullName) : ''
  };
};

export const saveEmployeeProfile = async (
  email,
  fullName,
  { getProfileStore = getEmployeeProfileStore, now = Date.now } = {}
) => {
  const verifiedEmail = typeof email === 'string' && STAFF_EMAIL_PATTERN.test(email)
    ? email.trim().toLowerCase()
    : '';
  const normalizedName = normalizeStaffFullName(fullName);
  if (!verifiedEmail || !normalizedName) throw new Error('A verified staff email and full name are required.');

  const store = await getProfileStore();
  await store.setJSON(`staff-profile:${hashEmail(verifiedEmail)}`, {
    email: verifiedEmail,
    fullName: normalizedName,
    updatedAt: now()
  });
  return { email: verifiedEmail, fullName: normalizedName };
};

export const getActiveGrant = (grant, now = Date.now()) => Boolean(
  grant &&
  grant.status !== 'revoked' &&
  !grant.revokedAt &&
  (grant.expiresAt === null || (Number.isFinite(grant.expiresAt) && grant.expiresAt > now))
);

export const validateGuestSession = async (event, options = {}) => {
  const sessionId = readCookie(event, GUEST_SESSION_COOKIE);
  if (!UUID_PATTERN.test(sessionId)) return null;

  const now = options.now || Date.now;
  const sessionStore = await (options.getSessionStore || options.getGuestSessionStore || getGuestSessionStore)();
  const session = await sessionStore.get(`session:${sessionId}`, { type: 'json' });
  if (
    !session ||
    session.resource !== 'catalog-guest' ||
    !Number.isFinite(session.expiresAt) ||
    session.expiresAt <= now()
  ) {
    if (session) await sessionStore.delete(`session:${sessionId}`);
    return null;
  }

  const grantStore = await (options.getGrantStorage || options.getGrantStore || getGrantStore)();
  const grant = await grantStore.get(`grant:${session.grantId}`, { type: 'json' });
  if (!getActiveGrant(grant, now()) || grant.email !== session.email || grant.id !== session.grantId) return null;
  return { session, grant, sessionId, sessionStore };
};

export const createGuestSession = async (
  grant,
  { getSessionStore = getGuestSessionStore, now = Date.now } = {}
) => {
  const createdAt = now();
  const grantRemaining = grant.expiresAt === null
    ? GUEST_SESSION_LIFETIME_SECONDS
    : Math.floor((grant.expiresAt - createdAt) / 1000);
  const maxAge = Math.min(GUEST_SESSION_LIFETIME_SECONDS, grantRemaining);
  if (maxAge <= 0) throw new Error('Guest access has expired.');

  const sessionId = createId();
  const session = {
    id: sessionId,
    email: grant.email,
    grantId: grant.id,
    resource: 'catalog-guest',
    createdAt,
    expiresAt: createdAt + maxAge * 1000
  };
  const store = await getSessionStore();
  await store.setJSON(`session:${sessionId}`, session);
  return { session, cookie: guestSessionCookie(sessionId, maxAge) };
};

export const listStoreRecords = async (store, prefix) => {
  const result = store.list({ prefix, paginate: true });
  const blobs = [];
  if (result && typeof result[Symbol.asyncIterator] === 'function') {
    for await (const page of result) blobs.push(...page.blobs);
  } else {
    const page = await result;
    blobs.push(...(page?.blobs || []));
  }
  const records = [];
  for (const blob of blobs) {
    const value = await store.get(blob.key, { type: 'json' });
    if (value) records.push(value);
  }
  return records;
};

export const checkGuestRateLimit = async (key, maxRequests, windowMs, now = Date.now) => {
  const store = await getVerificationStore();
  const prefix = `rate:${key}:`;
  const cutoff = now() - windowMs;
  const current = await store.list({ prefix });
  const blobs = current?.blobs || [];
  const active = [];
  for (const blob of blobs) {
    const timestamp = Number(blob.key.slice(prefix.length).split(':')[0]);
    if (Number.isFinite(timestamp) && timestamp > cutoff) active.push(blob);
    else await store.delete(blob.key);
  }
  if (active.length >= maxRequests) return false;
  await store.set(`${prefix}${now()}:${createId()}`, String(now()));
  return true;
};

export const sendGuestEmail = async ({ to, subject, text, html }) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.FROM_EMAIL || 'info@primelinedist.com',
        to: [to],
        subject,
        text,
        html
      })
    });
    return response.ok;
  } catch {
    return false;
  }
};

export const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

export const getPublicBaseUrl = () => {
  const parsed = new URL(process.env.URL || 'https://primelinedist.com');
  if (parsed.protocol !== 'https:') throw new Error('The public site URL is invalid.');
  return parsed.origin;
};

export const createGuestInvitationRecord = ({
  customerEmail,
  duration,
  sharedBy,
  sharedByName = '',
  now = Date.now(),
  id = createId()
}) => {
  const token = createOpaqueToken();
  const tokenHash = hashToken(token);
  return {
    token,
    tokenHash,
    invitation: {
      id,
      customerEmail,
      sharedBy,
      sharedByName: normalizeStaffFullName(sharedByName) || null,
      duration,
      status: 'pending',
      createdAt: now,
      expiresAt: now + GUEST_INVITATION_LIFETIME_MS,
      usedAt: null,
      grantId: createId(),
      tokenHash
    }
  };
};

export const sendCatalogInvitationEmail = async (invitation, token, dependencies = {}) => {
  const baseUrl = (dependencies.getPublicBaseUrl || getPublicBaseUrl)();
  const link = `${baseUrl}/catalog-pdf/guest/#invite=${encodeURIComponent(token)}`;
  const safeEmail = escapeHtml(invitation.customerEmail);
  const safeDuration = escapeHtml(GUEST_DURATIONS[invitation.duration]);
  const inviterEmail = typeof invitation.sharedBy === 'string' && STAFF_EMAIL_PATTERN.test(invitation.sharedBy)
    ? invitation.sharedBy.trim().toLowerCase()
    : '';
  const inviterName = normalizeStaffFullName(invitation.sharedByName);
  const safeInviterEmail = escapeHtml(inviterEmail);
  const safeInviterName = escapeHtml(inviterName);
  const inviterText = inviterEmail
    ? `\n\nINVITED BY\n${inviterName ? `${inviterName}\nPrime Line Distributors\n` : ''}${inviterEmail}`
    : '';
  const inviterHtml = inviterEmail
    ? `<div style="max-width:340px;margin:22px auto 0;padding:14px 18px;border:1px solid #eeeae3;background:#faf9f6;text-align:left;">
        <div style="margin-bottom:7px;color:#c4933b;font-size:10px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">Invited by</div>
        ${inviterName ? `<div style="color:#17284d;font-size:13px;font-weight:bold;line-height:1.5;">${safeInviterName}</div><div style="color:#737984;font-size:12px;line-height:1.5;">Prime Line Distributors</div>` : ''}
        <a href="mailto:${safeInviterEmail}" style="color:#17284d;font-size:12px;line-height:1.5;text-decoration:underline;">${safeInviterEmail}</a>
      </div>`
    : '';
  return (dependencies.sendEmail || sendGuestEmail)({
    to: invitation.customerEmail,
    subject: 'Prime Line | Your Catalog Invitation',
    text: `You have been invited to explore the Prime Line Specialty Foods Catalog.${inviterText}\n\nClick below to access the catalog: ${link}\n\nAccess duration: ${GUEST_DURATIONS[invitation.duration]}. Your access begins when you open the invitation.`,
    html: `
      <div style="margin:0;background:#f7f6f2;padding:40px 18px;font-family:Arial,Helvetica,sans-serif;color:#17284d;">
        <div style="max-width:540px;margin:0 auto;background:#fff;border:1px solid #e7e3dc;">
          <div style="padding:26px 24px;text-align:center;border-bottom:1px solid #eeeae3;">
            <img src="${baseUrl}/images/Logo1500.png" width="180" alt="Prime Line" style="display:block;width:180px;height:auto;margin:0 auto;">
          </div>
          <div style="padding:36px 30px;text-align:center;">
            <div style="color:#c4933b;font-size:11px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;">Catalog Access</div>
            <h1 style="margin:14px 0;color:#17284d;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:400;">Your catalog invitation</h1>
            <p style="color:#737984;font-size:14px;line-height:1.6;">You have been invited to explore the Prime Line Specialty Foods Catalog.</p>
            <p style="color:#737984;font-size:12px;line-height:1.6;">Invited for ${safeEmail}<br>Access duration: <strong>${safeDuration}</strong><br>Your access period begins when you open the invitation.</p>
            ${inviterHtml}
            <a href="${link}" style="display:inline-block;margin-top:12px;padding:14px 22px;background:#17284d;color:#fff;text-decoration:none;font-size:12px;font-weight:bold;letter-spacing:1px;">VIEW CATALOG</a>
          </div>
          <div style="padding:16px 22px;text-align:center;border-top:1px solid #eeeae3;color:#969ba3;font-size:11px;line-height:1.5;">This invitation link expires in 48 hours and can be used once. If you did not expect this invitation, you can ignore this email.</div>
        </div>
      </div>
    `
  });
};

export const getEmployeeCatalogSession = async (event, storeFactory, now = Date.now()) => {
  const sessionId = readCookie(event, 'access_session');
  if (!UUID_PATTERN.test(sessionId)) return null;
  const store = await (storeFactory || (() => getStore('prime-line-access')))();
  const session = await store.get(`session:${sessionId}`, { type: 'json' });
  if (
    !session ||
    session.resource !== 'catalog-pdf' ||
    !Number.isFinite(session.expiresAt) ||
    session.expiresAt <= now ||
    typeof session.email !== 'string' ||
    !STAFF_EMAIL_PATTERN.test(session.email)
  ) return null;
  return { ...session, sessionId };
};
