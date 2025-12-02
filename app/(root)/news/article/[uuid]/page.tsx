/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { fetchNews } from "@/app/(root)/news/data";
import { formatRelativeTime } from "@/app/(root)/news/utils";
import type { MarketauxArticle } from "@/types/marketaux";

type ArticlePageProps = {
    params: { uuid: string };
    searchParams?: { page?: string };
};

function parsePage(raw?: string): number {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.floor(n);
}

const NewsArticlePage = async ({ params, searchParams }: ArticlePageProps) => {
    const originPage = parsePage(searchParams?.page);
    let article: MarketauxArticle | null = null;
    let loadError = false;

    try {
        const firstPass = await fetchNews(originPage);
        article = firstPass.articles.find((a) => a.uuid === params.uuid) ?? null;

        if (!article) {
            const fallback = await fetchNews(1);
            article = fallback.articles.find((a) => a.uuid === params.uuid) ?? null;
        }
    } catch (err) {
        console.error("[NewsArticlePage] Failed to load article:", err);
        loadError = true;
    }

    if (loadError) {
        return (
            <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
                <p className="text-red-400 mb-4">Unable to load this article right now.</p>
                <Link href={`/news?page=${originPage}`} className="text-emerald-400 hover:text-emerald-300">
                    Back to News
                </Link>
            </main>
        );
    }

    if (!article) {
        return (
            <main className="max-w-4xl mx-auto py-10 px-4">
                <h1 className="text-2xl font-semibold mb-4">Article not found</h1>
                <p className="text-gray-400 mb-6">
                    We couldn&apos;t find this article in the latest feed. It may have expired or been removed.
                </p>
                <Link href="/news" className="text-emerald-400 hover:text-emerald-300">
                    ← Back to News
                </Link>
            </main>
        );
    }

    const bodyContent = article.content || article.description || article.snippet || "No additional details available.";
    const source = article.source || "Unknown source";

    return (
        <section className="mx-auto max-w-4xl px-4 py-12 space-y-6">
            <Link href={`/news?page=${originPage}`} className="text-sm text-emerald-400 hover:text-emerald-300">
                ← Back to News
            </Link>

            <article className="space-y-4 rounded-2xl border border-gray-800 bg-[#0f1115] p-6 shadow-lg shadow-black/20">
                <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-emerald-400">{source}</p>
                    <h1 className="text-3xl font-bold text-white leading-tight">{article.title || "Untitled article"}</h1>
                    <p className="text-sm text-gray-500">{formatRelativeTime(article.published_at)}</p>
                </div>

                {article.image_url ? (
                    <img
                        src={article.image_url}
                        alt={article.title || "Article image"}
                        className="w-full rounded-xl object-cover"
                        loading="lazy"
                    />
                ) : null}

                <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{bodyContent}</p>

                {article.url ? (
                    <a
                        href={article.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex w-fit items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400"
                    >
                        Read original on {source}
                    </a>
                ) : null}
            </article>
        </section>
    );
};

export default NewsArticlePage;
