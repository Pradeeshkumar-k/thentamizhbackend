import { Router, Request, Response } from 'express';

const router = Router();

/**
 * GET /api/cron/sync-views
 * Trigger manually or via Vercel Cron
 */
// View sync route removed (DB-only mode)
router.get('/sync-views', (req: Request, res: Response) => {
  res.status(200).json({ message: 'Sync disabled' });
});

export default router;
