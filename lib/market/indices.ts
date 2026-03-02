import { getQuotes, type MarketQuote } from '@/lib/market/providers';
import { GLOBAL_MARKET_INDEXES } from '@/lib/market/global-indices';
import { fetchJsonWithTimeout } from '@/lib/http/fetchWithTimeout';

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

type YahooChartResponse = {
    chart?: {
        result?: Array<{
            meta?: {
                regularMarketPrice?: number;
                chartPreviousClose?: number;
                previousClose?: number;
            };
            indicators?: {
                quote?: Array<{
                    close?: Array<number | null>;
                }>;
            };
        }>;
        error?: {
            code?: string;
            description?: string;
        };
    };
};

const toFinite = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

const getLastFinite = (values: Array<number | null> | undefined) => {
    if (!Array.isArray(values)) return null;
    for (let index = values.length - 1; index >= 0; index -= 1) {
        const value = values[index];
        if (typeof value === 'number' && Number.isFinite(value)) return value;
    }
    return null;
};

const fetchYahooIndexQuote = async (symbol: string): Promise<MarketQuote | null> => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=5d&interval=1d`;
    const result = await fetchJsonWithTimeout<YahooChartResponse>(
        url,
        {
            cache: 'no-store',
            headers: {
                Accept: 'application/json',
                'User-Agent': 'Mozilla/5.0',
            },
        },
        { timeoutMs: 8000, retries: 1, backoffBaseMs: 250 }
    );

    if (!result.ok) return null;

    const payload = result.data;
    if (payload.chart?.error) return null;

    const node = payload.chart?.result?.[0];
    const meta = node?.meta;
    const lastClose = getLastFinite(node?.indicators?.quote?.[0]?.close);
    const marketPrice = toFinite(meta?.regularMarketPrice);
    const price = lastClose ?? marketPrice;
    const previousClose = toFinite(meta?.chartPreviousClose) ?? toFinite(meta?.previousClose);

    if (price === null || previousClose === null || previousClose === 0) return null;

    const change = price - previousClose;
    const changePercent = (change / previousClose) * 100;

    return {
        c: price,
        d: change,
        dp: changePercent,
    };
};

const fetchYahooIndexQuotes = async (symbols: string[]) => {
    const merged = buildEmptyQuotes();
    const settled = await Promise.allSettled(symbols.map((symbol) => fetchYahooIndexQuote(symbol)));

    settled.forEach((result, index) => {
        const symbol = symbols[index];
        if (result.status === 'fulfilled') {
            merged[symbol] = result.value;
        }
    });

    return merged;
};

export const getIndexQuotes = async (): Promise<Record<string, MarketQuote | null>> => {
    const now = Date.now();
    if (cachedQuotes && now < cacheExpiresAt) {
        return cachedQuotes;
    }

    const symbols = INDICES.map((index) => index.symbol);

    if (symbols.some((symbol) => symbol.startsWith('^'))) {
        try {
            const yahooQuotes = await fetchYahooIndexQuotes(symbols);
            cachedQuotes = yahooQuotes;
            cacheExpiresAt = now + CACHE_TTL_MS;
            return yahooQuotes;
        } catch (error) {
            console.error('Yahoo index quote fetch failed:', error);
        }
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
