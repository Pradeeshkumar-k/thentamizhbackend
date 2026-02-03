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

      // 1. Get current count and atomicly reset in Redis (GETSET is safe)
      const count = await redis.getset<number>(key, 0);
      if (!count || count <= 0) continue;

      try {
        // 2. Atomic increment in DB
        await prisma.novel.update({
          where: { id: novelId },
          data: { views: { increment: count } },
        });

        console.log(`[ViewSync] Novel ${novelId} synced with +${count} views`);
        // Note: We don't delete the key here because it was already reset/decremented by getset.
        // If there were increments during this block, they are already at 0 + new_incs.
      } catch (dbErr) {
        console.error(`[ViewSync] Novel DB error for ${novelId}:`, dbErr);
        // 3. Rollback in Redis if DB fails (RE-INCREMENT)
        await redis.incrby(key, count);
      }
    }

    // ---------- CHAPTER VIEWS ----------
    const chapterKeys = await redis.keys('chapter:views:*');

    for (const key of chapterKeys) {
      const chapterId = key.split(':')[2];
      if (!chapterId) continue;

      const count = await redis.getset<number>(key, 0);
      if (!count || count <= 0) continue;

      try {
        await prisma.chapter.update({
          where: { id: chapterId },
          data: { views: { increment: count } },
        });

        console.log(`[ViewSync] Chapter ${chapterId} synced with +${count} views`);
      } catch (dbErr) {
        console.error(`[ViewSync] Chapter DB error for ${chapterId}:`, dbErr);
        await redis.incrby(key, count);
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
