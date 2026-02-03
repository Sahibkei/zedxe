import { getRedis } from "@/lib/cache/redis";

export async function getOrSetJSON<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>,
): Promise<T> {
  const redis = getRedis();

  if (!redis) {
    return compute();
  }

  try {
    const cached = await redis.get<string>(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch (error) {
    return compute();
  }

  const value = await compute();

  try {
    await redis.set(key, JSON.stringify(value), { ex: ttlSeconds });
  } catch (error) {
    // Ignore cache set failures to keep app resilient.
  }

  return value;
}
