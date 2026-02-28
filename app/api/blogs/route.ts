import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/better-auth/auth";
import { isBlogAdmin, isBlogAdminConfigured } from "@/lib/blog/admin";
import { createPublishedBlogPost, listPublishedBlogPosts } from "@/lib/blog/service";

export const runtime = "nodejs";

const createBlogSchema = z.object({
    title: z.string().trim().min(5).max(160),
    excerpt: z.string().trim().min(20).max(320),
    content: z.string().trim().min(100).max(50000),
    tags: z.array(z.string().trim().min(1).max(24)).max(8).optional().default([]),
});

export async function GET() {
    try {
        const posts = await listPublishedBlogPosts(100);
        return NextResponse.json({ data: posts });
    } catch (error) {
        console.error("GET /api/blogs failed", error);
        return NextResponse.json({ error: "Failed to fetch blogs" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isBlogAdminConfigured()) {
        return NextResponse.json({ error: "Admin emails are not configured" }, { status: 403 });
    }

    if (!isBlogAdmin(session.user.email)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const parsed = createBlogSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid payload", details: parsed.error.issues },
            { status: 400 },
        );
    }

    try {
        const post = await createPublishedBlogPost({
            title: parsed.data.title,
            excerpt: parsed.data.excerpt,
            content: parsed.data.content,
            tags: parsed.data.tags,
            authorId: session.user.id,
            authorName: session.user.name || "ZedXe Team",
            authorEmail: session.user.email,
        });

        return NextResponse.json({ data: post }, { status: 201 });
    } catch (error) {
        console.error("POST /api/blogs failed", error);
        return NextResponse.json({ error: "Failed to publish blog" }, { status: 500 });
    }
}
