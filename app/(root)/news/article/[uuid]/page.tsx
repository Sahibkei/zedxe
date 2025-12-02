/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { fetchNews } from "@/app/(root)/news/data";
import { formatRelativeTime } from "@/app/(root)/news/utils";
import { parsePage } from "@/app/(root)/news/page";

type NewsArticlePageProps = {
    params: { uuid: string } | Promise<{ uuid: string }>;
    searchParams?: { page?: string } | Promise<{ page?: string }> | undefined;
};

const isPromise = <T,>(value: T | Promise<T> | undefined): value is Promise<T> =>
    typeof value === "object" && value !== null && "then" in value;

const NewsArticlePage = async ({ params, searchParams }: NewsArticlePageProps) => {
    const resolvedParams = isPromise(params) ? await params : params;

    const resolvedSearchParams = isPromise(searchParams) ? await searchParams : searchParams;

    const originPage = parsePage(resolvedSearchParams?.page);
    let article = null;
    let loadError = false;

    try {
        const { data = [] } = await fetchNews(originPage);
        article = data.find((item) => item.uuid === resolvedParams.uuid) ?? null;

        if (!article) {
            const { data: fallback = [] } = await fetchNews(1);
            article = fallback.find((item) => item.uuid === resolvedParams.uuid) ?? null;
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
            <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
                <p className="text-slate-300 mb-4">Article not found.</p>
                <Link href={`/news?page=${originPage}`} className="text-emerald-400 hover:text-emerald-300">
                    Back to News
                </Link>
            </main>
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
                        rel="noreferrer noopener"
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
