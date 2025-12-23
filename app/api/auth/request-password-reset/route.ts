import { z } from "zod";
import { NextResponse } from "next/server";
import { createHash, randomUUID } from "crypto";

import { auth } from "@/lib/better-auth/auth";
import { EmailConfigError } from "@/lib/nodemailer";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { getTurnstileIp, verifyTurnstileToken } from "@/lib/security/turnstile";

const hasTurnstileSecret = Boolean(process.env.TURNSTILE_SECRET_KEY);
const requestSchema = z.object({
    email: z.string().email(),
    redirectTo: z.string().url().optional(),
    turnstileToken: hasTurnstileSecret ? z.string().min(1) : z.string().nullable().optional(),
});

export const POST = async (request: Request) => {
    const requestId = randomUUID();
    const rateLimited = await enforceRateLimit(request, "forgot");
    if (rateLimited) return rateLimited;

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
        return NextResponse.json({ success: false, code: "turnstile_missing", requestId }, { status: 403 });
    }

    const verification = await verifyTurnstileToken(turnstileToken ?? null, getTurnstileIp(request));
    if (!verification.ok) {
        if (verification.error === "turnstile_misconfigured") {
            return NextResponse.json({ success: false, code: verification.error, requestId }, { status: 500 });
        }
        return NextResponse.json(
            { success: false, code: verification.error ?? "turnstile_failed", requestId },
            { status: 403 },
        );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
    let resolvedRedirect = appUrl ? `${appUrl}/reset-password` : redirectTo;
    if (!resolvedRedirect) {
        const origin = request.headers.get("origin");
        const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
        const protocol = request.headers.get("x-forwarded-proto") ?? "https";
        resolvedRedirect = origin ?? (host ? `${protocol}://${host}/reset-password` : undefined);
        console.warn("Password reset redirect fallback used", { requestId });
    }

    try {
        console.info("password-reset-requested", { requestId, emailHash });
        const headers = new Headers(request.headers);
        headers.set("x-request-id", requestId);
        const response = await auth.api.requestPasswordReset({
            body: { email, redirectTo: resolvedRedirect },
            headers,
        });
        if (response instanceof Response && !response.ok) {
            console.error("Password reset request failed", { requestId, status: response.status });
            return NextResponse.json(
                {
                    success: false,
                    message: "Unable to send reset email. Please try again later.",
                    requestId,
                },
                { status: 500 },
            );
        } else if (response && "error" in response && response.error) {
            console.error("Password reset request failed", { requestId, error: response.error });
            return NextResponse.json(
                {
                    success: false,
                    message: "Unable to send reset email. Please try again later.",
                    requestId,
                },
                { status: 500 },
            );
        }
    } catch (error) {
        if (error instanceof EmailConfigError) {
            console.error("Password reset request failed", { requestId, error: error.code });
        } else {
            console.error("Password reset request failed", { requestId, error });
        }
        return NextResponse.json(
            {
                success: false,
                message: "Unable to send reset email. Please try again later.",
                requestId,
            },
            { status: 500 },
        );
    }

    return NextResponse.json({
        success: true,
        message: "If an account exists, we sent a reset email.",
        requestId,
    });
};
