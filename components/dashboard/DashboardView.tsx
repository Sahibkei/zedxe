import DashboardLiveClient from '@/components/dashboard/DashboardLiveClient';
import { searchStocks } from '@/lib/actions/finnhub.actions';
import { getUsTopMovers, type MarketMover } from '@/lib/market/movers';
import { getIndexQuotes } from '@/lib/market/indices';
import { getQuotes, type MarketQuote } from '@/lib/market/providers';

const DashboardView = async () => {
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
    let quotes: Record<string, MarketQuote | null> = {};
    try {
        quotes = await getQuotes(symbols);
    } catch (error) {
        console.error('getQuotes failed:', error);
    }

    let indexQuotes: Record<string, MarketQuote | null> = {};
    try {
        indexQuotes = await getIndexQuotes();
    } catch (error) {
        console.error('getIndexQuotes failed:', error);
    }

    let initialGainers: MarketMover[] = [];
    let initialLosers: MarketMover[] = [];
    try {
        const movers = await getUsTopMovers({ count: 50 });
        initialGainers = movers.gainers;
        initialLosers = movers.losers;
    } catch (error) {
        console.error('getUsTopMovers failed:', error);
    }

    return (
        <DashboardLiveClient
            stocks={stocks}
            initialQuotes={quotes}
            initialIndexQuotes={indexQuotes}
            initialGainers={initialGainers}
            initialLosers={initialLosers}
        />
    );
};

export default DashboardView;
