// utils/redis.ts
// 🔴 REDIS COMPLETELY DISABLED (STABILITY MODE)

console.log("[REDIS] fully disabled");

const redis: any = null;
export default redis;

// ---- Safe no-op helpers ----
export const incrementViewCount = async (
  type: "chapter" | "novel",
  id: string
) => 0;

export const getRedisViewCount = async (
  type: "chapter" | "novel",
  id: string
) => 0;

export const getRedisViewCounts = async (
  type: "chapter" | "novel",
  ids: string[]
) => ({});
