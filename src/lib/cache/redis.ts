import "server-only";

import { Redis } from "@upstash/redis";

import { envServer } from "@/lib/env/server";

let redisClient: Redis | null | undefined;

export function getRedis() {
  if (redisClient !== undefined) {
    return redisClient;
  }

  if (!envServer.UPSTASH_REDIS_REST_URL || !envServer.UPSTASH_REDIS_REST_TOKEN) {
    redisClient = null;
    return null;
  }

  redisClient = new Redis({
    url: envServer.UPSTASH_REDIS_REST_URL,
    token: envServer.UPSTASH_REDIS_REST_TOKEN,
  });

  return redisClient;
}

export const redis = getRedis();
