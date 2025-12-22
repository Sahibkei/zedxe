import { NextResponse } from "next/server";

import { enforceRateLimit } from "@/lib/security/rateLimit";
import { getTurnstileIp } from "@/lib/security/turnstile";
import { AppError } from "@/lib/server/auth/errors";
import { signIn } from "@/lib/server/auth/signIn";

export const POST = async (request: Request) => {
    const rateLimited = await enforceRateLimit(request, "signin");
    if (rateLimited) return rateLimited;

    try {
        const body = await request.json();
        const result = await signIn(body, getTurnstileIp(request));
        return NextResponse.json({ success: true, data: result.data });
    } catch (error) {
        if (error instanceof AppError) {
            console.error("auth:sign-in", {
                code: error.code,
                status: error.status,
                errName: error.name,
                errMessage: error.message,
            });
            return NextResponse.json(
                {
                    success: false,
                    code: error.code,
                    message: error.message,
                    ...(process.env.NODE_ENV !== "production" ? { debug: error.details } : {}),
                },
                { status: error.status },
            );
        }
        console.error("auth:sign-in", {
            code: "internal_error",
            status: 500,
            errName: error instanceof Error ? error.name : undefined,
            errMessage: error instanceof Error ? error.message : undefined,
        });
        return NextResponse.json(
            { success: false, code: "internal_error", message: "Unexpected server error" },
            { status: 500 },
        );
    }
};
