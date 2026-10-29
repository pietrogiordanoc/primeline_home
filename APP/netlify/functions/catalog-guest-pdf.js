import { adaptNetlifyHandler } from '../shared/adapt-netlify-handler.js';
import {
  CATALOG_PUBLIC_URL,
  jsonResponse,
  validateGuestSession
} from '../shared/catalog-guest-access.js';

export const createCatalogGuestPdfHandler = (dependencies = {}) => async (event) => {
  if (event.httpMethod !== 'GET') return jsonResponse({ error: 'Method not allowed.' }, 405);
  try {
    const authenticated = await (dependencies.validateSession || validateGuestSession)(event, dependencies);
    if (!authenticated) return jsonResponse({ error: 'Active catalog access is required.' }, 401);
    return jsonResponse({ url: CATALOG_PUBLIC_URL });
  } catch {
    return jsonResponse({ error: 'Catalog access could not be verified.' }, 503);
  }
};

export default adaptNetlifyHandler(createCatalogGuestPdfHandler());
