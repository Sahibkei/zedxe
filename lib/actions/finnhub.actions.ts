'use server';

import { formatPrice, getDateRange, validateArticle, formatArticle } from '@/lib/utils';
import { POPULAR_STOCK_SYMBOLS } from '@/lib/constants';
import { cache } from 'react';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';
const NEXT_PUBLIC_FINNHUB_API_KEY = process.env.NEXT_PUBLIC_FINNHUB_API_KEY ?? '';

async function fetchJSON<T>(url: string, revalidateSeconds?: number): Promise<T> {
    const options: RequestInit & { next?: { revalidate?: number } } = revalidateSeconds
        ? { cache: 'force-cache', next: { revalidate: revalidateSeconds } }
        : { cache: 'no-store' };

    const res = await fetch(url, options);
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Fetch failed ${res.status}: ${text}`);
    }
    return (await res.json()) as T;
}

export { fetchJSON };

export async function getNews(symbols?: string[]): Promise<MarketNewsArticle[]> {
    try {
        const range = getDateRange(5);
        const token = process.env.FINNHUB_API_KEY ?? NEXT_PUBLIC_FINNHUB_API_KEY;
        if (!token) {
            throw new Error('FINNHUB API key is not configured');
        }
        const cleanSymbols = (symbols || [])
            .map((s) => s?.trim().toUpperCase())
            .filter((s): s is string => Boolean(s));

        const maxArticles = 6;

        // If we have symbols, try to fetch company news per symbol and round-robin select
        if (cleanSymbols.length > 0) {
            const perSymbolArticles: Record<string, RawNewsArticle[]> = {};

            await Promise.all(
                cleanSymbols.map(async (sym) => {
                    try {
                        const url = `${FINNHUB_BASE_URL}/company-news?symbol=${encodeURIComponent(sym)}&from=${range.from}&to=${range.to}&token=${token}`;
                        const articles = await fetchJSON<RawNewsArticle[]>(url, 300);
                        perSymbolArticles[sym] = (articles || []).filter(validateArticle);
                    } catch (e) {
                        console.error('Error fetching company news for', sym, e);
                        perSymbolArticles[sym] = [];
                    }
                })
            );

            const collected: MarketNewsArticle[] = [];
            // Round-robin up to 6 picks
            for (let round = 0; round < maxArticles; round++) {
                for (let i = 0; i < cleanSymbols.length; i++) {
                    const sym = cleanSymbols[i];
                    const list = perSymbolArticles[sym] || [];
                    if (list.length === 0) continue;
                    const article = list.shift();
                    if (!article || !validateArticle(article)) continue;
                    collected.push(formatArticle(article, true, sym, round));
                    if (collected.length >= maxArticles) break;
                }
                if (collected.length >= maxArticles) break;
            }

            if (collected.length > 0) {
                // Sort by datetime desc
                collected.sort((a, b) => (b.datetime || 0) - (a.datetime || 0));
                return collected.slice(0, maxArticles);
            }
            // If none collected, fall through to general news
        }

        // General market news fallback or when no symbols provided
        const generalUrl = `${FINNHUB_BASE_URL}/news?category=general&token=${token}`;
        const general = await fetchJSON<RawNewsArticle[]>(generalUrl, 300);

        const seen = new Set<string>();
        const unique: RawNewsArticle[] = [];
        for (const art of general || []) {
            if (!validateArticle(art)) continue;
            const key = `${art.id}-${art.url}-${art.headline}`;
            if (seen.has(key)) continue;
            seen.add(key);
            unique.push(art);
            if (unique.length >= 20) break; // cap early before final slicing
        }

        const formatted = unique.slice(0, maxArticles).map((a, idx) => formatArticle(a, false, undefined, idx));
        return formatted;
    } catch (err) {
        console.error('getNews error:', err);
        throw new Error('Failed to fetch news');
    }
}

export async function getSymbolSnapshot(symbol: string): Promise<{
    symbol: string;
    company?: string;
    currentPrice?: number;
    changePercent?: number;
    marketCap?: number;
}> {
    const token = process.env.FINNHUB_API_KEY ?? NEXT_PUBLIC_FINNHUB_API_KEY;
    if (!token) {
        throw new Error('FINNHUB API key is not configured');
    }

    const cleanSymbol = symbol.toUpperCase();
    type FinnhubProfileResponse = { name?: string; ticker?: string; exchange?: string; marketCapitalization?: number };
    type FinnhubQuoteResponse = { c?: number; dp?: number };
    const [profile, quote] = await Promise.all([
        fetchJSON<FinnhubProfileResponse>(`${FINNHUB_BASE_URL}/stock/profile2?symbol=${encodeURIComponent(cleanSymbol)}&token=${token}`, 900),
        fetchJSON<FinnhubQuoteResponse>(`${FINNHUB_BASE_URL}/quote?symbol=${encodeURIComponent(cleanSymbol)}&token=${token}`, 60),
    ]);

    return {
        symbol: cleanSymbol,
        company: profile?.name || cleanSymbol,
        currentPrice: typeof quote?.c === 'number' ? quote.c : undefined,
        changePercent: typeof quote?.dp === 'number' ? quote.dp : undefined,
        marketCap: typeof profile?.marketCapitalization === 'number' ? profile.marketCapitalization * 1_000_000 : undefined,
    };
}

export async function getSnapshotsForSymbols(symbols: string[]): Promise<Record<string, Awaited<ReturnType<typeof getSymbolSnapshot>>>> {
    const uniqueSymbols = Array.from(new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean)));
    const entries = await Promise.all(
        uniqueSymbols.map(async (sym) => {
            try {
                const snapshot = await getSymbolSnapshot(sym);
                return [sym, snapshot] as const;
            } catch (err) {
                console.error('Error fetching snapshot for', sym, err);
                return [sym, { symbol: sym } as Awaited<ReturnType<typeof getSymbolSnapshot>>];
            }
        })
    );

    return Object.fromEntries(entries);
}

export const searchStocks = cache(async (query?: string): Promise<StockWithWatchlistStatus[]> => {
    try {
        const token = process.env.FINNHUB_API_KEY ?? NEXT_PUBLIC_FINNHUB_API_KEY;
        if (!token) {
            // If no token, log and return empty to avoid throwing per requirements
            console.error('Error in stock search:', new Error('FINNHUB API key is not configured'));
            return [];
        }

        const trimmed = typeof query === 'string' ? query.trim() : '';

        type SearchResultWithExchange = FinnhubSearchResult & { __exchange?: string };
        let results: SearchResultWithExchange[] = [];

        if (!trimmed) {
            // Fetch top 10 popular symbols' profiles
            const top = POPULAR_STOCK_SYMBOLS.slice(0, 10);
            const profiles = await Promise.all(
                top.map(async (sym) => {
                    try {
                        const url = `${FINNHUB_BASE_URL}/stock/profile2?symbol=${encodeURIComponent(sym)}&token=${token}`;
                        // Revalidate every hour
                        const profile = await fetchJSON<{ name?: string; ticker?: string; exchange?: string }>(url, 3600);
                        return { sym, profile } as { sym: string; profile: { name?: string; ticker?: string; exchange?: string } | null };
                    } catch (e) {
                        console.error('Error fetching profile2 for', sym, e);
                        return { sym, profile: null } as { sym: string; profile: { name?: string; ticker?: string; exchange?: string } | null };
                    }
                })
            );

            results = profiles
                .map(({ sym, profile }) => {
                    const symbol = sym.toUpperCase();
                    const name: string | undefined = profile?.name || profile?.ticker || undefined;
                    const exchange: string | undefined = profile?.exchange || undefined;
                    if (!name) return undefined;
                    const r: SearchResultWithExchange = {
                        symbol,
                        description: name,
                        displaySymbol: symbol,
                        type: 'Common Stock',
                    };
                    // We don't include exchange in FinnhubSearchResult type, so carry via mapping later using profile
                    // To keep pipeline simple, attach exchange via closure map stage
                    // We'll reconstruct exchange when mapping to final type
                    r.__exchange = exchange; // internal only
                    return r;
                })
                .filter((x): x is SearchResultWithExchange => Boolean(x));
        } else {
            const url = `${FINNHUB_BASE_URL}/search?q=${encodeURIComponent(trimmed)}&token=${token}`;
            const data = await fetchJSON<FinnhubSearchResponse>(url, 1800);
            results = Array.isArray(data?.result) ? data.result : [];
        }

        const mapped: StockWithWatchlistStatus[] = results
            .map((r) => {
                const upper = (r.symbol || '').toUpperCase();
                const name = r.description || upper;
                const exchangeFromDisplay = (r.displaySymbol as string | undefined) || undefined;
                const exchangeFromProfile = r.__exchange;
                const exchange = exchangeFromDisplay || exchangeFromProfile || 'US';
                const type = r.type || 'Stock';
                const item: StockWithWatchlistStatus = {
                    symbol: upper,
                    name,
                    exchange,
                    type,
                    isInWatchlist: false,
                };
                return item;
            })
            .slice(0, 15);

        return mapped;
    } catch (err) {
        console.error('Error in stock search:', err);
        return [];
    }
});

export async function getStocksDetails(symbol: string) {
    const token = process.env.FINNHUB_API_KEY ?? NEXT_PUBLIC_FINNHUB_API_KEY;
    if (!token) {
        throw new Error('FINNHUB API key is not configured');
    }

    const cleanSymbol = symbol.trim().toUpperCase();

    type FinnhubQuoteResponse = { c?: number; d?: number; dp?: number };
    type FinnhubProfileResponse = { name?: string; marketCapitalization?: number };
    type FinnhubMetricsResponse = { metric?: { peBasicExclExtraTTM?: number } };

    const [quote, profile, metrics] = await Promise.all([
        fetchJSON<FinnhubQuoteResponse>(`${FINNHUB_BASE_URL}/quote?symbol=${encodeURIComponent(cleanSymbol)}&token=${token}`, 60),
        fetchJSON<FinnhubProfileResponse>(`${FINNHUB_BASE_URL}/stock/profile2?symbol=${encodeURIComponent(cleanSymbol)}&token=${token}`, 900),
        fetchJSON<FinnhubMetricsResponse>(`${FINNHUB_BASE_URL}/stock/metric?symbol=${encodeURIComponent(cleanSymbol)}&metric=all&token=${token}`, 900),
    ]);

    const currentPrice = typeof quote?.c === 'number' ? quote.c : undefined;
    const priceFormatted = typeof currentPrice === 'number' ? formatPrice(currentPrice) : undefined;
    const changePercent = typeof quote?.dp === 'number' ? quote.dp : undefined;
    const changeValue = typeof quote?.d === 'number' ? quote.d : undefined;

    let changeFormatted: string | undefined;
    if (typeof changeValue === 'number' && typeof changePercent === 'number') {
        const sign = changeValue > 0 ? '+' : '';
        changeFormatted = `${sign}${changeValue.toFixed(2)} (${changePercent.toFixed(2)}%)`;
    } else if (typeof changePercent === 'number') {
        const sign = changePercent > 0 ? '+' : '';
        changeFormatted = `${sign}${changePercent.toFixed(2)}%`;
    }

    const marketCap =
        typeof profile?.marketCapitalization === 'number' ? profile.marketCapitalization * 1_000_000 : undefined;
    const peRatio = metrics?.metric?.peBasicExclExtraTTM;

    return {
        symbol: cleanSymbol,
        company: profile?.name || cleanSymbol,
        currentPrice,
        priceFormatted,
        changeFormatted,
        changePercent,
        marketCap,
        peRatio,
    } satisfies WatchlistEntryWithData;
}
