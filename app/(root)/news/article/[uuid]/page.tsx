import { fetchArticleByUuid } from "@/app/(root)/news/data";
import { formatRelativeTime } from "@/app/(root)/news/utils";
import type { MarketauxArticle } from "@/types/marketaux";
import Link from "next/link";

interface NewsArticlePageProps {
    params: Promise<{ uuid: string }>;
    searchParams?: Promise<{ page?: string }>;
}

const NewsArticlePage = async ({ params, searchParams }: NewsArticlePageProps) => {
    const resolvedParams = await params;
    const resolvedSearchParams = searchParams ? await searchParams : undefined;

    const rawUuid = resolvedParams?.uuid ?? "";
    const uuid = rawUuid.trim();

    const fromPage = resolvedSearchParams?.page;
    const backHref = fromPage ? `/news?page=${fromPage}` : "/news";

    if (!uuid) {
        return (
            <div className="max-w-3xl mx-auto px-4 py-16">
                <h1 className="text-2xl font-semibold text-white">Article not found</h1>
                <p className="mt-2 text-gray-400">
                    We couldn&apos;t find this article. It may have expired or been removed.
                </p>
                <Link
                    href={backHref}
                    className="mt-6 inline-flex text-sm text-emerald-400 hover:text-emerald-300"
                >
                    ← Back to News
                </Link>
            </div>
        );
    }

    let article: MarketauxArticle | null = null;

    try {
        article = await fetchArticleByUuid(uuid);
    } catch (error) {
        console.error("[NewsArticlePage] Unexpected error while fetching article", { uuid, error });
    }

    if (!article) {
        return (
            <div className="max-w-3xl mx-auto px-4 py-16">
                <h1 className="text-2xl font-semibold text-white">Article not found</h1>
                <p className="mt-2 text-gray-400">
                    We couldn&apos;t load this article. It may have expired or been removed.
                </p>
                <Link
                    href={backHref}
                    className="mt-6 inline-flex text-sm text-emerald-400 hover:text-emerald-300"
                >
                    ← Back to News
                </Link>
            </div>
        );
    }

    const title = article.title ?? "Untitled article";
    const source = article.source ?? "Unknown source";
    const imageUrl = article.image_url;
    const externalUrl = article.url ?? "#";

    return (
        <article className="max-w-3xl mx-auto px-4 py-10 space-y-6">
            <header className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
                    News Article
                </p>
                <h1 className="text-3xl font-bold text-white leading-tight">
                    {title}
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-400">
                    <span>{source}</span>
                    <span className="text-gray-600">•</span>
                    <span>{formatRelativeTime(article.published_at)}</span>
                </div>
            </header>

            {imageUrl && (
                <div className="overflow-hidden rounded-xl border border-gray-800 bg-black/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={imageUrl}
                        alt={title}
                        className="w-full max-h-[420px] object-cover"
                        loading="lazy"
                    />
                </div>
            )}

            {article.description && (
                <p className="text-base leading-relaxed text-gray-200">
                    {article.description}
                </p>
            )}

            {article.snippet && article.snippet !== article.description && (
                <p className="text-base leading-relaxed text-gray-300">
                    {article.snippet}
                </p>
            )}

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-gray-800 pt-6">
                <Link
                    href={backHref}
                    className="text-sm text-gray-400 hover:text-gray-200"
                >
                    ← Back to News
                </Link>

                <a
                    href={externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center text-sm font-medium text-emerald-400 hover:text-emerald-300"
                >
                    Read full story on {source}
                </a>
            </div>
        </article>
    );
};

export default NewsArticlePage;
