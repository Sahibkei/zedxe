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

const provider = (process.env.MARKET_DATA_PROVIDER ?? 'finnhub').toLowerCase();

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
        return [];
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

    return Array.from(dailyMap.entries())
        .map(([date, close]) => ({ date, close }))
        .sort((a, b) => a.date.localeCompare(b.date));
};
