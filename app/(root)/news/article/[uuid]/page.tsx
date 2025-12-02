import FeaturedArticle from "@/app/(root)/news/_components/FeaturedArticle";
import { fetchArticleByUuid } from "@/app/(root)/news/data";
import { deriveTagLabel, formatRelativeTime } from "@/app/(root)/news/utils";
import Link from "next/link";

const ArticlePage = async ({ params }: { params: { uuid: string } }) => {
    let article = null;
    let errorMessage: string | null = null;

    try {
        article = await fetchArticleByUuid(params.uuid);
    } catch (error) {
        console.error("[NewsArticlePage] Failed to load article", error);
        errorMessage = error instanceof Error ? error.message : String(error);
    }

    if (!article) {
        return (
            <div className="mx-auto max-w-5xl px-4 py-16">
                <div className="rounded-xl border border-red-900/60 bg-red-950/40 px-6 py-8 text-center text-red-100">
                    <h2 className="text-xl font-semibold">Unable to load this article right now.</h2>
                    <p className="mt-2 text-sm text-red-200">Please try again later.</p>
                    {errorMessage ? <p className="mt-3 text-xs text-red-300">Debug: {errorMessage}</p> : null}
                </div>
            </div>
        );
    }

    const primaryEntity = article.entities?.[0];
    const tagLabel = deriveTagLabel(primaryEntity?.industry, primaryEntity?.type, primaryEntity?.country);
    const title = article.title ?? "Untitled article";
    const source = article.source ?? "Unknown source";
    const publishedLabel = formatRelativeTime(article.published_at);

    return (
        <section className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
            <div className="flex items-center gap-3 text-sm text-gray-400">
                <Link href="/news" className="text-emerald-400 hover:text-emerald-300">
                    ← Back to news
                </Link>
                <span className="text-gray-600">•</span>
                <span className="inline-flex w-fit rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                    {tagLabel}
                </span>
                <span className="text-gray-600">•</span>
                <span>{publishedLabel}</span>
            </div>

            <div className="space-y-3">
                <p className="text-sm uppercase tracking-wide text-emerald-400">In-depth coverage</p>
                <h1 className="text-3xl font-bold text-white leading-tight">{title}</h1>
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
                    <span className="text-gray-300">{source}</span>
                </div>
            </div>

            <FeaturedArticle article={article} />

            {article.description || article.snippet ? (
                <div className="space-y-4 rounded-2xl border border-gray-800 bg-[#0f1115] p-6">
                    <p className="text-lg font-semibold text-white">Summary</p>
                    <p className="text-gray-300 leading-relaxed">{article.description || article.snippet}</p>
                </div>
            ) : null}

            {article.url ? (
                <div className="flex items-center justify-end">
                    <a
                        href={article.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-full border border-emerald-700 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:border-emerald-500 hover:text-white"
                    >
                        View original source
                    </a>
                </div>
            ) : null}
        </section>
    );
};

export default ArticlePage;
