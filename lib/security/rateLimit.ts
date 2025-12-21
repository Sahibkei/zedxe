import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

const redis = Redis.fromEnv();

const rateLimiters = {
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
};

export const getClientIp = (req: Request): string => {
    const forwardedFor = req.headers.get("x-forwarded-for");
    if (!forwardedFor) return "unknown";
    return forwardedFor.split(",")[0]?.trim() || "unknown";
};

export const enforceRateLimit = async (
    req: Request,
    action: "signup" | "forgot" | "resend",
) => {
    const ip = getClientIp(req);
    const { success } = await rateLimiters[action].limit(`${action}:${ip}`);

    if (!success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    return null;
};
