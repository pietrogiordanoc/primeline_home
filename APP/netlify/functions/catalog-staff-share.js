import { adaptNetlifyHandler } from '../shared/adapt-netlify-handler.js';
import { isSameOrigin } from '../shared/admin-auth.js';
import {
  checkGuestRateLimit,
  createGuestInvitationRecord,
  getEmployeeProfile,
  getEmployeeCatalogSession,
  getEmployeeProfileStore,
  getInvitationStore,
  hashEmail,
  isGuestDuration,
  jsonResponse,
  normalizeEmail,
  normalizeStaffFullName,
  parseBody,
  saveEmployeeProfile,
  sendCatalogInvitationEmail
} from '../shared/catalog-guest-access.js';

export const createCatalogStaffShareHandler = (dependencies = {}) => async (event) => {
  const method = event.httpMethod;
  if (method !== 'GET' && method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);
  if (method === 'POST' && !(dependencies.isSameOrigin || isSameOrigin)(event)) {
    return jsonResponse({ error: 'Request could not be completed.' }, 403);
  }

  const now = dependencies.now || Date.now;
  try {
    const employee = await (dependencies.getEmployeeSession || getEmployeeCatalogSession)(
      event,
      dependencies.getEmployeeStore,
      now()
    );
    if (!employee) return jsonResponse({ error: 'Authorized employee catalog access is required.' }, 401);

    if (method === 'GET') {
      const profile = await (dependencies.getEmployeeProfile || getEmployeeProfile)(
        employee.email,
        dependencies.getEmployeeProfileStore || getEmployeeProfileStore
      );
      return jsonResponse(profile);
    }

    const payload = (dependencies.parseBody || parseBody)(event);
    const customerEmail = (dependencies.normalizeEmail || normalizeEmail)(payload?.customerEmail);
    const staffFullName = normalizeStaffFullName(payload?.staffFullName);
    if (
      !payload ||
      Object.hasOwn(payload, 'email') ||
      !staffFullName ||
      !customerEmail ||
      !isGuestDuration(payload.duration)
    ) {
      return jsonResponse({ error: 'Enter your name, a valid customer email, and access duration.' }, 400);
    }
    const profile = await (dependencies.saveEmployeeProfile || saveEmployeeProfile)(
      employee.email,
      staffFullName,
      {
        getProfileStore: dependencies.getEmployeeProfileStore || getEmployeeProfileStore,
        now
      }
    );

    const allowed = await (dependencies.rateLimit || checkGuestRateLimit)(
      hashEmail(profile.email),
      20,
      60 * 60 * 1000,
      now
    );
    if (!allowed) return jsonResponse({ error: 'Invitation limit reached. Try again later.' }, 429);

    const created = (dependencies.createInvitation || createGuestInvitationRecord)({
      customerEmail,
      duration: payload.duration,
      sharedBy: profile.email,
      sharedByName: profile.fullName,
      now: now()
    });
    const store = await (dependencies.getInvitationStore || getInvitationStore)();
    await store.setJSON(`invitation:${created.invitation.id}`, created.invitation);
    await store.setJSON(`token:${created.tokenHash}`, { invitationId: created.invitation.id });
    const sent = await (dependencies.sendInvitation || sendCatalogInvitationEmail)(
      created.invitation,
      created.token,
      dependencies
    );
    if (!sent) {
      await store.delete(`token:${created.tokenHash}`);
      await store.delete(`invitation:${created.invitation.id}`);
      return jsonResponse({ error: 'The invitation email could not be sent.' }, 502);
    }
    return jsonResponse({ invited: true });
  } catch {
    return jsonResponse({ error: 'The catalog invitation could not be sent.' }, 503);
  }
};

export default adaptNetlifyHandler(createCatalogStaffShareHandler());
