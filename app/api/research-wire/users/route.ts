import { NextResponse } from "next/server";
import type { Db } from "mongodb";

import { connectToDatabase } from "@/database/mongoose";
import { auth } from "@/lib/better-auth/auth";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { mapResearchWireUser } from "@/lib/research-wire/users";

export const runtime = "nodejs";

let userSearchIndexesPromise: Promise<void> | null = null;

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const ensureUserSearchIndexes = (db: Db) => {
    if (!userSearchIndexesPromise) {
        userSearchIndexesPromise = Promise.all([
            db.collection("user").createIndex({ username: 1 }, { unique: true, sparse: true }),
            db.collection("user").createIndex({ name: 1 }),
        ]).then(() => undefined);
    }

    return userSearchIndexesPromise;
};

export const GET = async (request: Request) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
        return NextResponse.json({ success: false, code: "unauthorized" }, { status: 401 });
    }

    const rateLimited = await enforceRateLimit(request, "research_wire_search");
    if (rateLimited) return rateLimited;

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim().toLowerCase() ?? "";
    if (!query) {
        return NextResponse.json({ success: true, users: [] });
    }

    const cleanQuery = query.replace(/^@+/, "");
    if (!cleanQuery || cleanQuery.length > 50) {
        return NextResponse.json({ success: true, users: [] });
    }

    const escapedQuery = escapeRegex(cleanQuery);
    const usernameRegex = new RegExp(`^@${escapedQuery}`, "i");
    const nameRegex = new RegExp(`^${escapedQuery}`, "i");

    try {
        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        if (!db) throw new Error("Database connection missing");
        await ensureUserSearchIndexes(db);

        const users = await db
            .collection("user")
            .find(
                {
                    $or: [{ username: usernameRegex }, { name: nameRegex }],
                },
                {
                    projection: {
                        _id: 1,
                        id: 1,
                        name: 1,
                        username: 1,
                        image: 1,
                        bio: 1,
                    },
                },
            )
            .limit(12)
            .toArray();

        return NextResponse.json({
            success: true,
            users: users.map(mapResearchWireUser),
        });
    } catch (error) {
        console.error("Research Wire user search failed", error);
        return NextResponse.json(
            { success: false, code: "internal_error", message: "Failed to search users." },
            { status: 500 },
        );
    }
};
