import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || process.env.KV_URL;

let redis: Redis | null = null;

if (redisUrl) {
  // @ts-ignore
  redis = new Redis(redisUrl, {
    family: 6, // Support IPv6 (often needed for Vercel KV/Upstash)
  });

  redis.on('connect', () => console.log('✅ Redis Connected'));
  redis.on('error', (err) => console.error('❌ Redis Connection Error:', err));
} else {
  console.warn('⚠️ REDIS_URL/KV_URL not found, Redis disabled');
}

export default redis;

export const incrementViewCount = async (type: "chapter" | "novel", id: string) => {
    if (!redis) return 0;
    const key = `views:${type}:${id}`;
    return await redis.incr(key);
};

export const getRedisViewCount = async (type: "chapter" | "novel", id: string) => {
    if (!redis) return 0;
    const key = `views:${type}:${id}`;
    const count = await redis.get(key);
    return count ? parseInt(count, 10) : 0;
};

export const getRedisViewCounts = async (type: "chapter" | "novel", ids: string[]) => {
    if (!redis || ids.length === 0) return {};
    
    // Pipeline for efficiency
    const pipeline = redis.pipeline();
    ids.forEach(id => pipeline.get(`views:${type}:${id}`));
    
    const results = await pipeline.exec();
    const counts: Record<string, number> = {};

    ids.forEach((id, index) => {
        const result = results?.[index];
        // result is [error, result]
        if (result && !result[0] && result[1]) {
            counts[id] = parseInt(result[1] as string, 10);
        } else {
            counts[id] = 0;
        }
    });

    return counts;
};
