/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { fetchNews } from "@/app/(root)/news/data";
import { formatRelativeTime } from "@/app/(root)/news/utils";
import type { MarketauxArticle } from "@/types/marketaux";
import { parsePage } from "@/app/(root)/news/page";

const loadNewsPage = async (page: number) => {
    try {
        return await fetchNews(page);
    } catch (error) {
        console.error(`[ArticlePage] Failed to load news for page ${page}`, error);
        return null;
    }
};

type ParamsInput = { uuid: string } | Promise<{ uuid: string }>;
type SearchParamsInput = { page?: string } | Promise<{ page?: string } | undefined> | undefined;

const NewsArticlePage = async ({
    params,
    searchParams,
}: {
    params: ParamsInput;
    searchParams?: SearchParamsInput;
}) => {
    const resolvedParams = await params;
    const resolvedSearchParams = await searchParams;

    const uuid = resolvedParams?.uuid;
    const originPage = parsePage(resolvedSearchParams?.page);

    if (!uuid) {
        return (
            <section className="mx-auto max-w-4xl px-4 py-12 space-y-6">
                <h1 className="text-2xl font-semibold text-white">Article not found</h1>
                <p className="text-gray-400">The requested article could not be located.</p>
                <Link href={`/news?page=${originPage}`} className="text-emerald-400 hover:text-emerald-300">
                    Back to News
                </Link>
            </section>
        );
    }

    const primaryPageResponse = await loadNewsPage(originPage);

    if (!primaryPageResponse) {
        return (
            <section className="mx-auto max-w-4xl px-4 py-12 space-y-6">
                <h1 className="text-2xl font-semibold text-white">Unable to load article</h1>
                <p className="text-gray-400">Unable to load news right now. Please try again later.</p>
                <Link href={`/news?page=${originPage}`} className="text-emerald-400 hover:text-emerald-300">
                    Back to News
                </Link>
            </section>
        );
    }

    const locateArticle = (articles: MarketauxArticle[]): MarketauxArticle | undefined =>
        articles.find((article) => article.uuid === uuid);

    let article = locateArticle(primaryPageResponse.data ?? []);

    if (!article && originPage !== 1) {
        const fallbackResponse = await loadNewsPage(1);
        article = locateArticle(fallbackResponse?.data ?? []);
    }

    if (!article) {
        return (
            <section className="mx-auto max-w-4xl px-4 py-12 space-y-6">
                <h1 className="text-2xl font-semibold text-white">Article not found</h1>
                <p className="text-gray-400">The requested article could not be located.</p>
                <Link href={`/news?page=${originPage}`} className="text-emerald-400 hover:text-emerald-300">
                    Back to News
                </Link>
            </section>
        );
    }

    const bodyContent = article.content || article.description || article.snippet || "No additional details available.";

    return (
        <section className="mx-auto max-w-4xl px-4 py-12 space-y-6">
            <Link href={`/news?page=${originPage}`} className="text-sm text-emerald-400 hover:text-emerald-300">
                ← Back to News
            </Link>

            <article className="space-y-4 rounded-2xl border border-gray-800 bg-[#0f1115] p-6 shadow-lg shadow-black/20">
                <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-emerald-400">{article.source ?? "Unknown source"}</p>
                    <h1 className="text-3xl font-bold text-white leading-tight">{article.title ?? "Untitled article"}</h1>
                    <p className="text-sm text-gray-500">{formatRelativeTime(article.published_at)}</p>
                </div>

                {article.image_url ? (
                    <img
                        src={article.image_url}
                        alt={article.title ?? "Article image"}
                        className="w-full rounded-xl object-cover"
                        loading="lazy"
                    />
                ) : null}

                <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{bodyContent}</p>

                {article.url ? (
                    <a
                        href={article.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex w-fit items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400"
                    >
                        Read original on {article.source ?? "source"}
                    </a>
                ) : null}
            </article>
        </section>
    );
};

export default NewsArticlePage;
