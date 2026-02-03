import { Router, Request, Response } from 'express';
import { syncViewsToDb } from '../services/viewSyncService';

const router = Router();

/**
 * GET /api/cron/sync-views
 * Trigger manually or via Vercel Cron
 */
router.get('/sync-views', async (req: Request, res: Response) => {
  // Optional: Check for CRON_SECRET or Vercel specific headers for security
  // if (req.headers['x-vercel-cron'] !== '1') { ... }

  try {
    console.log('[CRON] Triggered view sync');
    await syncViewsToDb();
    res.status(200).json({ success: true, message: 'Sync completed' });
  } catch (err) {
    console.error('[CRON ERROR]', err);
    res.status(500).json({ success: false, message: 'Sync failed' });
  }
});

export default router;
