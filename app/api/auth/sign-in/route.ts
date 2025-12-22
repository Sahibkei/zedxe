import { z } from "zod";
import { NextResponse } from "next/server";

import { auth } from "@/lib/better-auth/auth";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { getTurnstileIp, verifyTurnstileToken } from "@/lib/security/turnstile";

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

        const response = await auth.api.signInEmail({ body: { email, password } });
        if (!response || ("error" in response && response.error)) {
            console.error("Sign in failed", response?.error);
            return NextResponse.json({ success: false, error: "sign_in_failed" }, { status: 500 });
        }

        return NextResponse.json({ success: true, data: response });
    } catch (error) {
        console.error("Sign in failed", error);
        return NextResponse.json({ success: false, error: "sign_in_failed" }, { status: 500 });
    }
};
