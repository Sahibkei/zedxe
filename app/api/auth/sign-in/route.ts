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

        const verification = await verifyTurnstileToken(turnstileToken ?? null, getTurnstileIp(request));
        if (!verification.ok) {
            return NextResponse.json(
                { success: false, error: verification.error ?? "Human verification failed" },
                { status: 403 },
            );
        }

        const response = await auth.api.signInEmail({ body: { email, password } });

        return NextResponse.json({ success: true, data: response });
    } catch (error) {
        console.error("Sign in failed", error);
        return NextResponse.json({ success: false, error: "Sign in failed" }, { status: 500 });
    }
};
