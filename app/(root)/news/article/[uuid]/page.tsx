import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";

import NewsWatchlistSidebar from "@/app/(root)/news/_components/NewsWatchlistSidebar";
import { fetchNews } from "@/app/(root)/news/data";
import { formatRelativeTime } from "@/app/(root)/news/utils";
import type { MarketauxArticle } from "@/types/marketaux";

export const dynamic = "force-dynamic";

const parsePage = (pageParam?: string): number => {
    const parsed = Number(pageParam ?? "1");
    if (Number.isNaN(parsed) || parsed < 1) return 1;
    return Math.floor(parsed);
};

const renderBodyContent = (article: MarketauxArticle): string[] => {
    const content = article.content || article.description || article.snippet;
    if (!content) return ["Full article not available; please read it on the original source."];

    return content.split(/\n+/).filter(Boolean);
};

const NewsArticlePage = async ({
    params,
    searchParams,
}: {
    params: { uuid: string };
    searchParams?: { page?: string };
}) => {
    const requestedPage = parsePage(searchParams?.page);

    const loadPage = async (
        page: number,
    ): Promise<{ response: Awaited<ReturnType<typeof fetchNews>> | null; error?: string }> => {
        try {
            const response = await fetchNews(page);
            return { response };
        } catch (error) {
            console.error("[NewsArticlePage] Failed to fetch news", error);
            const message = error instanceof Error ? error.message : String(error);
            return { response: null, error: message };
        }
    };

    const { response: initialResponse, error: initialError } = await loadPage(requestedPage);
    const initialData = initialResponse?.data ?? [];
    let article = initialData.find((item) => item.uuid === params.uuid);
    let originPage = requestedPage;
    let loadError = initialError;

    if (!article && requestedPage !== 1) {
        const { response: fallbackResponse, error: fallbackError } = await loadPage(1);
        const fallbackData = fallbackResponse?.data ?? [];
        article = fallbackData.find((item) => item.uuid === params.uuid);
        if (article) {
            originPage = 1;
        } else if (fallbackError && !loadError) {
            loadError = fallbackError;
        }
    }

    if (!article) {
        if (loadError) {
            const showDebug = process.env.NODE_ENV !== "production";
            return (
                <section className="max-w-4xl mx-auto px-4 py-16">
                    <div className="rounded-xl border border-red-900/60 bg-red-950/40 px-6 py-8 text-center text-red-100">
                        <h2 className="text-xl font-semibold">Unable to load this article right now.</h2>
                        <p className="mt-2 text-sm text-red-200">Please try again later.</p>
                        {showDebug && loadError ? (
                            <p className="mt-3 text-xs text-red-300">Debug: {loadError}</p>
                        ) : null}
                    </div>
                </section>
            );
        }

        return notFound();
    }

    const source = article.source ?? "Unknown source";
    const externalUrl = article.url && article.url !== "#" ? article.url : null;
    const publishedLabel = formatRelativeTime(article.published_at);
    const bodyParagraphs = renderBodyContent(article);

    return (
        <section className="max-w-6xl mx-auto px-4 py-8 space-y-6">
            <div className="flex items-center justify-between">
                <Link
                    href={`/news?page=${originPage}`}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-300 hover:text-emerald-200"
                >
                    <ArrowLeft className="h-4 w-4" /> Back to News
                </Link>
            </div>

            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
                <article className="space-y-4 rounded-2xl border border-gray-800 bg-[#0f1115] p-6 shadow-lg shadow-black/20">
                    {article.image_url ? (
                        <img
                            src={article.image_url}
                            alt={article.title ?? "Article image"}
                            className="w-full rounded-xl object-cover"
                            loading="lazy"
                        />
                    ) : (
                        <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-gray-700 bg-gray-900 text-sm uppercase tracking-wide text-gray-500">
                            Image not available
                        </div>
                    )}

                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold leading-tight text-white">
                            {article.title ?? "Untitled article"}
                        </h1>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
                            <span className="text-gray-200">{source}</span>
                            <span className="text-gray-600">•</span>
                            <span>{publishedLabel}</span>
                        </div>
                    </div>

                    <div className="space-y-3 text-gray-200 leading-relaxed">
                        {bodyParagraphs.map((paragraph, idx) => (
                            <p key={`paragraph-${idx}`} className="whitespace-pre-line">
                                {paragraph}
                            </p>
                        ))}
                    </div>

                    {externalUrl ? (
                        <Link
                            href={externalUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 font-semibold"
                        >
                            View original on {source}
                            <ExternalLink className="h-4 w-4" />
                        </Link>
                    ) : (
                        <span className="text-sm text-gray-500">Original source link unavailable.</span>
                    )}
                </article>

                <NewsWatchlistSidebar />
            </div>
        </section>
    );
};

export default NewsArticlePage;
