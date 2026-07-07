import { NextResponse } from "next/server";
import { Types } from "mongoose";

import { connectToDatabase } from "@/database/mongoose";
import { auth } from "@/lib/better-auth/auth";

export const runtime = "nodejs";

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const GET = async (request: Request) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
        return NextResponse.json({ success: false, code: "unauthorized" }, { status: 401 });
    }

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
            users: users.map((user) => ({
                id: typeof user.id === "string" ? user.id : user._id instanceof Types.ObjectId ? user._id.toString() : String(user._id),
                name: typeof user.name === "string" ? user.name : "ZedXe user",
                username: typeof user.username === "string" ? user.username : null,
                image: typeof user.image === "string" ? user.image : null,
                bio: typeof user.bio === "string" ? user.bio : null,
            })),
        });
    } catch (error) {
        console.error("Research Wire user search failed", error);
        return NextResponse.json(
            { success: false, code: "internal_error", message: "Failed to search users." },
            { status: 500 },
        );
    }
};
