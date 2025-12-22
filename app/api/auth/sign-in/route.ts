import { z } from "zod";
import { NextResponse } from "next/server";

import { auth } from "@/lib/better-auth/auth";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { getTurnstileIp, verifyTurnstileToken } from "@/lib/security/turnstile";

const hasTurnstileSecret = Boolean(process.env.TURNSTILE_SECRET_KEY);
const signInSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
    turnstileToken: hasTurnstileSecret ? z.string().min(1) : z.string().nullable().optional(),
});

export const POST = async (request: Request) => {
    const rateLimited = await enforceRateLimit(request, "signin");
    if (rateLimited) return rateLimited;

    try {
        const body = await request.json();
        const parsed = signInSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ success: false, error: "Invalid input" }, { status: 400 });
        }

        const { email, password, turnstileToken } = parsed.data;

        if (hasTurnstileSecret && !turnstileToken) {
            return NextResponse.json({ success: false, error: "turnstile_missing" }, { status: 403 });
        }

        const verification = await verifyTurnstileToken(turnstileToken ?? null, getTurnstileIp(request));
        if (!verification.ok) {
            if (verification.error === "turnstile_misconfigured") {
                return NextResponse.json({ success: false, error: verification.error }, { status: 500 });
            }
            return NextResponse.json(
                { success: false, error: verification.error ?? "turnstile_failed" },
                { status: 403 },
            );
        }

        const response = await auth.api.signInEmail({ body: { email, password }, headers: request.headers });
        if (response instanceof Response) {
            return response;
        }
        if (!response || ("error" in response && response.error)) {
            const errorMessage = typeof response?.error === "string" ? response.error : "";
            const normalized = errorMessage.toLowerCase();
            const isInvalid =
                normalized.includes("invalid") || normalized.includes("credential") || normalized.includes("password");
            const errorCode = isInvalid ? "invalid_credentials" : "server_error";
            const status = isInvalid ? 401 : 500;
            console.error("Sign in failed", errorCode);
            return NextResponse.json({ success: false, error: errorCode }, { status });
        }

        return NextResponse.json({ success: true, data: response });
    } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        if (message.includes("invalid") || message.includes("credential")) {
            console.error("Sign in failed", "invalid_credentials");
            return NextResponse.json({ success: false, error: "invalid_credentials" }, { status: 401 });
        }
        console.error("Sign in failed", error);
        return NextResponse.json({ success: false, error: "server_error" }, { status: 500 });
    }
};
