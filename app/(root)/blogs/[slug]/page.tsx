import Link from "next/link";
import { notFound } from "next/navigation";

import { getPublishedBlogPostBySlug } from "@/lib/blog/service";

export const dynamic = "force-dynamic";

type BlogPostPageProps = {
    params: Promise<{ slug: string }>;
};

const formatDate = (value: Date): string =>
    value.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
    });

const BlogPostPage = async ({ params }: BlogPostPageProps) => {
    const resolvedParams = await params;
    const slug = resolvedParams.slug?.trim().toLowerCase();
    if (!slug) notFound();

    const post = await getPublishedBlogPostBySlug(slug);
    if (!post) notFound();

    const paragraphs = post.content
        .split(/\n{2,}/)
        .map((part) => part.trim())
        .filter(Boolean);

    return (
        <article className="mx-auto max-w-3xl space-y-8 py-8">
            <header className="space-y-4 border-b border-[#1c2432] pb-6">
                <Link href="/blogs" className="inline-flex text-sm text-slate-400 transition hover:text-white">
                    {"<- Back to Blogs"}
                </Link>
                <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.25em] text-[#58a6ff]">Published {formatDate(post.publishedAt)}</p>
                    <h1 className="text-3xl font-bold text-white">{post.title}</h1>
                    <p className="text-sm text-slate-300">{post.excerpt}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
                    <span>By {post.authorName}</span>
                    <span className="text-slate-600">|</span>
                    <Link
                        href={`/blogs/${post.slug}/pdf`}
                        prefetch={false}
                        className="text-[#9dccff] transition hover:text-[#b7dbff]"
                    >
                        Download PDF
                    </Link>
                </div>
                {post.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {post.tags.map((tag) => (
                            <span
                                key={`${post.id}-tag-${tag}`}
                                className="rounded-full border border-[#26334a] bg-[#121a27] px-3 py-1 text-xs text-slate-300"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                ) : null}
            </header>

            <div className="space-y-5 text-[15px] leading-8 text-slate-200">
                {paragraphs.map((paragraph, index) => (
                    <p key={`${post.id}-paragraph-${index}`}>
                        {paragraph.split("\n").map((line, lineIndex, lines) => (
                            <span key={`${post.id}-line-${index}-${lineIndex}`}>
                                {line}
                                {lineIndex < lines.length - 1 ? <br /> : null}
                            </span>
                        ))}
                    </p>
                ))}
            </div>
        </article>
    );
};

export default BlogPostPage;
