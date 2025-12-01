import FeaturedArticle from "@/app/(root)/news/_components/FeaturedArticle";
import NewsGrid from "@/app/(root)/news/_components/NewsGrid";
import Pagination from "@/app/(root)/news/_components/Pagination";
import { DEFAULT_LIMIT, fetchNews, RESULTS_CAP } from "@/app/(root)/news/data";
import type { MarketauxArticle, MarketauxMeta } from "@/types/marketaux";

export const dynamic = "force-dynamic";

const parsePage = (pageParam?: string): number => {
    const parsed = Number(pageParam ?? "1");
    if (Number.isNaN(parsed) || parsed < 1) return 1;
    return Math.floor(parsed);
};

const buildTotalPages = (found?: number, limit?: number, fallbackPage = 1): number => {
    const safeLimit = limit && limit > 0 ? limit : DEFAULT_LIMIT;
    const computed = typeof found === "number" && found > 0 ? Math.ceil(found / safeLimit) : undefined;
    const total = computed ?? Math.max(1, fallbackPage);

    return Math.min(RESULTS_CAP, Math.max(1, total));
};

const NewsPage = async ({ searchParams }: { searchParams?: { page?: string } }) => {
    const currentPage = parsePage(searchParams?.page);

    let data: MarketauxArticle[] = [];
    let meta: MarketauxMeta | undefined;

    try {
        const newsResponse = await fetchNews(currentPage);
        data = newsResponse.data ?? [];
        meta = newsResponse.meta;
    } catch (error) {
        console.error("[NewsPage] Failed to load MarketAux news", error);

        const debugMessage = error instanceof Error ? error.message : String(error);
        const showDebug = process.env.NODE_ENV !== "production";

        return (
            <div className="mx-auto max-w-5xl py-16">
                <div className="rounded-xl border border-red-900/60 bg-red-950/40 px-6 py-8 text-center text-red-100">
                    <h2 className="text-xl font-semibold">Unable to load news right now.</h2>
                    <p className="mt-2 text-sm text-red-200">Please try again later.</p>
                    {showDebug ? <p className="mt-3 text-xs text-red-300">Debug: {debugMessage}</p> : null}
                </div>
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="mx-auto max-w-5xl py-16">
                <div className="rounded-xl border border-gray-800 bg-[#0f1115] px-6 py-10 text-center text-gray-300">
                    <h2 className="text-xl font-semibold">No news articles found for your filters.</h2>
                </div>
            </div>
        );
    }

    const resolvedMeta: MarketauxMeta = meta ?? {
        found: data.length,
        returned: data.length,
        limit: DEFAULT_LIMIT,
        page: currentPage,
    };

    const featured = data[0];
    const headlines = data.slice(1);
    const totalPages = buildTotalPages(resolvedMeta.found, resolvedMeta.limit, currentPage);
    const paginationPage = Math.min(Math.max(1, currentPage), totalPages || 1);

    return (
        <section className="max-w-6xl mx-auto px-4 py-8 space-y-10">
            <div className="space-y-3">
                <p className="text-sm uppercase tracking-wide text-emerald-400">News</p>
                <h1 className="text-3xl font-bold text-white">Financial News Center</h1>
                <p className="text-gray-400">Stay on top of market-moving headlines and deep-dive analyses.</p>
            </div>

            <FeaturedArticle article={featured} currentPage={paginationPage} />

            {headlines.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center gap-3 border-b border-gray-800 pb-2">
                        <h2 className="text-xl font-semibold text-white">Latest Headlines</h2>
                        <span className="text-xs uppercase tracking-wide text-gray-500">Updated hourly</span>
                    </div>

                    <NewsGrid articles={headlines} currentPage={paginationPage} />
                </div>
            )}

            <Pagination currentPage={paginationPage} totalPages={totalPages} />
        </section>
    );
};

export default NewsPage;
