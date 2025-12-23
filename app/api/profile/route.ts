import { NextResponse } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";

import { auth } from "@/lib/better-auth/auth";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { connectToDatabase } from "@/database/mongoose";

export const runtime = "nodejs";

const avatarUrlSchema = z.union([
    z.string().trim().length(0).transform(() => null),
    z
        .string()
        .trim()
        .max(100, "invalid_avatar_url_length")
        .url("invalid_avatar_url")
        .refine((value) => {
            const protocol = new URL(value).protocol;
            return protocol === "http:" || protocol === "https:";
        }, "invalid_avatar_url"),
]);

const profileSchema = z.object({
    name: z
        .string()
        .trim()
        .min(2, "invalid_name")
        .max(50, "invalid_name")
        .optional(),
    avatarUrl: avatarUrlSchema.optional(),
});

const mapErrorCode = (issue: z.ZodIssueOptionalMessage) => {
    if (issue.message === "invalid_avatar_url_length") return { code: "invalid_avatar_url_length", message: "Avatar URL must be 100 characters or fewer." };
    if (issue.path.includes("avatarUrl")) return { code: "invalid_avatar_url", message: "Please provide a valid avatar URL." };
    if (issue.path.includes("name")) return { code: "invalid_name", message: "Name must be between 2 and 50 characters." };
    return { code: "invalid_input", message: "Invalid input." };
};

export const PATCH = async (request: Request) => {
    const rateLimited = await enforceRateLimit(request, "profile_update");
    if (rateLimited) return rateLimited;

    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
        return NextResponse.json({ success: false, code: "unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ success: false, code: "invalid_json" }, { status: 400 });
    }

    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const { code, message } = mapErrorCode(issue);
        return NextResponse.json({ success: false, code, message }, { status: 400 });
    }

    const { name, avatarUrl } = parsed.data;
    const updates: Record<string, unknown> = {};
    if (typeof name === "string") updates.name = name.trim();
    if (typeof avatarUrl !== "undefined") {
        if (avatarUrl && avatarUrl.length > 100) {
            return NextResponse.json(
                { success: false, code: "invalid_avatar_url_length", message: "Avatar URL must be 100 characters or fewer." },
                { status: 400 },
            );
        }
        updates.image = avatarUrl || null;
    }

    if (Object.keys(updates).length === 0) {
        return NextResponse.json(
            { success: false, code: "no_changes", message: "No changes provided." },
            { status: 400 },
        );
    }

    try {
        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        if (!db) throw new Error("Database connection missing");

        const filters: Record<string, unknown>[] = [{ id: session.user.id }];
        if (Types.ObjectId.isValid(session.user.id)) {
            filters.push({ _id: new Types.ObjectId(session.user.id) });
        }

        const result = await db.collection("user").findOneAndUpdate(
            { $or: filters },
            { $set: updates },
            { returnDocument: "after" },
        );

        const updatedDocument =
            result && typeof result === "object" && "value" in result
                ? (result as { value?: Record<string, unknown> }).value
                : result;

        if (!updatedDocument) {
            return NextResponse.json(
                { success: false, code: "not_found", message: "User not found." },
                { status: 404 },
            );
        }

        const updatedUser = {
            name: (updatedDocument as { name?: string }).name ?? session.user.name,
            email: (updatedDocument as { email?: string }).email ?? session.user.email,
            image: "image" in (updatedDocument as Record<string, unknown>) ? (updatedDocument as { image?: string | null }).image ?? null : null,
        };

        return NextResponse.json({ success: true, user: updatedUser });
    } catch (error) {
        console.error("Profile update failed", error);
        return NextResponse.json(
            { success: false, code: "internal_error", message: "Failed to update profile." },
            { status: 500 },
        );
    }
};
