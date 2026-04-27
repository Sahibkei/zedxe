import { fetchJsonWithTimeout } from '@/lib/http/fetchWithTimeout';

import { getCandles as getFinnhubCandles, getQuote as getFinnhubQuote, getQuotes as getFinnhubQuotes, type FinnhubQuote } from './finnhub';

export type MarketQuote = FinnhubQuote;

export type MarketCandlePoint = {
    t: number;
    v: number;
};

export type MarketCandleSeries = {
    points: MarketCandlePoint[];
};

export type MarketDailyHistoryPoint = {
    date: string;
    close: number;
};

type YahooChartResponse = {
    chart?: {
        result?: Array<{
            timestamp?: number[];
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

const provider = (process.env.MARKET_DATA_PROVIDER ?? 'finnhub').toLowerCase();
const YAHOO_CHART_BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const getAlpacaQuote = async () => {
    return null;
};

const getAlpacaQuotes = async () => {
    return {} as Record<string, MarketQuote | null>;
};

const getAlpacaCandles = async () => {
    return null;
};

export const getQuote = async (symbol: string): Promise<MarketQuote | null> => {
    if (provider === 'alpaca') {
        return getAlpacaQuote();
    }
    return getFinnhubQuote(symbol);
};

export const getQuotes = async (symbols: string[]): Promise<Record<string, MarketQuote | null>> => {
    if (provider === 'alpaca') {
        return getAlpacaQuotes();
    }
    return getFinnhubQuotes(symbols);
};

export const getCandles = async (params: { symbol: string; resolution: string; from: number; to: number }) => {
    if (provider === 'alpaca') {
        return getAlpacaCandles();
    }
    return getFinnhubCandles(params);
};

const toUnixSeconds = (value: string | Date) => {
    const date = value instanceof Date ? value : new Date(value);
    return Math.floor(date.getTime() / 1000);
};

const toDateString = (unixSeconds: number) => new Date(unixSeconds * 1000).toISOString().slice(0, 10);

const fetchYahooDailyHistory = async (symbol: string, from: number, to: number): Promise<MarketDailyHistoryPoint[]> => {
    const period2 = to + 24 * 60 * 60;
    const url =
        `${YAHOO_CHART_BASE_URL}/${encodeURIComponent(symbol)}` +
        `?period1=${from}&period2=${period2}&interval=1d&includePrePost=false&events=div%2Csplits`;

    const result = await fetchJsonWithTimeout<YahooChartResponse>(
        url,
        {
            cache: 'force-cache',
            next: { revalidate: 300 },
            headers: {
                Accept: 'application/json',
                'User-Agent': 'Mozilla/5.0',
            },
        },
        { timeoutMs: 9000, retries: 1, backoffBaseMs: 250 }
    );

    if (!result.ok || result.data.chart?.error) {
        return [];
    }

    const timestamps = result.data.chart?.result?.[0]?.timestamp ?? [];
    const closes = result.data.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
    const pointsCount = Math.min(timestamps.length, closes.length);
    const dailyMap = new Map<string, number>();

    for (let i = 0; i < pointsCount; i += 1) {
        const timestamp = timestamps[i];
        const close = closes[i];
        if (!isFiniteNumber(timestamp) || !isFiniteNumber(close) || close <= 0) {
            continue;
        }
        dailyMap.set(toDateString(timestamp), close);
    }

    return Array.from(dailyMap.entries())
        .map(([date, close]) => ({ date, close }))
        .sort((a, b) => a.date.localeCompare(b.date));
};

export const getDailyHistory = async (params: {
    symbol: string;
    from: string | Date;
    to: string | Date;
}): Promise<MarketDailyHistoryPoint[]> => {
    const from = toUnixSeconds(params.from);
    const to = toUnixSeconds(params.to);

    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
        return [];
    }

    const candles = await getCandles({
        symbol: params.symbol,
        resolution: 'D',
        from,
        to,
    });

    if (!candles || candles.s !== 'ok' || !Array.isArray(candles.c) || !Array.isArray(candles.t)) {
        return fetchYahooDailyHistory(params.symbol, from, to);
    }

    const dailyMap = new Map<string, number>();
    const pointsCount = Math.min(candles.c.length, candles.t.length);
    for (let i = 0; i < pointsCount; i += 1) {
        const close = candles.c[i];
        const timestamp = candles.t[i];
        if (typeof close !== 'number' || !Number.isFinite(close) || typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
            continue;
        }
        dailyMap.set(toDateString(timestamp), close);
    }

    const finnhubHistory = Array.from(dailyMap.entries())
        .map(([date, close]) => ({ date, close }))
        .sort((a, b) => a.date.localeCompare(b.date));

    if (finnhubHistory.length > 0) {
        return finnhubHistory;
    }

    return fetchYahooDailyHistory(params.symbol, from, to);
};
