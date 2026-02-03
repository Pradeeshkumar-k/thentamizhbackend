import redis from '../utils/redis';
import prisma from '../utils/prisma';

/**
 * Synchronizes view counts from Redis to the database.
 * Uses a distributed lock to prevent multiple instances from running simultaneously.
 * Implements atomic processing and error safety.
 */
export const syncViewsToDb = async () => {
  console.log('[ViewSync] Starting sync');

  // 1. Prevent parallel syncs using a distributed lock
  const lockKey = 'view-sync-lock';
  // Use 'nx: true' (set if not exists) and 'ex: 240' (expire in 4 minutes)
  const lock = await redis.set(lockKey, '1', { nx: true, ex: 240 });

  if (!lock) {
    console.log('[ViewSync] Another sync is running. Skipping.');
    return;
  }

  try {
    // ---------- NOVEL VIEWS ----------
    const novelKeys = await redis.keys('novel:views:*');

    for (const key of novelKeys) {
      const novelId = key.split(':')[2];
      if (!novelId) continue;

      // Get current count
      const count = await redis.get<number>(key);
      if (!count || count <= 0) continue;

      try {
        // Atomic increment in DB
        await prisma.novel.update({
          where: { id: novelId },
          data: { views: { increment: count } },
        });

        // Atomic delete in Redis after successful DB update
        await redis.del(key);
        console.log(`[ViewSync] Novel ${novelId} synced with +${count} views`);
      } catch (dbErr) {
        console.error(`[ViewSync] Novel DB error for ${novelId}:`, dbErr);
        // Do NOT delete key; it will be retried in the next sync run
      }
    }

    // ---------- CHAPTER VIEWS ----------
    const chapterKeys = await redis.keys('chapter:views:*');

    for (const key of chapterKeys) {
      const chapterId = key.split(':')[2];
      if (!chapterId) continue;

      const count = await redis.get<number>(key);
      if (!count || count <= 0) continue;

      try {
        await prisma.chapter.update({
          where: { id: chapterId },
          data: { views: { increment: count } },
        });

        await redis.del(key);
        console.log(`[ViewSync] Chapter ${chapterId} synced with +${count} views`);
      } catch (dbErr) {
        console.error(`[ViewSync] Chapter DB error for ${chapterId}:`, dbErr);
        // Do NOT delete key; it will be retried in the next sync run
      }
    }

    console.log('[ViewSync] Sync completed');
  } catch (err) {
    console.error('[ViewSync] Fatal error during synchronization:', err);
  } finally {
    // Release the lock
    await redis.del(lockKey);
  }
};
