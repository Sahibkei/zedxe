import "server-only";

import { Redis } from "@upstash/redis";

import { envServer } from "@/lib/env/server";

let redisClient: Redis | null | undefined;

/**
 * Returns a cached Upstash Redis client or null when Redis is not configured.
 *
 * This function is resilient to initialization failures and will return null
 * instead of throwing when the client cannot be created.
 */
export function getRedis() {
  if (redisClient !== undefined) {
    return redisClient;
  }

  if (!envServer.UPSTASH_REDIS_REST_URL || !envServer.UPSTASH_REDIS_REST_TOKEN) {
    redisClient = null;
    return null;
  }

  try {
    redisClient = new Redis({
      url: envServer.UPSTASH_REDIS_REST_URL,
      token: envServer.UPSTASH_REDIS_REST_TOKEN,
    });
  } catch (error) {
    redisClient = null;
  }

  return redisClient;
}

/**
 * Cached Redis client instance (may be null when not configured).
 */
export const redis = getRedis();
