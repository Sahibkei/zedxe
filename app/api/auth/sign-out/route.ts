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
            { success: false, code: "sign_out_failed", message: "Sign out failed." },
            { status: 500 },
        );
    }
};
