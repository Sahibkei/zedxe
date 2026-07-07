import { NextResponse } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";

import { auth } from "@/lib/better-auth/auth";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { connectToDatabase } from "@/database/mongoose";

export const runtime = "nodejs";

const USERNAME_CHANGE_COOLDOWN_MS = 15 * 24 * 60 * 60 * 1000;

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
    username: z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^@[a-z0-9_]{3,24}$/, "invalid_username")
        .optional(),
    bio: z
        .string()
        .trim()
        .max(280, "invalid_bio")
        .optional(),
});

const mapErrorCode = (issue: z.ZodIssueOptionalMessage) => {
    if (issue.message === "invalid_avatar_url_length") return { code: "invalid_avatar_url_length", message: "Avatar URL must be 100 characters or fewer." };
    if (issue.path.includes("avatarUrl")) return { code: "invalid_avatar_url", message: "Please provide a valid avatar URL." };
    if (issue.path.includes("name")) return { code: "invalid_name", message: "Name must be between 2 and 50 characters." };
    if (issue.path.includes("username")) return { code: "invalid_username", message: "Username must start with @ and use 3-24 letters, numbers, or underscores." };
    if (issue.path.includes("bio")) return { code: "invalid_bio", message: "Bio must be 280 characters or fewer." };
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

    const { name, avatarUrl, username, bio } = parsed.data;
    const updates: Record<string, unknown> = {};
    if (typeof name === "string") updates.name = name.trim();
    if (typeof bio === "string") updates.bio = bio.trim();
    if (typeof avatarUrl !== "undefined") {
        if (avatarUrl && avatarUrl.length > 100) {
            return NextResponse.json(
                { success: false, code: "invalid_avatar_url_length", message: "Avatar URL must be 100 characters or fewer." },
                { status: 400 },
            );
        }
        updates.image = avatarUrl || null;
    }

    try {
        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        if (!db) throw new Error("Database connection missing");
        await db.collection("user").createIndex({ username: 1 }, { unique: true, sparse: true });

        const filters: Record<string, unknown>[] = [{ id: session.user.id }];
        if (Types.ObjectId.isValid(session.user.id)) {
            filters.push({ _id: new Types.ObjectId(session.user.id) });
        }

        const currentUser = await db.collection("user").findOne<{
            username?: string | null;
            usernameUpdatedAt?: Date | string | null;
        }>({ $or: filters });

        if (typeof username === "string") {
            const currentUsername = currentUser?.username ?? null;
            if (username !== currentUsername) {
                if (currentUsername && currentUser?.usernameUpdatedAt) {
                    const lastChangedAt = new Date(currentUser.usernameUpdatedAt).getTime();
                    const nextChangeAt = lastChangedAt + USERNAME_CHANGE_COOLDOWN_MS;
                    if (Number.isFinite(lastChangedAt) && Date.now() < nextChangeAt) {
                        return NextResponse.json(
                            {
                                success: false,
                                code: "username_cooldown",
                                message: "You can change your username once every 15 days.",
                                nextChangeAt: new Date(nextChangeAt).toISOString(),
                            },
                            { status: 429 },
                        );
                    }
                }

                const existing = await db.collection("user").findOne({
                    username,
                    $nor: filters,
                });
                if (existing) {
                    return NextResponse.json(
                        { success: false, code: "username_taken", message: "That username is already taken." },
                        { status: 409 },
                    );
                }
                updates.username = username;
                updates.usernameUpdatedAt = new Date();
            }
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json(
                { success: false, code: "no_changes", message: "No changes provided." },
                { status: 400 },
            );
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
            username: (updatedDocument as { username?: string }).username ?? null,
            bio: (updatedDocument as { bio?: string }).bio ?? "",
            usernameUpdatedAt: (updatedDocument as { usernameUpdatedAt?: Date | string }).usernameUpdatedAt
                ? new Date((updatedDocument as { usernameUpdatedAt?: Date | string }).usernameUpdatedAt as Date | string).toISOString()
                : null,
        };

        return NextResponse.json({ success: true, user: updatedUser });
    } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 11000) {
            return NextResponse.json(
                { success: false, code: "username_taken", message: "That username is already taken." },
                { status: 409 },
            );
        }
        console.error("Profile update failed", error);
        return NextResponse.json(
            { success: false, code: "internal_error", message: "Failed to update profile." },
            { status: 500 },
        );
    }
};
