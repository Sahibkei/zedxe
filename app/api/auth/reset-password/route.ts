import { z } from "zod";
import { NextResponse } from "next/server";

import { auth } from "@/lib/better-auth/auth";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { getTurnstileIp, verifyTurnstileToken } from "@/lib/security/turnstile";

const hasTurnstileSecret = Boolean(process.env.TURNSTILE_SECRET_KEY);
const resetSchema = z.object({
    token: z.string().min(1),
    newPassword: z.string().min(8),
    turnstileToken: hasTurnstileSecret ? z.string().min(1) : z.string().nullable().optional(),
});

const isInvalidTokenError = (error?: unknown) => {
    if (!error) return false;
    const message = typeof error === "string" ? error : "";
    const normalized = message.toLowerCase();
    return normalized.includes("invalid") || normalized.includes("expired") || normalized.includes("token");
};

export const POST = async (request: Request) => {
    const rateLimited = await enforceRateLimit(request, "reset");
    if (rateLimited) return rateLimited;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ success: false, code: "invalid_json" }, { status: 400 });
    }

    const parsed = resetSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ success: false, code: "invalid_json" }, { status: 400 });
    }

    const { token, newPassword, turnstileToken } = parsed.data;

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
        const response = await auth.api.resetPassword({
            body: { token, newPassword },
            headers: request.headers,
        });

        if (response instanceof Response) {
            if (!response.ok) {
                return NextResponse.json(
                    { success: false, code: "internal_error" },
                    { status: response.status },
                );
            }
            return NextResponse.json({ success: true });
        }

        if (response && "error" in response && response.error) {
            const errorMessage = typeof response.error === "string" ? response.error : "";
            if (isInvalidTokenError(errorMessage)) {
                return NextResponse.json(
                    {
                        success: false,
                        code: "INVALID_TOKEN",
                        message: "Reset link is invalid or expired.",
                    },
                    { status: 400 },
                );
            }
            console.error("Reset password failed", response.error);
            return NextResponse.json({ success: false, code: "internal_error" }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        if (isInvalidTokenError(error instanceof Error ? error.message : "")) {
            return NextResponse.json(
                { success: false, code: "INVALID_TOKEN", message: "Reset link is invalid or expired." },
                { status: 400 },
            );
        }
        console.error("Reset password failed", error);
        return NextResponse.json({ success: false, code: "internal_error" }, { status: 500 });
    }
};
