import { z } from "zod";
import { NextResponse } from "next/server";

import { auth } from "@/lib/better-auth/auth";
import { inngest } from "@/lib/inngest/client";
import { enforceRateLimit } from "@/lib/security/rateLimit";

type SignUpFormData = {
    fullName: string;
    email: string;
    password: string;
    country?: string;
    investmentGoals?: string;
    riskTolerance?: string;
    preferredIndustry?: string;
};

const signUpSchema = z.object({
    fullName: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
    country: z.string().optional(),
    investmentGoals: z.string().optional(),
    riskTolerance: z.string().optional(),
    preferredIndustry: z.string().optional(),
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

        const { email, password, fullName, country, investmentGoals, riskTolerance, preferredIndustry } =
            parsed.data;

        const response = await auth.api.signUpEmail({ body: { email, password, name: fullName } });

        if (response?.user) {
            await inngest.send({
                name: "app/user.created",
                data: { email, name: fullName, country, investmentGoals, riskTolerance, preferredIndustry },
            });
        }

        return NextResponse.json({ success: true, data: response });
    } catch (error) {
        console.error("Sign up failed", error);
        return NextResponse.json({ success: false, error: "Sign up failed" }, { status: 500 });
    }
};
