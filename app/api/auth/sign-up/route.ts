import { z } from "zod";
import { NextResponse } from "next/server";

import { auth } from "@/lib/better-auth/auth";
import { inngest } from "@/lib/inngest/client";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { getTurnstileIp, verifyTurnstileToken } from "@/lib/security/turnstile";
import type { SignUpFormData } from "@/lib/types/auth";

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

        if (!turnstileToken) {
            return NextResponse.json({ success: false, error: "turnstile_missing" }, { status: 403 });
        }

        const verification = await verifyTurnstileToken(turnstileToken ?? null, getTurnstileIp(request));
        if (!verification.ok) {
            if (verification.error === "turnstile_misconfigured") {
                return NextResponse.json({ success: false, error: verification.error }, { status: 500 });
            }
            return NextResponse.json(
                { success: false, error: "turnstile_invalid" },
                { status: 403 },
            );
        }

        const response = await auth.api.signUpEmail({ body: { email, password, name: fullName } });
        if (!response?.user || ("error" in response && response.error)) {
            console.error("Sign up failed", response?.error);
            return NextResponse.json({ success: false, error: "sign_up_failed" }, { status: 500 });
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
        return NextResponse.json({ success: false, error: "sign_up_failed" }, { status: 500 });
    }
};
