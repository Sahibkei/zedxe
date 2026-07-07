import { NextResponse } from "next/server";
import { ObjectId, type Db, type Document } from "mongodb";

import { connectToDatabase } from "@/database/mongoose";
import { auth } from "@/lib/better-auth/auth";
import { findResearchWireUserById } from "@/lib/research-wire/users";
import { enforceRateLimit } from "@/lib/security/rateLimit";

export const runtime = "nodejs";

const CHAT_COLLECTION = "research_wire_chats";

type ChatMember = {
    id: string;
    name: string;
    role: "admin" | "member";
};

type ChatMessage = {
    id: string;
    senderId: string;
    senderName: string;
    body: string;
    createdAt: Date;
};

type ChatDocument = Document & {
    _id: ObjectId;
    type: "direct" | "group";
    name?: string;
    status: "pending" | "active";
    requesterId: string;
    recipientId?: string;
    participantIds: string[];
    members: ChatMember[];
    messages: ChatMessage[];
    createdAt: Date;
    updatedAt: Date;
};

let chatIndexesPromise: Promise<void> | null = null;

const getResearchWireDb = async () => {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error("Database connection missing");
    return db;
};

const ensureChatIndexes = (db: Db) => {
    if (!chatIndexesPromise) {
        chatIndexesPromise = Promise.all([
            db.collection(CHAT_COLLECTION).createIndex({ participantIds: 1, updatedAt: -1 }),
            db.collection(CHAT_COLLECTION).createIndex({ type: 1, requesterId: 1, recipientId: 1 }),
        ]).then(() => undefined);
    }

    return chatIndexesPromise;
};

const getBodyString = (body: unknown, key: string) =>
    typeof body === "object" && body !== null && key in body
        ? String((body as Record<string, unknown>)[key] ?? "").trim()
        : "";

const getBodyStringArray = (body: unknown, key: string) =>
    typeof body === "object" && body !== null && key in body && Array.isArray((body as Record<string, unknown>)[key])
        ? ((body as Record<string, unknown>)[key] as unknown[])
              .map((value) => String(value ?? "").trim())
              .filter(Boolean)
        : [];

const getConversationFilter = (conversationId: string, currentUserId: string) => ({
    ...(ObjectId.isValid(conversationId) ? { _id: new ObjectId(conversationId) } : { id: conversationId }),
    participantIds: currentUserId,
});

const displayMemberName = (user: Document | null, fallback: string) =>
    typeof user?.name === "string" && user.name.trim()
        ? user.name.trim()
        : typeof user?.email === "string" && user.email.trim()
          ? user.email.trim()
          : fallback;

const mapConversation = (conversation: ChatDocument, currentUserId: string) => {
    const otherMember = conversation.members.find((member) => member.id !== currentUserId);
    const isIncoming = conversation.status === "pending" && conversation.recipientId === currentUserId;

    return {
        id: conversation._id.toString(),
        type: conversation.type,
        name: conversation.type === "direct" ? otherMember?.name ?? conversation.name ?? "Direct chat" : conversation.name ?? "Group chat",
        status: conversation.status,
        requesterId: conversation.requesterId,
        recipientId: conversation.recipientId ?? null,
        direction: conversation.status === "pending" ? (isIncoming ? "incoming" : "outgoing") : null,
        members: conversation.members,
        messages: (conversation.messages ?? []).map((message) => ({
            ...message,
            createdAt: message.createdAt instanceof Date ? message.createdAt.toISOString() : String(message.createdAt),
        })),
    };
};

const getConversations = async (db: Db, currentUserId: string) => {
    const conversations = await db
        .collection<ChatDocument>(CHAT_COLLECTION)
        .find({ participantIds: currentUserId })
        .sort({ updatedAt: -1 })
        .limit(100)
        .toArray();

    return conversations.map((conversation) => mapConversation(conversation, currentUserId));
};

export const GET = async (request: Request) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
        return NextResponse.json({ success: false, code: "unauthorized" }, { status: 401 });
    }

    try {
        const db = await getResearchWireDb();
        await ensureChatIndexes(db);

        return NextResponse.json({
            success: true,
            conversations: await getConversations(db, session.user.id),
        });
    } catch (error) {
        console.error("Research Wire chat lookup failed", error);
        return NextResponse.json(
            { success: false, code: "internal_error", message: "Failed to load chat requests." },
            { status: 500 },
        );
    }
};

export const POST = async (request: Request) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
        return NextResponse.json({ success: false, code: "unauthorized" }, { status: 401 });
    }

    const rateLimited = await enforceRateLimit(request, "research_wire_chat");
    if (rateLimited) return rateLimited;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ success: false, code: "invalid_json" }, { status: 400 });
    }

    const action = getBodyString(body, "action");
    const now = new Date();

    try {
        const db = await getResearchWireDb();
        await ensureChatIndexes(db);
        const collection = db.collection<ChatDocument>(CHAT_COLLECTION);

        if (action === "request") {
            const targetUserId = getBodyString(body, "targetUserId");
            if (!targetUserId) {
                return NextResponse.json({ success: false, code: "invalid_input" }, { status: 400 });
            }
            if (targetUserId === session.user.id) {
                return NextResponse.json(
                    { success: false, code: "cannot_chat_self", message: "You cannot send a chat request to yourself." },
                    { status: 400 },
                );
            }

            const [currentUser, targetUser] = await Promise.all([
                findResearchWireUserById(db, session.user.id, { _id: 1, id: 1, name: 1, email: 1 }),
                findResearchWireUserById(db, targetUserId, { _id: 1, id: 1, name: 1, email: 1 }),
            ]);
            if (!targetUser) {
                return NextResponse.json(
                    { success: false, code: "target_not_found", message: "User not found." },
                    { status: 404 },
                );
            }

            const existingConversation = await collection.findOne({
                type: "direct",
                participantIds: { $all: [session.user.id, targetUserId] },
            });

            if (!existingConversation) {
                await collection.insertOne({
                    _id: new ObjectId(),
                    type: "direct",
                    status: "pending",
                    requesterId: session.user.id,
                    recipientId: targetUserId,
                    participantIds: [session.user.id, targetUserId],
                    members: [
                        { id: session.user.id, name: displayMemberName(currentUser, "You"), role: "member" },
                        { id: targetUserId, name: displayMemberName(targetUser, "Research Wire user"), role: "member" },
                    ],
                    messages: [],
                    createdAt: now,
                    updatedAt: now,
                });
            }

            return NextResponse.json({
                success: true,
                conversations: await getConversations(db, session.user.id),
            });
        }

        if (action === "create_group") {
            const groupName = getBodyString(body, "groupName").slice(0, 80);
            const targetUserIds = [...new Set(getBodyStringArray(body, "targetUserIds"))].filter(
                (targetUserId) => targetUserId !== session.user.id,
            );
            if (!groupName || !targetUserIds.length) {
                return NextResponse.json({ success: false, code: "invalid_input" }, { status: 400 });
            }

            const [currentUser, targetUsers] = await Promise.all([
                findResearchWireUserById(db, session.user.id, { _id: 1, id: 1, name: 1, email: 1 }),
                Promise.all(
                    targetUserIds.map((targetUserId) =>
                        findResearchWireUserById(db, targetUserId, { _id: 1, id: 1, name: 1, email: 1 }),
                    ),
                ),
            ]);
            if (targetUsers.some((targetUser) => !targetUser)) {
                return NextResponse.json(
                    { success: false, code: "target_not_found", message: "One or more users were not found." },
                    { status: 404 },
                );
            }

            await collection.insertOne({
                _id: new ObjectId(),
                type: "group",
                name: groupName,
                status: "active",
                requesterId: session.user.id,
                participantIds: [session.user.id, ...targetUserIds],
                members: [
                    { id: session.user.id, name: displayMemberName(currentUser, "You"), role: "admin" },
                    ...targetUserIds.map((targetUserId, index) => ({
                        id: targetUserId,
                        name: displayMemberName(targetUsers[index] ?? null, "Research Wire user"),
                        role: "member" as const,
                    })),
                ],
                messages: [],
                createdAt: now,
                updatedAt: now,
            });

            return NextResponse.json({
                success: true,
                conversations: await getConversations(db, session.user.id),
            });
        }

        const conversationId = getBodyString(body, "conversationId");
        if (!conversationId) {
            return NextResponse.json({ success: false, code: "invalid_input" }, { status: 400 });
        }

        const conversation = await collection.findOne(getConversationFilter(conversationId, session.user.id));
        if (!conversation) {
            return NextResponse.json(
                { success: false, code: "conversation_not_found", message: "Conversation not found." },
                { status: 404 },
            );
        }

        if (action === "accept") {
            if (conversation.status !== "pending" || conversation.recipientId !== session.user.id) {
                return NextResponse.json({ success: false, code: "not_allowed" }, { status: 403 });
            }
            await collection.updateOne({ _id: conversation._id }, { $set: { status: "active", updatedAt: now } });
        } else if (action === "reject") {
            if (conversation.status !== "pending" || conversation.recipientId !== session.user.id) {
                return NextResponse.json({ success: false, code: "not_allowed" }, { status: 403 });
            }
            await collection.deleteOne({ _id: conversation._id });
        } else if (action === "close" || action === "leave") {
            if (conversation.type === "group" && conversation.participantIds.length > 1) {
                await collection.updateOne(
                    { _id: conversation._id },
                    {
                        $pull: {
                            participantIds: session.user.id,
                            members: { id: session.user.id },
                        },
                        $set: { updatedAt: now },
                    } as Document,
                );
            } else {
                await collection.deleteOne({ _id: conversation._id });
            }
        } else if (action === "message") {
            if (conversation.status !== "active") {
                return NextResponse.json(
                    { success: false, code: "chat_not_active", message: "Accept the chat request before sending messages." },
                    { status: 400 },
                );
            }
            const messageBody = getBodyString(body, "message").slice(0, 2000);
            if (!messageBody) {
                return NextResponse.json({ success: false, code: "invalid_input" }, { status: 400 });
            }
            const currentMember = conversation.members.find((member) => member.id === session.user.id);
            await collection.updateOne(
                { _id: conversation._id },
                {
                    $push: {
                        messages: {
                            id: new ObjectId().toString(),
                            senderId: session.user.id,
                            senderName: currentMember?.name ?? "You",
                            body: messageBody,
                            createdAt: now,
                        },
                    },
                    $set: { updatedAt: now },
                } as Document,
            );
        } else {
            return NextResponse.json({ success: false, code: "invalid_input" }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            conversations: await getConversations(db, session.user.id),
        });
    } catch (error) {
        console.error("Research Wire chat update failed", error);
        return NextResponse.json(
            { success: false, code: "internal_error", message: "Failed to update chat request." },
            { status: 500 },
        );
    }
};
