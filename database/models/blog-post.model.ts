import { model, models, Schema } from "mongoose";

export interface BlogPostItem {
    _id: string;
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
}

const BlogPostSchema = new Schema<BlogPostItem>(
    {
        title: { type: String, required: true, trim: true, maxlength: 160 },
        slug: { type: String, required: true, trim: true, unique: true, lowercase: true },
        excerpt: { type: String, required: true, trim: true, maxlength: 320 },
        content: { type: String, required: true, trim: true, maxlength: 50000 },
        tags: [{ type: String, trim: true, lowercase: true, maxlength: 24 }],
        authorId: { type: String, required: true, index: true },
        authorName: { type: String, required: true, trim: true, maxlength: 120 },
        authorEmail: { type: String, required: true, trim: true, lowercase: true, maxlength: 255 },
        publishedAt: { type: Date, required: true, default: Date.now, index: true },
    },
    { timestamps: true },
);

BlogPostSchema.index({ slug: 1 }, { unique: true });
BlogPostSchema.index({ publishedAt: -1 });

export const BlogPost =
    (models?.BlogPost as typeof models.BlogPost) || model<BlogPostItem>("BlogPost", BlogPostSchema);
