/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import NewsWatchlistSidebar from "@/app/(root)/news/_components/NewsWatchlistSidebar";
import { fetchNews } from "@/app/(root)/news/data";
import { formatRelativeTime, parsePage } from "@/app/(root)/news/utils";
import { getWatchlistWithData } from "@/lib/actions/watchlist.actions";
import { auth } from "@/lib/better-auth/auth";
import type { MarketauxArticle } from "@/types/marketaux";

const findArticle = (articles: MarketauxArticle[] | undefined, uuid: string) =>
    articles?.find((item) => item.uuid === uuid);

const buildArticleParagraphs = (article: MarketauxArticle): string[] => {
    const content = article.content?.trim();
    if (content) {
        return content.split(/\n+/).map((part) => part.trim()).filter(Boolean);
    }

    const fallbackPieces = [article.description, article.snippet].filter((part) => part && part.trim());
    const merged = fallbackPieces.join("\n\n").trim();
    return merged ? merged.split(/\n+/).map((part) => part.trim()).filter(Boolean) : [];
};

const NewsArticlePage = async ({
    params,
    searchParams,
}: {
    params: Promise<{ uuid: string }>;
    searchParams: Promise<{ page?: string }>;
}) => {
    const resolvedParams = await params;
    const resolvedSearchParams = await searchParams;

    const originPage = parsePage(resolvedSearchParams?.page);
    const targetUuid = resolvedParams.uuid;

    const loadPage = async (page: number) => {
        const response = await fetchNews(page);
        const articles = (response.data ?? []).filter((item) => Boolean(item?.uuid));
        return { articles, article: findArticle(articles, targetUuid) };
    };

    let article: MarketauxArticle | undefined;

    const initialPage = await loadPage(originPage);
    article = initialPage.article;

    if (!article && originPage !== 1) {
        const fallbackPage = await loadPage(1);
        article = fallbackPage.article;
    }

    if (!article) {
        return notFound();
    }

    let watchlist: WatchlistEntryWithData[] = [];
    let isAuthenticated = false;

    try {
        const session = await auth.api.getSession({ headers: await headers() });
        isAuthenticated = Boolean(session?.user);

        if (isAuthenticated) {
            watchlist = await getWatchlistWithData();
        }
    } catch (error) {
        const debugMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("[NewsArticlePage] Unable to load watchlist", debugMessage);
    }

    const paragraphs = buildArticleParagraphs(article);
    const backHref = `/news?page=${originPage}`;

    return (
        <section className="max-w-6xl mx-auto px-4 py-8">
            <div className="grid gap-8 lg:grid-cols-3">
                <article className="lg:col-span-2 space-y-4">
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
                        <Link href={backHref} className="font-medium text-emerald-400 hover:text-emerald-300">
                            ← Back to News
                        </Link>
                        <span className="text-gray-700">•</span>
                        <span>{formatRelativeTime(article.published_at)}</span>
                        {article.url ? (
                            <a
                                href={article.url}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="ml-auto text-emerald-400 hover:text-emerald-300"
                            >
                                Source ↗
                            </a>
                        ) : null}
                    </div>

                    <h1 className="text-3xl font-bold leading-tight text-white">{article.title ?? "Untitled article"}</h1>
                    <p className="text-sm font-semibold uppercase tracking-wide text-emerald-400">
                        {article.source ?? "Unknown source"}
                    </p>

                    {article.image_url ? (
                        <img
                            src={article.image_url}
                            alt={article.title ?? "Article image"}
                            className="w-full rounded-xl border border-gray-800 object-cover"
                        />
                    ) : (
                        <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-gray-700 bg-gray-900 text-gray-500">
                            No image available
                        </div>
                    )}

                    <div className="space-y-4 text-base leading-relaxed text-gray-200">
                        {paragraphs.length > 0 ? (
                            paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)
                        ) : (
                            <p className="text-gray-400">No additional content available for this article.</p>
                        )}
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-800 pt-4 text-sm font-medium text-emerald-400">
                        <Link href={backHref} className="hover:text-emerald-300">
                            ← Back to News
                        </Link>
                        {article.url ? (
                            <a
                                href={article.url}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="hover:text-emerald-300"
                            >
                                Source ↗
                            </a>
                        ) : null}
                    </div>
                </article>

                <NewsWatchlistSidebar watchlist={watchlist} isAuthenticated={isAuthenticated} />
            </div>
        </section>
    );
};

export default NewsArticlePage;
