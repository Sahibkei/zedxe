import { BlogPost } from "@/database/models/blog-post.model";
import { connectToDatabase } from "@/database/mongoose";

export type BlogPostRecord = {
    id: string;
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    tags: string[];
    authorId: string;
    authorName: string;
    authorEmail: string;
    publishedAt: Date;
    createdAt: Date;
    updatedAt: Date;
};

export type CreateBlogPostInput = {
    title: string;
    excerpt: string;
    content: string;
    tags?: string[];
    authorId: string;
    authorName: string;
    authorEmail: string;
};

const toBlogPostRecord = (value: Record<string, unknown>): BlogPostRecord => ({
    id: String(value._id),
    title: String(value.title ?? ""),
    slug: String(value.slug ?? ""),
    excerpt: String(value.excerpt ?? ""),
    content: String(value.content ?? ""),
    tags: Array.isArray(value.tags) ? value.tags.map((tag) => String(tag)) : [],
    authorId: String(value.authorId ?? ""),
    authorName: String(value.authorName ?? ""),
    authorEmail: String(value.authorEmail ?? ""),
    publishedAt: new Date(value.publishedAt as string | number | Date),
    createdAt: new Date(value.createdAt as string | number | Date),
    updatedAt: new Date(value.updatedAt as string | number | Date),
});

const normalizeTags = (tags?: string[]): string[] => {
    if (!tags) return [];

    return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))].slice(0, 8);
};

const slugify = (value: string): string => {
    const slug = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

    return slug || "blog-post";
};

const createUniqueSlug = async (title: string): Promise<string> => {
    const baseSlug = slugify(title).slice(0, 70);
    let slug = baseSlug;
    let suffix = 1;

    while (await BlogPost.exists({ slug })) {
        suffix += 1;
        slug = `${baseSlug}-${suffix}`;
    }

    return slug;
};

export const listPublishedBlogPosts = async (limit = 50): Promise<BlogPostRecord[]> => {
    await connectToDatabase();

    const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 100);
    const results = await BlogPost.find({})
        .sort({ publishedAt: -1 })
        .limit(safeLimit)
        .lean<Record<string, unknown>[]>();

    return results.map((item) => toBlogPostRecord(item));
};

export const getPublishedBlogPostBySlug = async (slug: string): Promise<BlogPostRecord | null> => {
    await connectToDatabase();

    const normalizedSlug = slug.trim().toLowerCase();
    if (!normalizedSlug) return null;

    const result = await BlogPost.findOne({ slug: normalizedSlug }).lean<Record<string, unknown> | null>();
    if (!result) return null;

    return toBlogPostRecord(result);
};

export const createPublishedBlogPost = async (input: CreateBlogPostInput): Promise<BlogPostRecord> => {
    await connectToDatabase();

    const slug = await createUniqueSlug(input.title);
    const publishedAt = new Date();

    const created = await BlogPost.create({
        title: input.title.trim(),
        slug,
        excerpt: input.excerpt.trim(),
        content: input.content.trim(),
        tags: normalizeTags(input.tags),
        authorId: input.authorId,
        authorName: input.authorName.trim(),
        authorEmail: input.authorEmail.trim().toLowerCase(),
        publishedAt,
    });

    return toBlogPostRecord(created.toObject({ flattenObjectIds: false }) as Record<string, unknown>);
};
