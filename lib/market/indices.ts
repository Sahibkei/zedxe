import { getQuotes, type MarketQuote } from '@/lib/market/providers';
import { GLOBAL_MARKET_INDEXES } from '@/lib/market/global-indices';

export const INDICES = GLOBAL_MARKET_INDEXES.map((index) => ({
    label: index.ticker,
    displayName: index.label,
    symbol: index.symbol,
    name: index.name,
    region: index.region,
}));

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

    const symbols = INDICES.map((index) => index.symbol);

    if (symbols.some((symbol) => symbol.startsWith('^'))) {
        const emptyQuotes = buildEmptyQuotes();
        cachedQuotes = emptyQuotes;
        cacheExpiresAt = now + CACHE_TTL_MS;
        return emptyQuotes;
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
