import { NextResponse } from "next/server";

import { auth } from "@/lib/better-auth/auth";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { AppError } from "@/lib/server/auth/errors";

export const POST = async (request: Request) => {
    try {
        const rateLimited = await enforceRateLimit(request, "auth_signout");
        if (rateLimited) return rateLimited;
        return await auth.api.signOut({ headers: request.headers });
    } catch (error) {
        if (error instanceof AppError) {
            console.error("auth:sign-out", {
                code: error.code,
                status: error.status,
                errName: error.name,
                errMessage: error.message,
            });
            return NextResponse.json(
                { success: false, code: error.code, message: error.message },
                { status: error.status },
            );
        }
        console.error("auth:sign-out", {
            code: "signout_failed",
            status: 500,
            errName: error instanceof Error ? error.name : undefined,
            errMessage: error instanceof Error ? error.message : undefined,
        });
        return NextResponse.json(
            { success: false, code: "signout_failed", message: "Failed to sign out." },
            { status: 500 },
        );
    }
};
