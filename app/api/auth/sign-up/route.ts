import { z } from "zod";
import { NextResponse } from "next/server";

import { auth } from "@/lib/better-auth/auth";
import { inngest } from "@/lib/inngest/client";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { getTurnstileIp, verifyTurnstile } from "@/lib/security/turnstile";
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
    turnstileToken: z.string().nullable().optional(),
});

export const POST = async (request: Request) => {
    const rateLimited = await enforceRateLimit(request, "signup");
    if (rateLimited) return rateLimited;

    try {
        const body = (await request.json()) as SignUpFormData;
        const parsed = signUpSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ success: false, error: "Invalid input" }, { status: 400 });
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

        const response = await auth.api.signUpEmail({
            body: { email, password, name: fullName },
            headers: request.headers,
        });
        if (response instanceof Response) {
            return response;
        }
        if (!response?.user || ("error" in response && response.error)) {
            const errorMessage = typeof response?.error === "string" ? response.error : "";
            const normalized = errorMessage.toLowerCase();
            const isEmailTaken = normalized.includes("exist") || normalized.includes("taken");
            const errorCode = isEmailTaken ? "email_taken" : "internal_error";
            const status = isEmailTaken ? 409 : 500;
            console.error("Sign up failed", errorCode);
            return NextResponse.json(
                {
                    success: false,
                    code: errorCode,
                    message: isEmailTaken ? "Email already in use" : "Unexpected server error",
                },
                { status },
            );
        }

        if (response?.user) {
            await inngest.send({
                name: "app/user.created",
                data: { email, name: fullName, country, investmentGoals, riskTolerance, preferredIndustry },
            });
        }

        return NextResponse.json({ success: true, data: response });
    } catch (error) {
        console.error("Sign up failed", error);
        return NextResponse.json(
            { success: false, code: "internal_error", message: "Unexpected server error" },
            { status: 500 },
        );
    }
};
