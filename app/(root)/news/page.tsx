import FeaturedArticle from "@/app/(root)/news/_components/FeaturedArticle";
import NewsGrid from "@/app/(root)/news/_components/NewsGrid";
import Pagination from "@/app/(root)/news/_components/Pagination";
import { DEFAULT_LIMIT, fetchNews, RESULTS_CAP } from "@/app/(root)/news/data";

export const dynamic = "force-dynamic";

type NewsPageProps = {
    searchParams?: { page?: string } | Promise<{ page?: string }> | undefined;
};

const DEFAULT_PAGE = 1;

const isSearchParamsPromise = (
    value: NewsPageProps["searchParams"],
): value is Promise<{ page?: string }> =>
    typeof value === "object" && value !== null && "then" in value;

export function parsePage(value?: string): number {
    const v = typeof value === "string" ? Number(value) : NaN;
    if (!Number.isFinite(v) || v < 1) return DEFAULT_PAGE;
    return Math.floor(v);
}

const NewsPage = async ({ searchParams }: NewsPageProps) => {
    const resolvedSearchParams = isSearchParamsPromise(searchParams)
        ? await searchParams
        : (searchParams as { page?: string } | undefined);

    const currentPage = parsePage(resolvedSearchParams?.page);

    try {
        const { data = [], meta } = await fetchNews(currentPage);

        if (!data.length) {
            return (
                <main className="flex-1 flex items-center justify-center px-4 py-16">
                    <p className="text-gray-300">No news articles found.</p>
                </main>
            );
        }

        const featured = data[0];
        const headlines = data.slice(1);
        const totalPages = meta?.found
            ? Math.min(RESULTS_CAP, Math.max(1, Math.ceil(meta.found / (meta.limit || DEFAULT_LIMIT))))
            : 5;
        const safePage = Math.min(Math.max(1, meta?.page ?? currentPage), totalPages);

        return (
            <section className="max-w-6xl mx-auto px-4 py-8 space-y-10">
                <div className="space-y-3">
                    <p className="text-sm uppercase tracking-wide text-emerald-400">News</p>
                    <h1 className="text-3xl font-bold text-white">Financial News Center</h1>
                    <p className="text-gray-400">Stay on top of market-moving headlines and deep-dive analyses.</p>
                </div>

                <FeaturedArticle article={featured} currentPage={safePage} />

                {headlines.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 border-b border-gray-800 pb-2">
                            <h2 className="text-xl font-semibold text-white">Latest Headlines</h2>
                            <span className="text-xs uppercase tracking-wide text-gray-500">Updated hourly</span>
                        </div>

                        <NewsGrid articles={headlines} currentPage={safePage} />
                    </div>
                )}

                <Pagination currentPage={safePage} totalPages={totalPages} />
            </section>
        );
    } catch (err) {
        console.error("[NewsPage] Failed to load news:", err);
        return (
            <main className="flex-1 flex items-center justify-center">
                <p className="text-red-400">Unable to load news right now. Please try again later.</p>
            </main>
        );
    }
};

export default NewsPage;
