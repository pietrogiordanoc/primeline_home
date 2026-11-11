import { adaptNetlifyHandler } from '../shared/adapt-netlify-handler.js';
import {
  jsonResponse,
  parseJsonBody,
  requireAdminRequest
} from '../shared/admin-auth.js';
import {
  CONTACT_ROUTING_CONFIG_KEY,
  isProductionContext,
  loadCareersRoutingConfig,
  loadRoutingConfig,
  saveCareersRoutingConfig,
  saveRoutingConfig,
  validateCareersRoutingConfig,
  validateRoutingConfig
} from '../shared/contact-routing.js';

const MAX_CONFIG_BYTES = 1024 * 1024;
const getConfigKey = (event) => {
  const form = event.queryStringParameters?.form || 'contact';
  if (form === 'contact') return { form, key: CONTACT_ROUTING_CONFIG_KEY };
  if (form === 'careers') return { form };
  return null;
};

const handler = async (event, context) => {
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'PUT') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  let authorization;
  try {
    authorization = await requireAdminRequest(event, { stateChanging: event.httpMethod === 'PUT' });
  } catch (error) {
    console.error('Contact routing authorization could not be checked.', error);
    return jsonResponse({ error: 'Authorization is temporarily unavailable.' }, 503);
  }
  if (!authorization.ok) {
    return jsonResponse(
      { error: authorization.reason === 'csrf' ? 'Request could not be completed.' : 'Unauthorized.' },
      authorization.reason === 'csrf' ? 403 : 401
    );
  }

  const config = getConfigKey(event);
  if (!config) return jsonResponse({ error: 'Unknown inquiry form.' }, 400);

  if (event.httpMethod === 'GET') {
    try {
      return jsonResponse(config.form === 'careers'
        ? await loadCareersRoutingConfig()
        : await loadRoutingConfig(undefined, config.key));
    } catch (error) {
      console.error('Inquiry routing configuration could not be loaded.', error);
      return jsonResponse({ error: 'Inquiry routing configuration is unavailable.' }, 503);
    }
  }

  if (!isProductionContext(context)) {
    return jsonResponse({ error: 'Contact routing changes are only available in production.' }, 403);
  }

  const { payload, error } = parseJsonBody(event, MAX_CONFIG_BYTES);
  if (error) {
    return jsonResponse(
      { error: error === 'too-large' ? 'Configuration request is too large.' : 'Invalid configuration request.' },
      error === 'too-large' ? 413 : 400
    );
  }
  const validation = config.form === 'careers'
    ? validateCareersRoutingConfig(payload)
    : validateRoutingConfig(payload);
  if (!validation.ok) return jsonResponse({ error: validation.error }, 400);

  try {
    return jsonResponse(config.form === 'careers'
      ? await saveCareersRoutingConfig(validation.config, undefined, context)
      : await saveRoutingConfig(validation.config, undefined, context, config.key));
  } catch (error) {
    console.error('Inquiry routing configuration could not be saved.', error);
    return jsonResponse({ error: 'Inquiry routing configuration could not be saved.' }, 503);
  }
};

export default adaptNetlifyHandler(handler);
