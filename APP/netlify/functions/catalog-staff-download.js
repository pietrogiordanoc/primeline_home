import { adaptNetlifyHandler } from '../shared/adapt-netlify-handler.js';
import {
  CATALOG_PUBLIC_URL,
  getEmployeeCatalogSession,
  jsonResponse
} from '../shared/catalog-guest-access.js';

export const createCatalogStaffDownloadHandler = (dependencies = {}) => async (event) => {
  if (event.httpMethod !== 'GET') return jsonResponse({ error: 'Method not allowed.' }, 405);
  try {
    const session = await (dependencies.getEmployeeSession || getEmployeeCatalogSession)(
      event,
      dependencies.getEmployeeStore,
      (dependencies.now || Date.now)()
    );
    if (!session) return jsonResponse({ error: 'Employee catalog access is required.' }, 401);

    const url = new URL(CATALOG_PUBLIC_URL);
    url.searchParams.set('download', 'Prime-Line-Catalog-Autumn-2026.pdf');
    return {
      statusCode: 302,
      headers: {
        Location: url.toString(),
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer'
      },
      body: ''
    };
  } catch {
    return jsonResponse({ error: 'The staff catalog download is temporarily unavailable.' }, 503);
  }
};

export default adaptNetlifyHandler(createCatalogStaffDownloadHandler());
