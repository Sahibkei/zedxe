import { cache } from 'react';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

export type FinnhubQuote = {
    c?: number;
    d?: number;
    dp?: number;
    h?: number;
    l?: number;
    o?: number;
    pc?: number;
    t?: number;
};

type FinnhubCandleResponse = {
    c?: number[];
    t?: number[];
    s: 'ok' | 'no_data';
};

const getToken = () => process.env.FINNHUB_API_KEY ?? process.env.NEXT_PUBLIC_FINNHUB_API_KEY ?? '';

const fetchJSON = async <T>(url: string, revalidateSeconds?: number): Promise<T> => {
    const options: RequestInit & { next?: { revalidate?: number } } = revalidateSeconds
        ? { cache: 'force-cache', next: { revalidate: revalidateSeconds } }
        : { cache: 'no-store' };

    const res = await fetch(url, options);
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Fetch failed ${res.status}: ${text}`);
    }
    return (await res.json()) as T;
};

export const getQuote = cache(async (symbol: string): Promise<FinnhubQuote | null> => {
    const token = getToken();
    if (!token) {
        console.error('FINNHUB API key is not configured');
        return null;
    }

    const cleanSymbol = symbol.trim().toUpperCase();
    if (!cleanSymbol) return null;

    const url = `${FINNHUB_BASE_URL}/quote?symbol=${encodeURIComponent(cleanSymbol)}&token=${token}`;
    try {
        return await fetchJSON<FinnhubQuote>(url, 15);
    } catch (error) {
        console.error('Error fetching Finnhub quote for', cleanSymbol, error);
        return null;
    }
});

export const getQuotes = async (symbols: string[]): Promise<Record<string, FinnhubQuote | null>> => {
    const entries = await Promise.all(
        symbols.map(async (symbol) => {
            const quote = await getQuote(symbol);
            return [symbol.toUpperCase(), quote] as const;
        })
    );

    return Object.fromEntries(entries);
};

export const getCandles = cache(
    async ({ symbol, resolution, from, to }: { symbol: string; resolution: string; from: number; to: number }) => {
        const token = getToken();
        if (!token) {
            console.error('FINNHUB API key is not configured');
            return null;
        }

        const cleanSymbol = symbol.trim().toUpperCase();
        if (!cleanSymbol) return null;

        const url = `${FINNHUB_BASE_URL}/stock/candle?symbol=${encodeURIComponent(cleanSymbol)}&resolution=${resolution}&from=${from}&to=${to}&token=${token}`;
        try {
            return await fetchJSON<FinnhubCandleResponse>(url, 300);
        } catch (error) {
            console.error('Error fetching Finnhub candles for', cleanSymbol, error);
            return null;
        }
    }
);
