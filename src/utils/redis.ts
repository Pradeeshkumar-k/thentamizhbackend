import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';

dotenv.config();

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Increment view count for a target and return the new value
 */
export const incrementViewCount = async (type: 'novel' | 'chapter', id: string): Promise<number> => {
  try {
    const key = `${type}:views:${id}`;
    const newVal = await redis.incr(key);
    console.log(`[REDIS INCR] ${key} => ${newVal}`);
    return Number(newVal);
  } catch (err) {
    console.error('[REDIS ERROR]', err);
    return 0;
  }
};

/**
 * Get current increment from Redis
 */
export const getRedisViewCount = async (type: 'novel' | 'chapter', id: string): Promise<number> => {
  try {
    const key = `${type}:views:${id}`;
    const val = await redis.get(key);
    console.log(`[REDIS GET] ${key} => ${val}`);
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
    const p = redis.pipeline();
    ids.forEach(id => p.get(`${type}:views:${id}`));
    const vals = await p.exec();
    
    const results: Record<string, number> = {};
    ids.forEach((id, index) => {
      const val = vals[index];
      results[id] = val !== null && val !== undefined ? Number(val) : 0;
    });
    return results;
  } catch (err) {
    console.error('[REDIS PIPELINE ERROR]', err);
    return {};
  }
};

export default redis;
