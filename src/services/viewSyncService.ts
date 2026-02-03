/**
 * View Sync Service
 * 
 * DEPRECATED: We are now using Redis as the source of truth for views.
 * This worker logic is removed to prevent accidental execution on Vercel.
 */

export const syncViewsToDb = async () => {
  // No-op
  // console.log('[ViewSync] Sync disabled (Redis-only mode)');
};
