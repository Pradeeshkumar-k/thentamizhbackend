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

export default redis;
