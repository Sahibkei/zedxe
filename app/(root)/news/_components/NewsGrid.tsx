import type { MarketauxArticle } from "@/types/marketaux";
import NewsCard from "@/app/(root)/news/_components/NewsCard";

const NewsGrid = ({ articles, currentPage }: { articles: MarketauxArticle[]; currentPage: number }) => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {articles.map((article, index) => (
            <NewsCard
                key={article.uuid ?? `${article.title ?? "article"}-${index}`}
                article={article}
                currentPage={currentPage}
            />
        ))}
    </div>
);

export default NewsGrid;
