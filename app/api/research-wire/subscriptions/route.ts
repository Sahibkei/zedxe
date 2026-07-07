import { NextResponse } from "next/server";

import { connectToDatabase } from "@/database/mongoose";
import { auth } from "@/lib/better-auth/auth";

export const runtime = "nodejs";

const SUBSCRIPTION_COLLECTION = "research_wire_subscriptions";

const ensureSubscriptionIndexes = async () => {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error("Database connection missing");

    await db.collection(SUBSCRIPTION_COLLECTION).createIndex({ subscriberId: 1, creatorId: 1 }, { unique: true });
    await db.collection(SUBSCRIPTION_COLLECTION).createIndex({ creatorId: 1 });

    return db;
};

export const GET = async (request: Request) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
        return NextResponse.json({ success: false, code: "unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("targetUserId")?.trim();
    if (!targetUserId) {
        return NextResponse.json({ success: false, code: "invalid_input" }, { status: 400 });
    }

    try {
        const db = await ensureSubscriptionIndexes();
        const collection = db.collection(SUBSCRIPTION_COLLECTION);

        const [subscriberCount, existingSubscription] = await Promise.all([
            collection.countDocuments({ creatorId: targetUserId }),
            collection.findOne({ subscriberId: session.user.id, creatorId: targetUserId }),
        ]);

        return NextResponse.json({
            success: true,
            subscriberCount,
            isSubscribed: Boolean(existingSubscription),
        });
    } catch (error) {
        console.error("Research Wire subscription lookup failed", error);
        return NextResponse.json(
            { success: false, code: "internal_error", message: "Failed to load subscribe state." },
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

    if (!targetUserId || (action !== "subscribe" && action !== "unsubscribe")) {
        return NextResponse.json({ success: false, code: "invalid_input" }, { status: 400 });
    }
    if (targetUserId === session.user.id) {
        return NextResponse.json(
            { success: false, code: "cannot_subscribe_self", message: "You cannot subscribe to yourself." },
            { status: 400 },
        );
    }

    try {
        const db = await ensureSubscriptionIndexes();
        const collection = db.collection(SUBSCRIPTION_COLLECTION);

        if (action === "subscribe") {
            await collection.updateOne(
                { subscriberId: session.user.id, creatorId: targetUserId },
                {
                    $setOnInsert: {
                        subscriberId: session.user.id,
                        creatorId: targetUserId,
                        notifyInApp: true,
                        createdAt: new Date(),
                    },
                },
                { upsert: true },
            );
        } else {
            await collection.deleteOne({ subscriberId: session.user.id, creatorId: targetUserId });
        }

        const [subscriberCount, existingSubscription] = await Promise.all([
            collection.countDocuments({ creatorId: targetUserId }),
            collection.findOne({ subscriberId: session.user.id, creatorId: targetUserId }),
        ]);

        return NextResponse.json({
            success: true,
            subscriberCount,
            isSubscribed: Boolean(existingSubscription),
        });
    } catch (error) {
        console.error("Research Wire subscription update failed", error);
        return NextResponse.json(
            { success: false, code: "internal_error", message: "Failed to update subscribe state." },
            { status: 500 },
        );
    }
};
