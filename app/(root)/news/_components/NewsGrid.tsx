import type { MarketauxArticle } from "@/types/marketaux";
import NewsCard from "@/app/(root)/news/_components/NewsCard";

const NewsGrid = ({ articles }: { articles: MarketauxArticle[] }) => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {articles.map((article) => (
            <NewsCard key={article.uuid} article={article} />
        ))}
    </div>
);

export default NewsGrid;
