import Redis from "ioredis";

let redis: Redis | null = null;

if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    tls: {}, // required for Upstash
  });

  redis.on("connect", () => {
    console.log("[REDIS] connected");
  });

  redis.on("error", (err) => {
    console.error("[REDIS ERROR] (non-fatal)", err.message);
  });
}

// ---------- SAFE HELPERS ----------

export const incrementViewCount = async (
  type: "chapter" | "novel",
  id: string
) => {
  if (!redis) return 0;
  try {
    return await redis.incr(`${type}:views:${id}`);
  } catch {
    return 0;
  }
};

export const getRedisViewCount = async (
  type: "chapter" | "novel",
  id: string
) => {
  if (!redis) return 0;
  try {
    const v = await redis.get(`${type}:views:${id}`);
    return Number(v) || 0;
  } catch {
    return 0;
  }
};

export const getRedisViewCounts = async (
  type: "chapter" | "novel",
  ids: string[]
) => {
  if (!redis || ids.length === 0) return {};
  try {
    const keys = ids.map(id => `${type}:views:${id}`);
    const values = await redis.mget(...keys);
    const result: Record<string, number> = {};
    ids.forEach((id, i) => {
      result[id] = Number(values[i]) || 0;
    });
    return result;
  } catch {
    return {};
  }
};

export default redis;
