import { createHash } from "crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

type RateLimitAction = "signup" | "forgot" | "resend" | "signin" | "reset" | "profile_update";
type RateLimiters = Record<RateLimitAction, Ratelimit>;

let cachedRedis: Redis | null | undefined;
let cachedLimiters: RateLimiters | null = null;
let warnedMissingRedis = false;

const getRedisClient = () => {
    if (cachedRedis !== undefined) return cachedRedis;

    const restUrl = process.env.UPSTASH_REDIS_REST_URL;
    const restToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!restUrl || !restToken) {
        if (!warnedMissingRedis) {
            console.error("Upstash Redis env vars are missing; rate limiting is disabled.");
            warnedMissingRedis = true;
        }
        cachedRedis = null;
        return cachedRedis;
    }

    try {
        cachedRedis = Redis.fromEnv();
        return cachedRedis;
    } catch (error) {
        if (!warnedMissingRedis) {
            console.error("Upstash Redis unavailable; rate limiting is disabled.", error);
            warnedMissingRedis = true;
        }
        cachedRedis = null;
        return cachedRedis;
    }
};

const getRateLimiter = (action: RateLimitAction) => {
    const redis = getRedisClient();
    if (!redis) return null;

    if (!cachedLimiters) {
        cachedLimiters = {
            signup: new Ratelimit({
                redis,
                limiter: Ratelimit.fixedWindow(5, "1 h"),
                prefix: "rate-limit:signup",
            }),
            forgot: new Ratelimit({
                redis,
                limiter: Ratelimit.fixedWindow(5, "1 h"),
                prefix: "rate-limit:forgot",
            }),
            resend: new Ratelimit({
                redis,
                limiter: Ratelimit.fixedWindow(3, "1 h"),
                prefix: "rate-limit:resend",
            }),
            signin: new Ratelimit({
                redis,
                limiter: Ratelimit.fixedWindow(10, "1 h"),
                prefix: "rate-limit:signin",
            }),
            reset: new Ratelimit({
                redis,
                limiter: Ratelimit.fixedWindow(10, "1 h"),
                prefix: "rate-limit:reset",
            }),
            profile_update: new Ratelimit({
                redis,
                limiter: Ratelimit.fixedWindow(20, "1 h"),
                prefix: "rate-limit:profile_update",
            }),
        };
    }

    return cachedLimiters[action];
};

export const getClientIp = (req: Request): string => {
    const forwardedFor = req.headers.get("x-forwarded-for");
    if (forwardedFor) {
        const parsed = forwardedFor.split(",")[0]?.trim();
        if (parsed) return parsed;
    }

    const realIp = req.headers.get("x-real-ip");
    if (realIp) return realIp.trim();

    const userAgent = req.headers.get("user-agent") ?? "unknown";
    const language = req.headers.get("accept-language") ?? "unknown";
    const fingerprint = createHash("sha256").update(`${userAgent}|${language}`).digest("hex").slice(0, 16);
    return `fp:${fingerprint}`;
};

export const enforceRateLimit = async (
    req: Request,
    action: RateLimitAction,
) => {
    const ip = getClientIp(req);
    const limiter = getRateLimiter(action);
    if (!limiter) return null;

    try {
        const { success } = await limiter.limit(ip);
        if (!success) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }
    } catch (error) {
        console.error("Rate limit check failed; allowing request.", error);
        return null;
    }
    return null;
};
