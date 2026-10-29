import '../../assets/js/contact-form-data.js';

const DEFAULT_EMAIL = 'info@primelinedist.com';
export const CONTACT_ROUTING_STORE_NAME = 'prime-line-contact-routing';
export const CONTACT_ROUTING_CONFIG_KEY = 'contact-routing-config';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATA = globalThis.PRIME_LINE_CONTACT_DATA;
const STATES_BY_CODE = new Map(DATA.usStates.map((state) => [state.code, state]));
const COUNTRY_CODES = new Set(DATA.countryCodes);

export const DEFAULT_ROUTING_CONFIG = Object.freeze({
  generalRecipients: Object.freeze([
    Object.freeze({ id: 'default-info', email: DEFAULT_EMAIL, enabled: true })
  ]),
  stateRules: Object.freeze([])
});

export const isValidEmail = (value) =>
  typeof value === 'string' &&
  value.length <= 254 &&
  EMAIL_PATTERN.test(value) &&
  !/[\r\n]/.test(value);

export const normalizeCountryCode = (value) => {
  if (typeof value !== 'string') return '';
  const code = value.trim().toUpperCase();
  return COUNTRY_CODES.has(code) ? code : '';
};

const normalizeText = (value) =>
  typeof value === 'string'
    ? value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US')
    : '';

export const normalizeUsState = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) return '';
  const byCode = STATES_BY_CODE.get(normalized.toUpperCase());
  if (byCode) return byCode.code;
  return DATA.usStates.find((state) => normalizeText(state.name) === normalized)?.code || '';
};

export const normalizeRoutingState = (countryCode, value) =>
  countryCode === 'US' ? normalizeUsState(value) : normalizeText(value);

const validId = (value) => typeof value === 'string' && /^[a-zA-Z0-9-]{1,64}$/.test(value);

export const validateRoutingConfig = (input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Invalid contact routing configuration.' };
  }
  if (!Array.isArray(input.generalRecipients) || input.generalRecipients.length > 30) {
    return { ok: false, error: 'Add no more than 30 general recipients.' };
  }
  if (!Array.isArray(input.stateRules) || input.stateRules.length > 100) {
    return { ok: false, error: 'Add no more than 100 routing rules.' };
  }

  const generalIds = new Set();
  const generalEmails = new Set();
  const generalRecipients = [];
  for (const recipient of input.generalRecipients) {
    if (
      !recipient ||
      typeof recipient !== 'object' ||
      !validId(recipient.id) ||
      typeof recipient.enabled !== 'boolean' ||
      typeof recipient.email !== 'string' ||
      !isValidEmail(recipient.email.trim())
    ) {
      return { ok: false, error: 'Each general recipient needs a valid email address and status.' };
    }

    const email = recipient.email.trim();
    const normalizedEmail = email.toLowerCase();
    if (generalIds.has(recipient.id) || generalEmails.has(normalizedEmail)) {
      return { ok: false, error: 'General recipient IDs and email addresses must be unique.' };
    }
    generalIds.add(recipient.id);
    generalEmails.add(normalizedEmail);
    generalRecipients.push({ id: recipient.id, email, enabled: recipient.enabled });
  }
  if (!generalRecipients.some((recipient) => recipient.enabled)) {
    return { ok: false, error: 'At least one valid general recipient must remain enabled.' };
  }

  const ruleIds = new Set();
  const stateRules = [];
  for (const rule of input.stateRules) {
    if (
      !rule ||
      typeof rule !== 'object' ||
      !validId(rule.id) ||
      typeof rule.enabled !== 'boolean' ||
      (!Array.isArray(rule.states) && typeof rule.state !== 'string') ||
      !Array.isArray(rule.recipients) ||
      !rule.recipients.length ||
      rule.recipients.length > 20
    ) {
      return { ok: false, error: 'Each routing rule needs a country, state, status, and valid recipient.' };
    }

    const countryCode = normalizeCountryCode(rule.countryCode);
    const rawStates = Array.isArray(rule.states) ? rule.states : [rule.state];
    if (!countryCode || !rawStates.length || rawStates.length > 51) {
      return { ok: false, error: 'Each routing rule needs a recognized country and state or province.' };
    }
    if (ruleIds.has(rule.id)) return { ok: false, error: 'Routing rule IDs must be unique.' };
    if (countryCode !== 'US' && rawStates.length !== 1) {
      return { ok: false, error: 'International routing rules must contain one state or province.' };
    }

    const states = [];
    for (const value of rawStates) {
      const state = normalizeRoutingState(countryCode, value);
      if (!state || state.length > 100) {
        return { ok: false, error: 'Each routing rule needs a recognized country and state or province.' };
      }
      if (!states.includes(state)) states.push(state);
    }

    const recipients = [];
    const recipientSet = new Set();
    for (const value of rule.recipients) {
      if (!isValidEmail(value)) return { ok: false, error: 'Routing rule recipients must be valid email addresses.' };
      const email = value.trim();
      const normalizedEmail = email.toLowerCase();
      if (!recipientSet.has(normalizedEmail)) {
        recipients.push(email);
        recipientSet.add(normalizedEmail);
      }
    }
    if (!recipients.length) return { ok: false, error: 'Each routing rule needs at least one recipient.' };
    ruleIds.add(rule.id);
    stateRules.push({ id: rule.id, countryCode, states, recipients, enabled: rule.enabled });
  }

  return {
    ok: true,
    config: { generalRecipients, stateRules }
  };
};

export const resolveRecipients = (contact, config) => {
  const general = config.generalRecipients
    .filter((recipient) => recipient.enabled)
    .map((recipient) => recipient.email);
  const normalizedState = normalizeRoutingState(contact.country, contact.state);
  const matchedRules = config.stateRules.filter((rule) =>
    rule.enabled &&
    rule.countryCode === contact.country &&
    (Array.isArray(rule.states) ? rule.states : [rule.state])
      .some((state) => normalizeRoutingState(rule.countryCode, state) === normalizedState)
  );
  const selected = matchedRules.length
    ? [...general, ...matchedRules.flatMap((rule) => rule.recipients)]
    : general;
  const seen = new Set();
  const unique = selected.filter((email) => {
    const key = email.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique.length ? unique : [DEFAULT_EMAIL];
};

export const getContactRoutingStore = async () => {
  const { getStore } = await import('@netlify/blobs');
  return getStore({
    name: CONTACT_ROUTING_STORE_NAME,
    consistency: 'strong'
  });
};

export const isProductionContext = (context) => context?.deploy?.context === 'production';

const normalizeStoredConfig = (document) => {
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    throw new Error('Saved contact routing configuration is invalid.');
  }
  const result = validateRoutingConfig({
    ...document,
    stateRules: Array.isArray(document.stateRules)
      ? document.stateRules.map((rule) => ({
        ...rule,
        states: Array.isArray(rule?.states) ? rule.states : [rule?.state]
      }))
      : document.stateRules
  });
  if (!result.ok || typeof document.updatedAt !== 'string' || Number.isNaN(Date.parse(document.updatedAt))) {
    throw new Error('Saved contact routing configuration is invalid.');
  }
  return { ...result.config, updatedAt: document.updatedAt };
};

export const loadRoutingConfig = async (store) => {
  const blobStore = store || await getContactRoutingStore();
  const document = await blobStore.get(CONTACT_ROUTING_CONFIG_KEY, { type: 'json' });
  if (!document) return { ...DEFAULT_ROUTING_CONFIG, updatedAt: null };
  return normalizeStoredConfig(document);
};

export const saveRoutingConfig = async (config, store, context) => {
  if (!isProductionContext(context)) {
    throw new Error('Contact routing configuration can only be changed in production.');
  }
  const validation = validateRoutingConfig(config);
  if (!validation.ok) throw new Error(validation.error);

  const document = {
    ...validation.config,
    updatedAt: new Date().toISOString()
  };
  const blobStore = store || await getContactRoutingStore();
  await blobStore.setJSON(CONTACT_ROUTING_CONFIG_KEY, document);
  return document;
};
