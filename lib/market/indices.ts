import { getQuotes, type MarketQuote } from '@/lib/market/providers';

export const INDICES = [
    { label: 'SPX', symbol: 'SPY', name: 'SPDR S&P 500 ETF' },
    { label: 'NDX', symbol: 'QQQ', name: 'Invesco QQQ Trust' },
    { label: 'DJI', symbol: 'DIA', name: 'SPDR Dow Jones Industrial Average ETF' },
    { label: 'RUT', symbol: 'IWM', name: 'iShares Russell 2000 ETF' },
    { label: 'VIX', symbol: 'VXX', name: 'iPath Series B S&P 500 VIX Short-Term Futures ETN' },
    { label: 'TNX', symbol: 'TLT', name: 'iShares 20+ Year Treasury Bond ETF' },
] as const;

const CACHE_TTL_MS = 30_000;
const provider = (process.env.MARKET_DATA_PROVIDER ?? 'finnhub').toLowerCase();
const getFinnhubToken = () => process.env.FINNHUB_API_KEY ?? process.env.NEXT_PUBLIC_FINNHUB_API_KEY ?? '';

let cachedQuotes: Record<string, MarketQuote | null> | null = null;
let cacheExpiresAt = 0;
let warnedMissingToken = false;

const buildEmptyQuotes = () =>
    INDICES.reduce<Record<string, MarketQuote | null>>((acc, index) => {
        acc[index.symbol] = null;
        return acc;
    }, {});

export const getIndexQuotes = async (): Promise<Record<string, MarketQuote | null>> => {
    const now = Date.now();
    if (cachedQuotes && now < cacheExpiresAt) {
        return cachedQuotes;
    }

    if (provider === 'finnhub' && !getFinnhubToken()) {
        if (!warnedMissingToken) {
            console.warn('FINNHUB API key is not configured; returning empty index quotes.');
            warnedMissingToken = true;
        }
        const emptyQuotes = buildEmptyQuotes();
        cachedQuotes = emptyQuotes;
        cacheExpiresAt = now + CACHE_TTL_MS;
        return emptyQuotes;
    }

    try {
        const symbols = INDICES.map((index) => index.symbol);
        const quotes = await getQuotes(symbols);
        const merged = buildEmptyQuotes();
        Object.entries(quotes).forEach(([symbol, quote]) => {
            merged[symbol] = quote ?? null;
        });
        cachedQuotes = merged;
        cacheExpiresAt = now + CACHE_TTL_MS;
        return merged;
    } catch (error) {
        console.error('getIndexQuotes failed:', error);
        const emptyQuotes = buildEmptyQuotes();
        cachedQuotes = emptyQuotes;
        cacheExpiresAt = now + CACHE_TTL_MS;
        return emptyQuotes;
    }
};
