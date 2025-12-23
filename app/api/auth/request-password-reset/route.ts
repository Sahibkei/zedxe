import { z } from "zod";
import { NextResponse } from "next/server";

import { auth } from "@/lib/better-auth/auth";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { getTurnstileIp, verifyTurnstileToken } from "@/lib/security/turnstile";

const hasTurnstileSecret = Boolean(process.env.TURNSTILE_SECRET_KEY);
const requestSchema = z.object({
    email: z.string().email(),
    redirectTo: z.string().url().optional(),
    turnstileToken: hasTurnstileSecret ? z.string().min(1) : z.string().nullable().optional(),
});

export const POST = async (request: Request) => {
    const rateLimited = await enforceRateLimit(request, "forgot");
    if (rateLimited) return rateLimited;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ success: false, code: "invalid_json" }, { status: 400 });
    }

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ success: false, code: "invalid_json" }, { status: 400 });
    }

    const { email, redirectTo, turnstileToken } = parsed.data;

    if (hasTurnstileSecret && !turnstileToken) {
        return NextResponse.json({ success: false, code: "turnstile_missing" }, { status: 403 });
    }

    const verification = await verifyTurnstileToken(turnstileToken ?? null, getTurnstileIp(request));
    if (!verification.ok) {
        if (verification.error === "turnstile_misconfigured") {
            return NextResponse.json({ success: false, code: verification.error }, { status: 500 });
        }
        return NextResponse.json(
            { success: false, code: verification.error ?? "turnstile_failed" },
            { status: 403 },
        );
    }

    try {
        const response = await auth.api.requestPasswordReset({
            body: { email, redirectTo },
            headers: request.headers,
        });
        if (response instanceof Response && !response.ok) {
            console.error("Password reset request failed", response.status);
        } else if (response && "error" in response && response.error) {
            console.error("Password reset request failed", response.error);
        }
    } catch (error) {
        console.error("Password reset request failed", error);
    }

    return NextResponse.json({
        success: true,
        message: "If an account exists, we sent a reset link.",
    });
};
