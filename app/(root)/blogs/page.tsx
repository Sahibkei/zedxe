import Link from "next/link";
import { headers } from "next/headers";

import { auth } from "@/lib/better-auth/auth";
import { isBlogAdmin } from "@/lib/blog/admin";
import { listPublishedBlogPosts } from "@/lib/blog/service";

export const dynamic = "force-dynamic";

const formatDate = (value: Date): string =>
    value.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });

const BlogsPage = async () => {
    const [posts, session] = await Promise.all([
        listPublishedBlogPosts(100),
        auth.api.getSession({ headers: await headers() }),
    ]);
    const canManageBlogs = isBlogAdmin(session?.user?.email);

    return (
        <section className="mx-auto max-w-6xl space-y-8 py-6">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div className="space-y-2">
                    <p className="text-sm uppercase tracking-[0.3em] text-[#58a6ff]">ZedXe Blogs</p>
                    <h1 className="text-3xl font-semibold text-white">Insights, deep dives, and market intelligence</h1>
                    <p className="max-w-2xl text-sm text-slate-400">
                        Read the latest research from our team. Every post has a downloadable PDF version for offline reading.
                    </p>
                </div>
                {canManageBlogs ? (
                    <Link
                        href="/admin/blogs"
                        className="rounded-lg border border-[#58a6ff]/40 bg-[#58a6ff]/10 px-4 py-2 text-sm font-medium text-[#9dccff] transition hover:bg-[#58a6ff]/20"
                    >
                        Manage blogs
                    </Link>
                ) : null}
            </header>

            {posts.length === 0 ? (
                <div className="rounded-xl border border-[#1c2432] bg-[#0d1117] p-8 text-center">
                    <h2 className="text-lg font-medium text-slate-200">No blogs published yet</h2>
                    <p className="mt-2 text-sm text-slate-400">Check back soon for the first article.</p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {posts.map((post) => (
                        <article key={post.id} className="rounded-xl border border-[#1c2432] bg-[#0d1117] p-6">
                            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
                                <span>{formatDate(post.publishedAt)}</span>
                                <span className="text-slate-600">|</span>
                                <span>{post.authorName}</span>
                            </div>
                            <h2 className="mt-3 text-xl font-semibold text-white">{post.title}</h2>
                            <p className="mt-2 line-clamp-3 text-sm text-slate-300">{post.excerpt}</p>

                            {post.tags.length > 0 ? (
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {post.tags.map((tag) => (
                                        <span
                                            key={`${post.id}-${tag}`}
                                            className="rounded-full border border-[#26334a] bg-[#121a27] px-3 py-1 text-xs text-slate-300"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            ) : null}

                            <div className="mt-6 flex flex-wrap gap-3">
                                <Link
                                    href={`/blogs/${post.slug}`}
                                    className="rounded-md bg-[#58a6ff] px-4 py-2 text-sm font-medium text-[#010409] transition hover:bg-[#7cb9ff]"
                                >
                                    Read article
                                </Link>
                                <Link
                                    href={`/blogs/${post.slug}/pdf`}
                                    prefetch={false}
                                    className="rounded-md border border-[#26334a] px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-[#58a6ff]/60 hover:text-white"
                                >
                                    Download PDF
                                </Link>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
};

export default BlogsPage;
