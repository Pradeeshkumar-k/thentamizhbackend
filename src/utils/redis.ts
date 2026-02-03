import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';

dotenv.config();

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Increment view count for a target
 */
export const incrementViewCount = async (type: 'novel' | 'chapter', id: string) => {
  try {
    await redis.incr(`${type}:views:${id}`);
    return true;
  } catch (err) {
    console.error('[REDIS ERROR]', err);
    return false;
  }
};

/**
 * Get current increment from Redis
 */
export const getRedisViewCount = async (type: 'novel' | 'chapter', id: string): Promise<number> => {
  try {
    const val = await redis.get(`${type}:views:${id}`);
    return val ? Number(val) : 0;
  } catch (err) {
    console.error('[REDIS GET ERROR]', err);
    return 0;
  }
};

/**
 * Batch get current increments from Redis
 */
export const getRedisViewCounts = async (type: 'novel' | 'chapter', ids: string[]): Promise<Record<string, number>> => {
  if (!ids.length) return {};
  try {
    const keys = ids.map(id => `${type}:views:${id}`);
    const vals = await redis.mget(...keys);
    const results: Record<string, number> = {};
    ids.forEach((id, index) => {
      results[id] = vals[index] ? Number(vals[index]) : 0;
    });
    return results;
  } catch (err) {
    console.error('[REDIS MGET ERROR]', err);
    return {};
  }
};

export default redis;
