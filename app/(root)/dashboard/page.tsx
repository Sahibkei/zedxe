import IndicesStrip from '@/components/dashboard/IndicesStrip';
import MarketList from '@/components/dashboard/MarketList';
import MarketOverviewCard from '@/components/dashboard/MarketOverviewCard';
import MarketNews from '@/components/dashboard/MarketNews';
import TopMovers from '@/components/dashboard/TopMovers';
import { searchStocks } from '@/lib/actions/finnhub.actions';
import { getQuotes, type MarketQuote } from '@/lib/market/providers';

const DashboardPage = async () => {
    const fallbackStocks: StockWithWatchlistStatus[] = [
        { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', type: 'Common Stock', isInWatchlist: false },
        { symbol: 'MSFT', name: 'Microsoft Corp.', exchange: 'NASDAQ', type: 'Common Stock', isInWatchlist: false },
        { symbol: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ', type: 'Common Stock', isInWatchlist: false },
        { symbol: 'AMZN', name: 'Amazon.com Inc.', exchange: 'NASDAQ', type: 'Common Stock', isInWatchlist: false },
        { symbol: 'NVDA', name: 'NVIDIA Corp.', exchange: 'NASDAQ', type: 'Common Stock', isInWatchlist: false },
        { symbol: 'META', name: 'Meta Platforms', exchange: 'NASDAQ', type: 'Common Stock', isInWatchlist: false },
        { symbol: 'TSLA', name: 'Tesla Inc.', exchange: 'NASDAQ', type: 'Common Stock', isInWatchlist: false },
        { symbol: 'JPM', name: 'JPMorgan Chase', exchange: 'NYSE', type: 'Common Stock', isInWatchlist: false },
        { symbol: 'BAC', name: 'Bank of America', exchange: 'NYSE', type: 'Common Stock', isInWatchlist: false },
        { symbol: 'WFC', name: 'Wells Fargo', exchange: 'NYSE', type: 'Common Stock', isInWatchlist: false },
        { symbol: 'XOM', name: 'Exxon Mobil', exchange: 'NYSE', type: 'Common Stock', isInWatchlist: false },
        { symbol: 'JNJ', name: 'Johnson & Johnson', exchange: 'NYSE', type: 'Common Stock', isInWatchlist: false },
    ];

    let initialStocks: StockWithWatchlistStatus[] = [];
    try {
        initialStocks = await searchStocks();
    } catch (error) {
        console.error('searchStocks failed:', error);
    }

    const stocks = initialStocks.length ? initialStocks : fallbackStocks;
    const symbols = stocks.map((stock) => stock.symbol);
    const indexSymbols = ['^GSPC', '^NDX', '^DJI', '^RUT', '^VIX', '^TNX'];
    let quotes: Record<string, MarketQuote | null> = {};
    try {
        quotes = await getQuotes(symbols);
    } catch (error) {
        console.error('getQuotes failed:', error);
    }
    let indexQuotes: Record<string, MarketQuote | null> = {};
    try {
        indexQuotes = await getQuotes(indexSymbols);
    } catch (error) {
        console.error('getQuotes for indices failed:', error);
    }

    const movers = stocks
        .map((stock) => ({ stock, quote: quotes[stock.symbol.toUpperCase()] ?? null }))
        .filter((item) => typeof item.quote?.dp === 'number')
        .sort((a, b) => (b.quote?.dp ?? 0) - (a.quote?.dp ?? 0));

    const topGainers = movers.slice(0, 5).map((item) => ({
        symbol: item.stock.symbol,
        name: item.stock.name,
        quote: item.quote,
    }));

    const topLosers = [...movers]
        .reverse()
        .slice(0, 5)
        .map((item) => ({
            symbol: item.stock.symbol,
            name: item.stock.name,
            quote: item.quote,
        }));
    return (
        <div className="min-h-screen bg-[#010409] text-slate-100">
            <div className="mx-auto w-full max-w-[1800px] px-6 pb-12 pt-24">
                <div className="space-y-6">
                    <IndicesStrip quotes={indexQuotes} />
                    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[460px_1fr]">
                        <section className="space-y-6">
                            <div>
                                <h1 className="mb-3 text-xl font-semibold text-slate-100">Market Overview</h1>
                                <MarketOverviewCard />
                            </div>
                            <MarketList stocks={stocks} quotes={quotes} />
                        </section>

                        <section className="flex flex-col gap-6">
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                <TopMovers title="Top Gainers" movers={topGainers} />
                                <TopMovers title="Top Losers" movers={topLosers} />
                            </div>
                            <MarketNews />
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;
