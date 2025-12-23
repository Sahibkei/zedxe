import { NextResponse } from "next/server";

import { auth } from "@/lib/better-auth/auth";

export const POST = async (request: Request) => {
    try {
        const response = await auth.api.signOut({ headers: request.headers });
        if (response instanceof Response) {
            return response;
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Sign out failed", error);
        return NextResponse.json(
            { success: false, code: "internal_error", message: "Unable to sign out right now." },
            { status: 500 },
        );
    }
};
