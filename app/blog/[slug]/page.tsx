import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/app/(marketing)/components/Navbar";
import Footer from "@/app/(marketing)/components/Footer";
import { Button } from "@/components/ui/button";
import { BLOG_POSTS, getPost } from "@/lib/blog/posts";

type BlogPostPageProps = {
    params: Promise<{ slug: string }>;
};

const formatDate = (isoDate: string) =>
    new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
    }).format(new Date(isoDate));

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
    const { slug } = await params;
    const post = getPost(slug);

    if (!post) {
        return {
            title: "Blog post not found",
            description: "This blog article could not be located.",
        };
    }

    return {
        title: `${post.title} | ZedXe Research`,
        description: post.excerpt,
    };
}

export function generateStaticParams() {
    return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
    const { slug } = await params;
    const post = getPost(slug);

    if (!post) {
        notFound();
    }

    return (
        <main className="relative overflow-hidden bg-gray-900 text-white">
            <div className="pointer-events-none absolute inset-0 -z-10">
                <div className="absolute inset-0 chart-bg" />
                <div className="absolute inset-0 grain" />
            </div>
            <Navbar />
            <section className="container py-16 md:py-24">
                <article className="mx-auto max-w-5xl space-y-8">
                    <Link href="/blog" className="inline-flex text-sm text-gray-300 transition hover:text-white">
                        ← Back to research
                    </Link>

                    <header className="glass-card space-y-6 rounded-3xl p-6 md:p-8">
                        <div className="space-y-3">
                            <h1 className="text-3xl font-semibold text-white md:text-5xl">{post.title}</h1>
                            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-300">
                                <time dateTime={post.dateISO}>{formatDate(post.dateISO)}</time>
                                <span className="text-white/30">•</span>
                                {post.tags.map((tag) => (
                                    <span key={tag} className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] uppercase tracking-[0.08em]">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 text-sm text-yellow-100">
                            Educational only — not financial advice.
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <Button asChild size="lg" className="btn-glow rounded-full bg-teal-400 px-6 text-gray-900 hover:bg-teal-300">
                                <a href={post.pdfPath} download>
                                    Download PDF
                                </a>
                            </Button>
                            <Button asChild variant="outline" size="lg" className="rounded-full border-white/20 bg-transparent px-6 text-white hover:bg-white/10">
                                <a href={post.pdfPath} target="_blank" rel="noreferrer">
                                    Open PDF
                                </a>
                            </Button>
                        </div>
                    </header>

                    <div className="glass-card rounded-3xl p-6 md:p-8">{post.content()}</div>
                </article>
            </section>
            <Footer />
        </main>
    );
}
