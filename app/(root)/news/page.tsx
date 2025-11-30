import FeaturedArticle from "@/app/(root)/news/_components/FeaturedArticle";
import NewsGrid from "@/app/(root)/news/_components/NewsGrid";
import Pagination from "@/app/(root)/news/_components/Pagination";
import { fetchNews, RESULTS_CAP } from "@/app/(root)/news/data";
import type { MarketauxResponse } from "@/types/marketaux";

const parsePage = (pageParam?: string): number => {
    const parsed = Number(pageParam ?? "1");
    if (Number.isNaN(parsed) || parsed < 1) return 1;
    return Math.floor(parsed);
};

const buildTotalPages = (found: number, limit: number): number => {
    if (!limit || limit <= 0) return 1;
    return Math.min(RESULTS_CAP, Math.max(1, Math.ceil(found / limit)));
};

const NewsPage = async ({ searchParams }: { searchParams?: { page?: string } }) => {
    const currentPage = parsePage(searchParams?.page);

    let newsResponse: MarketauxResponse | null = null;

    try {
        newsResponse = await fetchNews(currentPage);
    } catch (error) {
        console.error("[NewsPage] Failed to load MarketAux news", error);

        const debugMessage = error instanceof Error ? error.message : String(error);
        const showDebug = process.env.NODE_ENV === "development";

        return (
            <div className="mx-auto max-w-5xl py-16">
                <div className="rounded-xl border border-red-900/60 bg-red-950/40 px-6 py-8 text-center text-red-100">
                    <h2 className="text-xl font-semibold">Unable to load news right now.</h2>
                    <p className="mt-2 text-sm text-red-200">Please try again later.</p>
                    {showDebug && (
                        <p className="mt-3 text-xs text-red-300">{debugMessage}</p>
                    )}
                </div>
            </div>
        );
    }

    if (!newsResponse || newsResponse.data.length === 0) {
        return (
            <div className="mx-auto max-w-5xl py-16">
                <div className="rounded-xl border border-gray-800 bg-[#0f1115] px-6 py-10 text-center text-gray-300">
                    <h2 className="text-xl font-semibold">No news articles found for your filters.</h2>
                </div>
            </div>
        );
    }

    const { data, meta } = newsResponse;
    const featured = data[0];
    const headlines = data.slice(1);
    const totalPages = buildTotalPages(meta.found, meta.limit);
    const paginationPage = Math.min(Math.max(1, currentPage), totalPages);

    return (
        <section className="max-w-6xl mx-auto px-4 py-8 space-y-10">
            <div className="space-y-3">
                <p className="text-sm uppercase tracking-wide text-emerald-400">News</p>
                <h1 className="text-3xl font-bold text-white">Financial News Center</h1>
                <p className="text-gray-400">Stay on top of market-moving headlines and deep-dive analyses.</p>
            </div>

            <FeaturedArticle article={featured} />

            {headlines.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center gap-3 border-b border-gray-800 pb-2">
                        <h2 className="text-xl font-semibold text-white">Latest Headlines</h2>
                        <span className="text-xs uppercase tracking-wide text-gray-500">Updated hourly</span>
                    </div>

                    <NewsGrid articles={headlines} />
                </div>
            )}

            <Pagination currentPage={paginationPage} totalPages={totalPages} />
        </section>
    );
};

export default NewsPage;
