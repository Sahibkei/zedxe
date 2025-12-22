import { z } from "zod";
import { NextResponse } from "next/server";

import { auth } from "@/lib/better-auth/auth";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { getTurnstileIp, verifyTurnstile } from "@/lib/security/turnstile";

const hasTurnstileSecret = Boolean(process.env.TURNSTILE_SECRET_KEY);
const signInSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
    turnstileToken: z.string().nullable().optional(),
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

        if (!hasTurnstileSecret) {
            return NextResponse.json(
                {
                    success: false,
                    code: "turnstile_misconfigured",
                    message: "Verification service misconfigured.",
                },
                { status: 500 },
            );
        }

        const verification = await verifyTurnstile(turnstileToken ?? null, getTurnstileIp(request));
        if (!verification.ok) {
            const status = verification.code === "turnstile_misconfigured" ? 500 : 403;
            const message =
                verification.code === "turnstile_missing"
                    ? "Verification is required."
                    : verification.code === "turnstile_misconfigured"
                      ? "Verification service misconfigured."
                      : "Verification failed.";
            return NextResponse.json(
                { success: false, code: verification.code, message, cfErrors: verification.cfErrors },
                { status },
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
            const errorCode = isInvalid ? "auth_invalid_credentials" : "internal_error";
            const status = isInvalid ? 401 : 500;
            console.error("Sign in failed", errorCode);
            return NextResponse.json(
                {
                    success: false,
                    code: errorCode,
                    message: isInvalid ? "Invalid email or password" : "Unexpected server error",
                },
                { status },
            );
        }

        return NextResponse.json({ success: true, data: response });
    } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        if (message.includes("invalid") || message.includes("credential")) {
            console.error("Sign in failed", "auth_invalid_credentials");
            return NextResponse.json(
                {
                    success: false,
                    code: "auth_invalid_credentials",
                    message: "Invalid email or password",
                },
                { status: 401 },
            );
        }
        console.error("Sign in failed", error);
        return NextResponse.json(
            { success: false, code: "internal_error", message: "Unexpected server error" },
            { status: 500 },
        );
    }
};
