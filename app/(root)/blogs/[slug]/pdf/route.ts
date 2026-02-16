import { NextRequest, NextResponse } from "next/server";

import { generateBlogPostPdf } from "@/lib/blog/pdf";
import { getPublishedBlogPostBySlug } from "@/lib/blog/service";

export const runtime = "nodejs";

export async function GET(_: NextRequest, context: { params: Promise<{ slug: string }> }) {
    const resolvedParams = await context.params;
    const slug = resolvedParams.slug?.trim().toLowerCase();

    if (!slug) {
        return NextResponse.json({ error: "Invalid blog slug" }, { status: 400 });
    }

    const post = await getPublishedBlogPostBySlug(slug);
    if (!post) {
        return NextResponse.json({ error: "Blog not found" }, { status: 404 });
    }

    try {
        const pdfBytes = await generateBlogPostPdf(post);
        const safeFilename = `${post.slug}.pdf`;
        const responseBody = Buffer.from(pdfBytes);

        return new NextResponse(responseBody, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${safeFilename}"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
        console.error("Failed to generate blog PDF", error);
        return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
    }
}
