import TradingViewWidget from '@/components/TradingViewWidget';
import MarketList from '@/components/dashboard/MarketList';
import MarketOverviewCard from '@/components/dashboard/MarketOverviewCard';
import TopMovers from '@/components/dashboard/TopMovers';
import { HEATMAP_WIDGET_CONFIG } from '@/lib/constants';
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
    const HEATMAP_HEIGHT = 720;
    let quotes: Record<string, MarketQuote | null> = {};
    try {
        quotes = await getQuotes(symbols);
    } catch (error) {
        console.error('getQuotes failed:', error);
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
    const scriptUrl = 'https://s3.tradingview.com/external-embedding/embed-widget-';

    return (
        <div className="min-h-screen bg-[#010409] text-slate-100">
            <div className="mx-auto w-full max-w-[1800px] px-6 pb-12 pt-24">
                <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[460px_1fr]">
                    <section className="space-y-6">
                        <div>
                            <h1 className="mb-3 text-xl font-semibold text-slate-100">Market Overview</h1>
                            <MarketOverviewCard />
                        </div>
                        <MarketList stocks={stocks} quotes={quotes} />
                    </section>

                    <section className="flex flex-col gap-6">
                        <div className="flex items-center justify-between">
                            <h2 className="mb-3 text-xl font-semibold text-slate-100">Stock Heatmap</h2>
                            <span className="text-xs font-mono text-slate-500">S&amp;P 500</span>
                        </div>
                        <div className="relative flex min-h-[720px] flex-col rounded-2xl border border-[#1c2432] bg-[#0d1117]/70 p-4 overflow-hidden">
                            <div className="tv-embed h-[720px] w-full overflow-hidden" style={{ height: HEATMAP_HEIGHT }}>
                                <TradingViewWidget
                                    scripUrl={`${scriptUrl}stock-heatmap.js`}
                                    config={{ ...HEATMAP_WIDGET_CONFIG, height: HEATMAP_HEIGHT }}
                                    className="h-full w-full"
                                    height={HEATMAP_HEIGHT}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            <TopMovers title="Top Gainers" movers={topGainers} />
                            <TopMovers title="Top Losers" movers={topLosers} />
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;
