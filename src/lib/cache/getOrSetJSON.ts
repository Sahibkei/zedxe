import { getRedis } from "@/lib/cache/redis";

/**
 * Fetches a cached JSON value or computes and stores it with a TTL.
 *
 * Returns compute() immediately when caching is disabled, ttlSeconds <= 0,
 * or Redis errors occur. Never throws for cache failures.
 */
export async function getOrSetJSON<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>,
): Promise<T> {
  if (ttlSeconds <= 0) {
    return compute();
  }

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
