import Link from "next/link";
import FeaturedArticle from "@/app/(root)/news/_components/FeaturedArticle";
import NewsGrid from "@/app/(root)/news/_components/NewsGrid";
import { fetchNews } from "@/app/(root)/news/data";

type NewsPageProps = {
    searchParams?: { page?: string };
};

function parsePage(raw?: string): number {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.floor(n);
}

const NewsPage = async ({ searchParams }: NewsPageProps) => {
    const currentPage = parsePage(searchParams?.page);
    const { articles, meta } = await fetchNews(currentPage);

    if (!articles.length) {
        return (
            <main className="flex-1 flex items-center justify-center px-4 py-16">
                <p className="text-gray-300">No news available right now.</p>
            </main>
        );
    }

    const featured = articles[0];
    const headlines = articles.slice(1);
    const totalPages = meta?.totalPages ? Math.max(1, meta.totalPages) : 1;
    const safePage = Math.min(Math.max(1, meta?.page ?? currentPage), totalPages);

    const pages = Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5);

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

            <div className="flex items-center justify-center gap-2 pt-4">
                {pages.map((page) => (
                    <Link
                        key={page}
                        href={`/news?page=${page}`}
                        className={`px-3 py-1 rounded-md border ${
                            page === safePage
                                ? "border-emerald-400 text-emerald-300"
                                : "border-gray-800 text-gray-300 hover:border-emerald-400/60 hover:text-emerald-200"
                        }`}
                    >
                        {page}
                    </Link>
                ))}
            </div>
        </section>
    );
};

export default NewsPage;
export const dynamic = "force-dynamic";
