import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import BlogAdminForm from "@/app/(root)/admin/blogs/_components/BlogAdminForm";
import { auth } from "@/lib/better-auth/auth";
import { isBlogAdmin, isBlogAdminConfigured } from "@/lib/blog/admin";
import { listPublishedBlogPosts } from "@/lib/blog/service";

export const dynamic = "force-dynamic";

const formatDate = (value: Date): string =>
    value.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });

const AdminBlogsPage = async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect("/sign-in");

    const configured = isBlogAdminConfigured();
    if (configured && !isBlogAdmin(session.user.email)) {
        redirect("/blogs");
    }

    const posts = await listPublishedBlogPosts(12);

    return (
        <section className="mx-auto max-w-6xl space-y-8 py-6">
            <header className="space-y-2">
                <p className="text-sm uppercase tracking-[0.3em] text-[#58a6ff]">Admin</p>
                <h1 className="text-3xl font-semibold text-white">Blog Publishing Console</h1>
                <p className="max-w-3xl text-sm text-slate-400">
                    Publish blog posts directly from the dashboard. New posts appear immediately on the user blog page and include PDF download support.
                </p>
            </header>

            {!configured ? (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
                    `BLOG_ADMIN_EMAILS` is not configured. Add a comma-separated list of admin emails in your environment to control access.
                </div>
            ) : null}

            {configured ? <BlogAdminForm /> : null}

            <section className="space-y-3 rounded-xl border border-[#1c2432] bg-[#0d1117] p-6">
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-medium text-white">Recently published</h2>
                    <Link href="/blogs" className="text-sm text-[#9dccff] transition hover:text-[#b7dbff]">
                        View public blog page
                    </Link>
                </div>

                {posts.length === 0 ? (
                    <p className="text-sm text-slate-400">No blog posts published yet.</p>
                ) : (
                    <ul className="space-y-2">
                        {posts.map((post) => (
                            <li key={post.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#1c2432] bg-[#0a0f16] px-3 py-2">
                                <div>
                                    <p className="text-sm font-medium text-slate-100">{post.title}</p>
                                    <p className="text-xs text-slate-400">{formatDate(post.publishedAt)}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Link
                                        href={`/blogs/${post.slug}`}
                                        className="rounded border border-[#26334a] px-3 py-1 text-xs text-slate-200 transition hover:border-[#58a6ff]/60 hover:text-white"
                                    >
                                        Read
                                    </Link>
                                    <Link
                                        href={`/blogs/${post.slug}/pdf`}
                                        prefetch={false}
                                        className="rounded border border-[#26334a] px-3 py-1 text-xs text-slate-200 transition hover:border-[#58a6ff]/60 hover:text-white"
                                    >
                                        PDF
                                    </Link>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </section>
    );
};

export default AdminBlogsPage;
