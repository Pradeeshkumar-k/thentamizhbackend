import { prismaWrite } from '../utils/prismaWrite';
import redis from '../utils/redis';

/**
 * Syncs view counts from Redis to Prisma
 * This should be run as a cron job or background worker.
 */
export const syncViewsToDb = async () => {
  console.log('[VIEW SYNC] Starting sync...');
  
  try {
    // 1. Sync Novel Views
    // Note: Upstash REST supports 'keys' but for large datasets 'scan' is better.
    // For simplicity, following the user's provided pattern.
    const novelKeys = await redis.keys('novel:views:*');
    console.log(`[VIEW SYNC] Found ${novelKeys.length} novel view keys`);
    
    for (const key of novelKeys) {
      const novelId = key.split(':')[2];
      const count = Number(await redis.get(key));

      if (count > 0) {
        await prismaWrite.novel.update({
          where: { id: novelId },
          data: { views: { increment: count } },
        });
        await redis.del(key);
        console.log(`[VIEW SYNC] Updated novel ${novelId}: +${count}`);
      }
    }

    // 2. Sync Chapter Views
    const chapterKeys = await redis.keys('chapter:views:*');
    console.log(`[VIEW SYNC] Found ${chapterKeys.length} chapter view keys`);
    
    for (const key of chapterKeys) {
      const chapterId = key.split(':')[2];
      const count = Number(await redis.get(key));

      if (count > 0) {
        await prismaWrite.chapter.update({
          where: { id: chapterId },
          data: { views: { increment: count } },
        });
        await redis.del(key);
        console.log(`[VIEW SYNC] Updated chapter ${chapterId}: +${count}`);
      }
    }

    console.log('[VIEW SYNC] Completed successfully');
  } catch (err) {
    console.error('[VIEW SYNC ERROR]', err);
  }
};

// If run directly
if (require.main === module) {
  syncViewsToDb().then(() => process.exit(0)).catch(() => process.exit(1));
}
