import { NextResponse } from "next/server";
import { Types } from "mongoose";
import type { Db } from "mongodb";

import { connectToDatabase } from "@/database/mongoose";
import { auth } from "@/lib/better-auth/auth";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { findResearchWireUserById, mapResearchWireUser } from "@/lib/research-wire/users";

export const runtime = "nodejs";

const FOLLOW_COLLECTION = "research_wire_follows";

let followIndexesPromise: Promise<void> | null = null;

const getResearchWireDb = async () => {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error("Database connection missing");
    return db;
};

const ensureFollowIndexes = (db: Db) => {
    if (!followIndexesPromise) {
        followIndexesPromise = Promise.all([
            db.collection(FOLLOW_COLLECTION).createIndex({ followerId: 1, followingId: 1 }, { unique: true }),
            db.collection(FOLLOW_COLLECTION).createIndex({ followingId: 1 }),
        ]).then(() => undefined);
    }

    return followIndexesPromise;
};

const isDuplicateKeyError = (error: unknown) =>
    typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 11000;

export const GET = async (request: Request) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
        return NextResponse.json({ success: false, code: "unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("targetUserId")?.trim() || session.user.id;
    const list = searchParams.get("list");

    try {
        const db = await getResearchWireDb();
        await ensureFollowIndexes(db);
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
                        return mapResearchWireUser(user);
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

    const rateLimited = await enforceRateLimit(request, "research_wire_follow");
    if (rateLimited) return rateLimited;

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
        const db = await getResearchWireDb();
        await ensureFollowIndexes(db);
        const targetUser = await findResearchWireUserById(db, targetUserId, { _id: 1, id: 1 });
        if (!targetUser) {
            return NextResponse.json(
                { success: false, code: "target_not_found", message: "User not found." },
                { status: 404 },
            );
        }

        const collection = db.collection(FOLLOW_COLLECTION);

        if (action === "follow") {
            try {
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
            } catch (error) {
                if (!isDuplicateKeyError(error)) throw error;
            }
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
