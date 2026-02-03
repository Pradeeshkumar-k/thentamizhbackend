import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!, {
  tls: {},
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export default redis;

export const incrementViewCount = async (
  type: "chapter" | "novel",
  id: string
) => {
  const key = `${type}:views:${id}`
  const value = await redis.incr(key)
  console.log("[REDIS INCR]", key, value)
  return value
}

export const getRedisViewCount = async (
  type: "chapter" | "novel",
  id: string
) => {
  const key = `${type}:views:${id}`
  const value = await redis.get(key)
  console.log("[REDIS GET]", key, value)
  return Number(value) || 0
}

export const getRedisViewCounts = async (
  type: "chapter" | "novel",
  ids: string[]
) => {
  if (!ids.length) return {}
  const keys = ids.map(id => `${type}:views:${id}`)
  const values = await redis.mget(...keys)

  const result: Record<string, number> = {}
  ids.forEach((id, i) => {
    result[id] = Number(values[i]) || 0
  })
  return result
}
