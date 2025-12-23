import { z } from "zod";
import { NextResponse } from "next/server";
import { createHash, randomUUID } from "crypto";

import { auth } from "@/lib/better-auth/auth";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { getTurnstileIp, verifyTurnstileToken } from "@/lib/security/turnstile";

export const runtime = "nodejs";

const hasTurnstileSecret = Boolean(process.env.TURNSTILE_SECRET_KEY);
const requestSchema = z.object({
    email: z.string().email(),
    redirectTo: z.string().url().optional(),
    turnstileToken: hasTurnstileSecret ? z.string().min(1) : z.string().nullable().optional(),
});

const getSafeRedirectOrigin = (request: Request) => {
    const envOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
    if (envOrigin) return envOrigin;
    try {
        const url = new URL(request.url);
        return url.origin;
    } catch {
        return null;
    }
};

const sanitizeRedirectTo = (redirectTo: string | undefined, allowedOrigin: string) => {
    if (!redirectTo) return null;
    try {
        if (redirectTo.startsWith("/")) {
            return new URL(redirectTo, allowedOrigin).toString();
        }
        const parsed = new URL(redirectTo);
        if (parsed.origin === allowedOrigin) {
            return parsed.toString();
        }
    } catch {
        return null;
    }
    return null;
};

export const POST = async (request: Request) => {
    const requestId = randomUUID();
    const rateLimited = await enforceRateLimit(request, "forgot");
    if (rateLimited) {
        console.warn("Password reset rate limited", { requestId });
        return NextResponse.json({
            success: true,
            message: "If an account exists, we sent a reset email.",
            requestId,
        });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ success: false, code: "invalid_json", requestId }, { status: 400 });
    }

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ success: false, code: "invalid_json", requestId }, { status: 400 });
    }

    const { email, redirectTo, turnstileToken } = parsed.data;
    const emailHash = createHash("sha256").update(email.toLowerCase()).digest("hex");

    if (hasTurnstileSecret && !turnstileToken) {
        console.warn("Password reset turnstile missing", { requestId });
        return NextResponse.json({
            success: true,
            message: "If an account exists, we sent a reset email.",
            requestId,
        });
    }

    const verification = await verifyTurnstileToken(turnstileToken ?? null, getTurnstileIp(request));
    if (!verification.ok) {
        if (verification.error === "turnstile_misconfigured") {
            console.error("Password reset turnstile misconfigured", { requestId });
            return NextResponse.json({
                success: true,
                message: "If an account exists, we sent a reset email.",
                requestId,
            });
        }
        console.warn("Password reset turnstile failed", { requestId });
        return NextResponse.json({
            success: true,
            message: "If an account exists, we sent a reset email.",
            requestId,
        });
    }

    const allowedOrigin = getSafeRedirectOrigin(request);
    const safeRedirect = allowedOrigin
        ? sanitizeRedirectTo(redirectTo, allowedOrigin) ?? new URL("/reset-password", allowedOrigin).toString()
        : undefined;

    try {
        console.info("password-reset-requested", { requestId, emailHash });
        const headers = new Headers(request.headers);
        headers.set("x-request-id", requestId);
        const response = await auth.api.requestPasswordReset({
            body: { email, redirectTo: safeRedirect },
            headers,
        });
        if (response instanceof Response && !response.ok) {
            console.error("Password reset request failed", { requestId, status: response.status });
        } else if (response && "error" in response && response.error) {
            console.error("Password reset request failed", { requestId, error: response.error });
        }
    } catch (error) {
        console.error("Password reset request failed", { requestId, error });
    }

    return NextResponse.json({
        success: true,
        message: "If an account exists, we sent a reset email.",
        requestId,
    });
};
