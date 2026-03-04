import Link from "next/link";
import Navbar from "@/app/(marketing)/components/Navbar";
import Footer from "@/app/(marketing)/components/Footer";
import { BLOG_POSTS } from "@/lib/blog/posts";

const formatDate = (isoDate: string) =>
    new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(new Date(isoDate));

export default function BlogIndexPage() {
    return (
        <main className="relative overflow-hidden bg-gray-900 text-white">
            <div className="pointer-events-none absolute inset-0 -z-10">
                <div className="absolute inset-0 chart-bg" />
                <div className="absolute inset-0 grain" />
            </div>
            <Navbar />
            <section className="container py-16 md:py-24">
                <div className="mx-auto max-w-5xl space-y-10">
                    <header className="space-y-3">
                        <p className="text-xs uppercase tracking-[0.3em] text-teal-300">Blog</p>
                        <h1 className="text-3xl font-semibold text-white md:text-5xl">ZedXe Research</h1>
                        <p className="max-w-2xl text-base text-gray-300 md:text-lg">
                            Earnings notes, market explainers, and model write-ups.
                        </p>
                    </header>

                    <div className="grid gap-6">
                        {BLOG_POSTS.map((post) => (
                            <article key={post.slug} className="glass-card rounded-3xl p-6 md:p-8">
                                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-300">
                                    <time dateTime={post.dateISO}>{formatDate(post.dateISO)}</time>
                                    <span className="text-white/30">•</span>
                                    {post.tags.map((tag) => (
                                        <span key={tag} className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] uppercase tracking-[0.08em]">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                                <h2 className="mt-4 text-2xl font-semibold text-white">{post.title}</h2>
                                <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-300 md:text-base">{post.excerpt}</p>
                                <Link
                                    href={`/blog/${post.slug}`}
                                    className="btn-glow mt-6 inline-flex items-center gap-2 rounded-full bg-teal-400 px-5 py-2.5 text-sm font-semibold text-gray-900"
                                >
                                    Read article
                                </Link>
                            </article>
                        ))}
                    </div>
                </div>
            </section>
            <Footer />
        </main>
    );
}
