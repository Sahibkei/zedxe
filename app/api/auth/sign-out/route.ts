import { NextResponse } from "next/server";

import { auth } from "@/lib/better-auth/auth";
import { enforceRateLimit } from "@/lib/security/rateLimit";

export const POST = async (request: Request) => {
    try {
        const rateLimited = await enforceRateLimit(request, "auth_signout");
        if (rateLimited) return rateLimited;
        return await auth.api.signOut({ headers: request.headers });
    } catch (error) {
        console.error("auth:sign-out", error);
        return NextResponse.json(
            { success: false, code: "signout_failed", message: "Failed to sign out." },
            { status: 500 },
        );
    }
};
