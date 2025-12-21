import { NextResponse } from "next/server";

import { auth } from "@/lib/better-auth/auth";
import { inngest } from "@/lib/inngest/client";
import { enforceRateLimit } from "@/lib/security/rateLimit";

export const POST = async (request: Request) => {
    const rateLimited = await enforceRateLimit(request, "signup");
    if (rateLimited) return rateLimited;

    try {
        const { email, password, fullName, country, investmentGoals, riskTolerance, preferredIndustry } =
            (await request.json()) as SignUpFormData;

        const response = await auth.api.signUpEmail({ body: { email, password, name: fullName } });

        if (response) {
            await inngest.send({
                name: "app/user.created",
                data: { email, name: fullName, country, investmentGoals, riskTolerance, preferredIndustry },
            });
        }

        return NextResponse.json({ success: true, data: response });
    } catch (error) {
        console.log("Sign up failed", error);
        return NextResponse.json({ success: false, error: "Sign up failed" }, { status: 500 });
    }
};
