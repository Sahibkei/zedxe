import SearchCommand from "@/components/SearchCommand";
import { searchStocks } from "@/lib/actions/finnhub.actions";

const SearchPage = async () => {
    const initialStocks = await searchStocks();

    return (
        <div className="relative min-h-[calc(100vh-80px)] bg-background">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.06),_transparent_45%)]" />
            <div className="absolute inset-0 bg-black/40 backdrop-blur-xl" />
            <div className="relative container py-12">
                <div className="mx-auto max-w-5xl">
                    <SearchCommand initialStocks={initialStocks} />
                </div>
            </div>
        </div>
    );
};

export default SearchPage;
