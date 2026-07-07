import { NextResponse } from "next/server";
import { Types } from "mongoose";

import { connectToDatabase } from "@/database/mongoose";
import { auth } from "@/lib/better-auth/auth";

export const runtime = "nodejs";

const FOLLOW_COLLECTION = "research_wire_follows";

const ensureFollowIndexes = async () => {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error("Database connection missing");

    await db.collection(FOLLOW_COLLECTION).createIndex({ followerId: 1, followingId: 1 }, { unique: true });
    await db.collection(FOLLOW_COLLECTION).createIndex({ followingId: 1 });

    return db;
};

export const GET = async (request: Request) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
        return NextResponse.json({ success: false, code: "unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("targetUserId")?.trim() || session.user.id;
    const list = searchParams.get("list");

    try {
        const db = await ensureFollowIndexes();
        const collection = db.collection(FOLLOW_COLLECTION);

        if (list === "followers" || list === "following") {
            const records = await collection
                .find(list === "followers" ? { followingId: targetUserId } : { followerId: targetUserId })
                .sort({ createdAt: -1 })
                .limit(100)
                .toArray();
            const userIds = records.map((record) =>
                list === "followers" ? String(record.followerId) : String(record.followingId),
            );

            const objectIds = userIds.filter((userId) => Types.ObjectId.isValid(userId)).map((userId) => new Types.ObjectId(userId));
            const users = userIds.length
                ? await db
                      .collection("user")
                      .find(
                          {
                              $or: [
                                  { id: { $in: userIds } },
                                  ...(objectIds.length ? [{ _id: { $in: objectIds } }] : []),
                              ],
                          },
                          { projection: { _id: 1, id: 1, name: 1, username: 1, image: 1, bio: 1 } },
                      )
                      .toArray()
                : [];
            const userById = new Map<string, (typeof users)[number]>();
            users.forEach((user) => {
                if (user.id) userById.set(String(user.id), user);
                if (user._id) userById.set(String(user._id), user);
            });

            return NextResponse.json({
                success: true,
                users: userIds
                    .map((userId) => {
                        const user = userById.get(userId);
                        if (!user) return null;
                        return {
                            id: typeof user.id === "string" ? user.id : String(user._id),
                            name: typeof user.name === "string" ? user.name : "ZedXe user",
                            username: typeof user.username === "string" ? user.username : null,
                            image: typeof user.image === "string" ? user.image : null,
                            bio: typeof user.bio === "string" ? user.bio : null,
                        };
                    })
                    .filter(Boolean),
            });
        }

        const [followersCount, followingCount, existingFollow] = await Promise.all([
            collection.countDocuments({ followingId: targetUserId }),
            collection.countDocuments({ followerId: targetUserId }),
            collection.findOne({ followerId: session.user.id, followingId: targetUserId }),
        ]);

        return NextResponse.json({
            success: true,
            followersCount,
            followingCount,
            isFollowing: Boolean(existingFollow),
        });
    } catch (error) {
        console.error("Research Wire follow lookup failed", error);
        return NextResponse.json(
            { success: false, code: "internal_error", message: "Failed to load follow state." },
            { status: 500 },
        );
    }
};

export const POST = async (request: Request) => {
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

    const targetUserId =
        typeof body === "object" && body !== null && "targetUserId" in body
            ? String((body as { targetUserId?: unknown }).targetUserId ?? "").trim()
            : "";
    const action =
        typeof body === "object" && body !== null && "action" in body
            ? String((body as { action?: unknown }).action ?? "")
            : "";

    if (!targetUserId || (action !== "follow" && action !== "unfollow")) {
        return NextResponse.json({ success: false, code: "invalid_input" }, { status: 400 });
    }
    if (targetUserId === session.user.id) {
        return NextResponse.json(
            { success: false, code: "cannot_follow_self", message: "You cannot follow yourself." },
            { status: 400 },
        );
    }

    try {
        const db = await ensureFollowIndexes();
        const collection = db.collection(FOLLOW_COLLECTION);

        if (action === "follow") {
            await collection.updateOne(
                { followerId: session.user.id, followingId: targetUserId },
                {
                    $setOnInsert: {
                        followerId: session.user.id,
                        followingId: targetUserId,
                        createdAt: new Date(),
                    },
                },
                { upsert: true },
            );
        } else {
            await collection.deleteOne({ followerId: session.user.id, followingId: targetUserId });
        }

        const [followersCount, followingCount, existingFollow] = await Promise.all([
            collection.countDocuments({ followingId: targetUserId }),
            collection.countDocuments({ followerId: targetUserId }),
            collection.findOne({ followerId: session.user.id, followingId: targetUserId }),
        ]);

        return NextResponse.json({
            success: true,
            followersCount,
            followingCount,
            isFollowing: Boolean(existingFollow),
        });
    } catch (error) {
        console.error("Research Wire follow update failed", error);
        return NextResponse.json(
            { success: false, code: "internal_error", message: "Failed to update follow state." },
            { status: 500 },
        );
    }
};
