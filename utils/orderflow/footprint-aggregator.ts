export type AggTradeMessage = {
    p: string; // price
    q: string; // quantity
    T: number; // trade time ms
    m: boolean; // is buyer the market maker
};

export type PriceLevel = { bid: number; ask: number };

export type CandleFootprint = {
    tSec: number;
    buyTotal: number;
    sellTotal: number;
    levels: Map<number, PriceLevel>;
};

const DEFAULT_SYMBOL_FALLBACK_STEP: Record<string, number> = {
    BTCUSDT: 0.1,
};

export const CANDLE_INTERVAL_MS: Record<"1m" | "5m" | "15m", number> = {
    "1m": 60_000,
    "5m": 300_000,
    "15m": 900_000,
};

const EXCHANGE_INFO_ENDPOINTS = [
    "https://api.binance.com/api/v3/exchangeInfo",
    "https://data-api.binance.vision/api/v3/exchangeInfo",
];

export const fetchWithTimeout = async (url: string, { timeoutMs }: { timeoutMs: number }) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { signal: controller.signal });
        return response;
    } finally {
        clearTimeout(timer);
    }
};

export const decimalsFromStep = (step: number): number => {
    if (!Number.isFinite(step) || step <= 0) return 0;
    const asString = step.toString();
    if (asString.includes("e")) {
        const [, exponent] = asString.split("e-");
        const decimals = Number(exponent);
        return Number.isFinite(decimals) ? decimals : 0;
    }
    const dotIndex = asString.indexOf(".");
    return dotIndex === -1 ? 0 : asString.length - dotIndex - 1;
};

export const floorToPriceStep = (price: number, step: number): number => {
    if (!Number.isFinite(price) || !Number.isFinite(step) || step <= 0) return price;
    const decimals = decimalsFromStep(step);
    const bucket = Math.floor(price / step) * step;
    return Number(bucket.toFixed(decimals));
};

export const getCandleOpenSec = (tradeTimeMs: number, intervalMs: number): number => {
    const openMs = Math.floor(tradeTimeMs / intervalMs) * intervalMs;
    return Math.floor(openMs / 1000);
};

export const getPriceStep = async (symbol: string, { timeoutMs = 5000 }: { timeoutMs?: number } = {}) => {
    const upperSymbol = symbol.toUpperCase();
    for (const baseUrl of EXCHANGE_INFO_ENDPOINTS) {
        try {
            const url = `${baseUrl}?symbol=${upperSymbol}`;
            const response = await fetchWithTimeout(url, { timeoutMs });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const json = await response.json();
            const symbolInfo = Array.isArray(json?.symbols)
                ? json.symbols.find((item: { symbol?: string }) => item.symbol === upperSymbol)
                : json?.symbols?.find((item: { symbol?: string }) => item.symbol === upperSymbol);
            const priceFilter = symbolInfo?.filters?.find((filter: { filterType?: string }) => filter.filterType === "PRICE_FILTER");
            const tickSize = Number(priceFilter?.tickSize);
            if (Number.isFinite(tickSize) && tickSize > 0) return tickSize;
        } catch (error) {
            // try next endpoint
        }
    }

    const fallback = DEFAULT_SYMBOL_FALLBACK_STEP[upperSymbol] ?? 0.01;
    console.warn(`Using fallback price step ${fallback} for ${upperSymbol}`);
    return fallback;
};

export const pruneOldCandles = (footprints: Map<number, CandleFootprint>, windowMs: number) => {
    const cutoffSec = Math.floor((Date.now() - windowMs) / 1000);
    for (const key of footprints.keys()) {
        if (key < cutoffSec) {
            footprints.delete(key);
        }
    }
};

export const upsertFootprintLevel = (
    footprint: CandleFootprint,
    price: number,
    side: "bid" | "ask",
    quantity: number,
    priceStep: number,
) => {
    const bucketPrice = floorToPriceStep(price, priceStep);
    const existing = footprint.levels.get(bucketPrice) ?? { bid: 0, ask: 0 };
    if (side === "bid") {
        existing.bid += quantity;
    } else {
        existing.ask += quantity;
    }
    footprint.levels.set(bucketPrice, existing);
};

export const classifyTradeSide = (makerFlag: boolean): "bid" | "ask" => {
    return makerFlag ? "bid" : "ask";
};

export const parseAggTrade = (message: AggTradeMessage) => {
    const price = Number(message.p);
    const quantity = Number(message.q);
    const time = Number(message.T);
    const makerFlag = Boolean(message.m);

    if (!Number.isFinite(price) || !Number.isFinite(quantity) || !Number.isFinite(time)) return null;

    return { price, quantity, time, side: classifyTradeSide(makerFlag) } as const;
};
