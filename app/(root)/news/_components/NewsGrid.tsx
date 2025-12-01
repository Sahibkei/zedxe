import NewsCard from "@/app/(root)/news/_components/NewsCard";
import type { MarketauxArticle } from "@/types/marketaux";

const NewsGrid = ({ articles, originPage }: { articles: MarketauxArticle[]; originPage: number }) => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {articles.map((article) => (
            <NewsCard key={article.uuid} article={article} originPage={originPage} />
        ))}
    </div>
);

export default NewsGrid;
