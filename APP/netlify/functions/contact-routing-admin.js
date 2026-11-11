import { adaptNetlifyHandler } from '../shared/adapt-netlify-handler.js';
import {
  jsonResponse,
  parseJsonBody,
  requireAdminRequest
} from '../shared/admin-auth.js';
import {
  CAREERS_ROUTING_CONFIG_KEY,
  CONTACT_ROUTING_CONFIG_KEY,
  isProductionContext,
  loadRoutingConfig,
  saveRoutingConfig,
  validateRoutingConfig
} from '../shared/contact-routing.js';

const MAX_CONFIG_BYTES = 1024 * 1024;
const getConfigKey = (event) => {
  const form = event.queryStringParameters?.form || 'contact';
  if (form === 'contact') return CONTACT_ROUTING_CONFIG_KEY;
  if (form === 'careers') return CAREERS_ROUTING_CONFIG_KEY;
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

  const configKey = getConfigKey(event);
  if (!configKey) return jsonResponse({ error: 'Unknown inquiry form.' }, 400);

  if (event.httpMethod === 'GET') {
    try {
      return jsonResponse(await loadRoutingConfig(undefined, configKey));
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
  const validation = validateRoutingConfig(payload);
  if (!validation.ok) return jsonResponse({ error: validation.error }, 400);

  try {
    return jsonResponse(await saveRoutingConfig(validation.config, undefined, context, configKey));
  } catch (error) {
    console.error('Inquiry routing configuration could not be saved.', error);
    return jsonResponse({ error: 'Inquiry routing configuration could not be saved.' }, 503);
  }
};

export default adaptNetlifyHandler(handler);
