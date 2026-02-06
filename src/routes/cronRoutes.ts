import { Router, Request, Response } from 'express';
import redis from '../utils/redis';
import { prisma } from '../utils/prisma';
import { invalidateNovelCache } from '../controllers/novelController';

const router = Router();

/**
 * GET /api/cron/sync-views
 * Trigger manually or via Vercel Cron
 */
router.get('/sync-views', async (req: Request, res: Response) => {
  if (!redis) {
      return res.status(503).json({ message: 'Redis not available' });
  }

  try {
      console.log('[CRON] Starting View Sync...');
      
      // 1. Scan for novel view keys
      // Note: In production with millions of keys, use SCAN. For this scale, KEYS is fine.
      const keys = await redis.keys('views:novel:*');
      
      if (keys.length === 0) {
          return res.json({ message: 'No views to sync', count: 0 });
      }

      let updatedCount = 0;

      // 2. Process each key
      for (const key of keys) {
          const novelId = key.split(':')[2];
          const views = await redis.get(key);
          
          if (views && parseInt(views) > 0) {
              const viewCount = parseInt(views);

              // 3. Update DB
              await prisma.novel.update({
                  where: { id: novelId },
                  data: { views: { increment: viewCount } }
              });

              // 4. Delete Redis Key (Reset buffer)
              await redis.del(key);
              updatedCount++;
          }
      }

      // --- Sync Chapters ---
      const chapterKeys = await redis.keys('views:chapter:*');
      if (chapterKeys.length > 0) {
          for (const key of chapterKeys) {
            const chapterId = key.split(':')[2];
            const views = await redis.get(key);
            
            if (views && parseInt(views) > 0) {
                const viewCount = parseInt(views);
                await prisma.chapter.update({
                    where: { id: chapterId },
                    data: { views: { increment: viewCount } }
                });
                await redis.del(key);
                updatedCount++;
            }
          }
      }
      
      if (updatedCount > 0) {
          await invalidateNovelCache();
      }

      console.log(`[CRON] Synced views for ${updatedCount} novels`);
      res.json({ message: 'Sync complete', updated: updatedCount });

  } catch (error: any) {
      console.error('[CRON ERROR]', error);
      res.status(500).json({ message: 'Sync failed', error: error.message });
  }
});

export default router;
