// REDIS COMPLETELY DISABLED - NO IMPORTS, NO CONNECTIONS

export default null;

export const incrementViewCount = async (type: "chapter" | "novel", id: string) => 0;

export const getRedisViewCount = async (type: "chapter" | "novel", id: string) => 0;

export const getRedisViewCounts = async (type: "chapter" | "novel", ids: string[]) => ({});
