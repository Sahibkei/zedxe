import { getCandles as getFinnhubCandles, getQuote as getFinnhubQuote, getQuotes as getFinnhubQuotes, type FinnhubQuote } from './finnhub';

export type MarketQuote = FinnhubQuote;

export type MarketCandlePoint = {
    t: number;
    v: number;
};

export type MarketCandleSeries = {
    points: MarketCandlePoint[];
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
