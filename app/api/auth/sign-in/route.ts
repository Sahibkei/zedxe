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
        let body: unknown;
        try {
            body = await request.json();
        } catch (error) {
            console.error("Invalid JSON payload", error);
            return NextResponse.json(
                { success: false, code: "invalid_json", message: "Invalid JSON payload." },
                { status: 400 },
            );
        }
        const parsed = signInSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { success: false, code: "invalid_input", message: "Invalid input." },
                { status: 400 },
            );
        }

        const { email, password, turnstileToken } = parsed.data;

        if (hasTurnstileSecret && !turnstileToken) {
            return NextResponse.json(
                { success: false, code: "turnstile_missing", message: "Turnstile token is missing." },
                { status: 403 },
            );
        }

        const verification = await verifyTurnstileToken(turnstileToken ?? null, getTurnstileIp(request));
        if (!verification.ok) {
            const status = verification.code === "turnstile_misconfigured" ? 500 : 403;
            return NextResponse.json(
                {
                    success: false,
                    code: verification.code,
                    message: "Turnstile verification failed.",
                    cfErrors: verification.cfErrors,
                },
                { status },
            );
        }

        const response = await auth.api.signInEmail({ body: { email, password }, headers: request.headers });
        if (response instanceof Response) {
            return response;
        }
        if (!response || ("error" in response && response.error)) {
            const rawError = response?.error;
            const errorCode =
                typeof rawError === "string" ? rawError : (rawError as { code?: string })?.code ?? "";
            const normalizedCode = errorCode.toUpperCase();
            const isInvalid = [
                "INVALID_CREDENTIALS",
                "INVALID_EMAIL_OR_PASSWORD",
                "INVALID_LOGIN",
                "INVALID_PASSWORD",
                "INVALID_EMAIL",
            ].includes(normalizedCode);
            const status = isInvalid ? 401 : 500;
            const code = isInvalid ? "auth_invalid_credentials" : "server_error";
            console.error("Sign in failed", code);
            return NextResponse.json(
                { success: false, code, message: "Sign in failed." },
                { status },
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Sign in failed", error);
        return NextResponse.json(
            { success: false, code: "server_error", message: "Sign in failed." },
            { status: 500 },
        );
    }
};
