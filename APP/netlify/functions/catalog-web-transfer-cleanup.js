import { getTransferClaimStore } from './catalog-web-transfer.js';

export const cleanupTransferClaims = async (store, now = Date.now()) => {
  for await (const page of store.list({ prefix: 'claim:', paginate: true })) {
    for (const blob of page.blobs) {
      const claim = await store.get(blob.key, { type: 'json' });
      if (claim && Number.isSafeInteger(claim.expiresAt) && claim.expiresAt < now - 120000) {
        await store.delete(blob.key);
      }
    }
  }
};

export default async () => {
  try {
    await cleanupTransferClaims(await getTransferClaimStore());
  } catch (error) {
    console.error('Web catalog transfer claim cleanup failed.', error);
    throw error;
  }
};

export const config = { schedule: '@daily' };
