import { z } from "zod";
import { NextResponse } from "next/server";

import { auth } from "@/lib/better-auth/auth";
import { inngest } from "@/lib/inngest/client";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { getTurnstileIp, verifyTurnstileToken } from "@/lib/security/turnstile";
import type { SignUpFormData } from "@/lib/types/auth";

const hasTurnstileSecret = Boolean(process.env.TURNSTILE_SECRET_KEY);
const signUpSchema = z.object({
    fullName: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
    country: z.string().optional(),
    investmentGoals: z.string().optional(),
    riskTolerance: z.string().optional(),
    preferredIndustry: z.string().optional(),
    turnstileToken: hasTurnstileSecret ? z.string().min(1) : z.string().nullable().optional(),
});

export const POST = async (request: Request) => {
    const rateLimited = await enforceRateLimit(request, "signup");
    if (rateLimited) return rateLimited;

    try {
        let body: SignUpFormData;
        try {
            body = (await request.json()) as SignUpFormData;
        } catch (error) {
            console.error("Invalid JSON payload", error);
            return NextResponse.json(
                { success: false, code: "invalid_json", message: "Invalid request body." },
                { status: 400 },
            );
        }
        const parsed = signUpSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { success: false, code: "invalid_input", message: "Invalid input." },
                { status: 400 },
            );
        }

        const {
            email,
            password,
            fullName,
            country,
            investmentGoals,
            riskTolerance,
            preferredIndustry,
            turnstileToken,
        } =
            parsed.data;

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

        const response = await auth.api.signUpEmail({
            body: { email, password, name: fullName },
            headers: request.headers,
        });
        if (response instanceof Response) {
            return response;
        }
        if (!response?.user || ("error" in response && response.error)) {
            const rawError = response?.error;
            const errorCode =
                typeof rawError === "string" ? rawError : (rawError as { code?: string })?.code ?? "";
            const normalizedCode = errorCode.toUpperCase();
            const isEmailTaken = ["EMAIL_EXISTS", "EMAIL_ALREADY_EXISTS", "USER_ALREADY_EXISTS", "USER_EXISTS"].includes(
                normalizedCode,
            );
            const code = isEmailTaken ? "email_taken" : "server_error";
            const status = isEmailTaken ? 409 : 500;
            console.error("Sign up failed", code);
            return NextResponse.json(
                { success: false, code, message: "Sign up failed." },
                { status },
            );
        }

        if (response?.user) {
            await inngest.send({
                name: "app/user.created",
                data: { email, name: fullName, country, investmentGoals, riskTolerance, preferredIndustry },
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Sign up failed", error);
        return NextResponse.json(
            { success: false, code: "server_error", message: "Sign up failed." },
            { status: 500 },
        );
    }
};
