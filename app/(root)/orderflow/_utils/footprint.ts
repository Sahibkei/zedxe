import type { NormalizedTrade } from "@/hooks/useOrderflowStream";

export type RowSizeMode = "tick" | "atr-auto";

export interface FootprintCell {
    price: number;
    buyVolume: number;
    sellVolume: number;
    totalVolume: number;
    delta: number;
}

export interface FootprintBar {
    startTime: number;
    endTime: number;
    open: number;
    high: number;
    low: number;
    close: number;
    cells: FootprintCell[];
    buyVolume: number;
    sellVolume: number;
    totalVolume: number;
    delta: number;
}

export interface BuildFootprintResult {
    bars: FootprintBar[];
    priceStepUsed: number;
    domainStart: number | null;
    domainEnd: number | null;
}

const isFiniteTrade = (trade: NormalizedTrade): boolean =>
    Number.isFinite(trade.price) && Number.isFinite(trade.quantity) && Number.isFinite(trade.timestamp);

export const inferPriceStepFromTrades = (trades: NormalizedTrade[]): number => {
    if (trades.length < 2) return 0;

    const sortedPrices = trades
        .map((trade) => trade.price)
        .filter((price) => Number.isFinite(price))
        .sort((a, b) => a - b);

    const deltas: number[] = [];
    for (let index = 1; index < sortedPrices.length; index += 1) {
        const diff = sortedPrices[index] - sortedPrices[index - 1];
        if (diff > 0) {
            deltas.push(diff);
        }
    }

    if (deltas.length === 0) return 0;

    const sorted = deltas.sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return (sorted[middle - 1] + sorted[middle]) / 2;
    }
    return sorted[middle];
};

const normalizeStep = (step: number): number | null => {
    if (!Number.isFinite(step) || step <= 0) return null;
    const exponent = Math.floor(Math.log10(step));
    const base = 10 ** exponent;
    const candidates = [1, 2, 5, 10];
    const normalized = candidates.map((candidate) => candidate * base).find((value) => value >= step) ?? step;
    return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
};

export function computeAtrPriceStep(
    bars: { high: number; low: number; close: number }[],
    atrPeriod: number,
): number | null {
    try {
        if (!Array.isArray(bars) || bars.length === 0) return null;
        const period = Math.max(1, atrPeriod);
        const recentBars = bars.slice(-period);

        let prevClose: number | null = null;
        const trueRanges: number[] = [];

        for (const bar of recentBars) {
            if (!Number.isFinite(bar.high) || !Number.isFinite(bar.low) || !Number.isFinite(bar.close)) {
                continue;
            }
            const range = bar.high - bar.low;
            const highClose = prevClose !== null ? Math.abs(bar.high - prevClose) : range;
            const lowClose = prevClose !== null ? Math.abs(bar.low - prevClose) : range;
            const trueRange = Math.max(range, highClose, lowClose);
            if (Number.isFinite(trueRange) && trueRange > 0) {
                trueRanges.push(trueRange);
            }
            prevClose = bar.close;
        }

        if (!trueRanges.length) return null;

        const atr = trueRanges.reduce((sum, value) => sum + value, 0) / trueRanges.length;
        const rawStep = atr / 12;
        const normalized = normalizeStep(rawStep ?? 0);
        return normalized && normalized > 0 ? normalized : null;
    } catch (error) {
        console.error("computeAtrPriceStep failed", error);
        return null;
    }
}

const computeFallbackPriceStep = (trades: NormalizedTrade[]): number => {
    const lastPrice = trades[trades.length - 1]?.price ?? 0;
    if (lastPrice > 0) {
        return Math.max(lastPrice * 0.0005, 0.01);
    }
    return 0.01;
};

const buildCells = (bucketTrades: NormalizedTrade[], priceStep: number): FootprintCell[] => {
    const cellsMap = new Map<number, FootprintCell>();
    const decimals = (priceStep.toString().split(".")[1] ?? "").length;

    bucketTrades.forEach((trade) => {
        const bucketedPrice = priceStep > 0 ? Math.floor(trade.price / priceStep) * priceStep : trade.price;
        const price = Number(bucketedPrice.toFixed(decimals));
        const existing = cellsMap.get(price) ?? {
            price,
            buyVolume: 0,
            sellVolume: 0,
            totalVolume: 0,
            delta: 0,
        };

        if (trade.side === "buy") {
            existing.buyVolume += trade.quantity;
        } else {
            existing.sellVolume += trade.quantity;
        }
        existing.totalVolume = existing.buyVolume + existing.sellVolume;
        existing.delta = existing.buyVolume - existing.sellVolume;
        cellsMap.set(price, existing);
    });

    return Array.from(cellsMap.values()).sort((a, b) => b.price - a.price);
};

export function buildFootprintBars(
    trades: NormalizedTrade[],
    options: {
        bucketSeconds: number;
        rowSizeMode: RowSizeMode;
        atrPeriod?: number;
    },
): BuildFootprintResult | null {
    try {
        if (!Array.isArray(trades) || trades.length === 0) {
            return null;
        }

        const validTrades = trades.filter(isFiniteTrade).sort((a, b) => a.timestamp - b.timestamp);
        if (validTrades.length === 0) {
            return null;
        }

        const bucketMs = Math.max(1, options.bucketSeconds * 1000);
        const atrPeriod = options.atrPeriod ?? 14;
        const anchor = Math.floor(validTrades[0].timestamp / bucketMs) * bucketMs;

        const buckets = new Map<number, NormalizedTrade[]>();
        validTrades.forEach((trade) => {
            const bucketIndex = Math.floor((trade.timestamp - anchor) / bucketMs);
            const bucketStart = anchor + bucketIndex * bucketMs;
            const bucketTrades = buckets.get(bucketStart) ?? [];
            bucketTrades.push(trade);
            buckets.set(bucketStart, bucketTrades);
        });

        const bucketEntries = Array.from(buckets.entries()).sort(([a], [b]) => a - b);
        const ohlcBars = bucketEntries.map(([bucketStart, bucketTrades]) => {
            const sortedBucket = bucketTrades.slice().sort((a, b) => a.timestamp - b.timestamp);
            const open = sortedBucket[0]?.price ?? 0;
            const close = sortedBucket[sortedBucket.length - 1]?.price ?? open;
            const high = Math.max(...sortedBucket.map((trade) => trade.price));
            const low = Math.min(...sortedBucket.map((trade) => trade.price));
            return { high, low, close };
        });

        let priceStep = 0;
        if (options.rowSizeMode === "atr-auto") {
            priceStep = computeAtrPriceStep(ohlcBars, atrPeriod) ?? 0;
        }
        if (priceStep <= 0) {
            priceStep = inferPriceStepFromTrades(validTrades);
        }
        if (!Number.isFinite(priceStep) || priceStep <= 0) {
            priceStep = computeFallbackPriceStep(validTrades);
        }
        const priceStepUsed = Number.isFinite(priceStep) && priceStep > 0 ? priceStep : 0.01;

        let lastClose: number | null = null;
        const bars: FootprintBar[] = bucketEntries.map(([bucketStart, bucketTrades]) => {
            const sortedBucket = bucketTrades.slice().sort((a, b) => a.timestamp - b.timestamp);
            const open = sortedBucket[0]?.price ?? lastClose ?? 0;
            const close = sortedBucket[sortedBucket.length - 1]?.price ?? open;
            const high = sortedBucket.length ? Math.max(...sortedBucket.map((trade) => trade.price)) : open;
            const low = sortedBucket.length ? Math.min(...sortedBucket.map((trade) => trade.price)) : open;
            lastClose = close;

            const cells = buildCells(sortedBucket, priceStepUsed);
            const buyVolume = cells.reduce((sum, cell) => sum + cell.buyVolume, 0);
            const sellVolume = cells.reduce((sum, cell) => sum + cell.sellVolume, 0);

            return {
                startTime: bucketStart,
                endTime: bucketStart + bucketMs,
                open,
                high,
                low,
                close,
                cells,
                buyVolume,
                sellVolume,
                totalVolume: buyVolume + sellVolume,
                delta: buyVolume - sellVolume,
            } satisfies FootprintBar;
        });

        const domainStart = bars.length ? bars[0].startTime : null;
        const domainEnd = bars.length ? bars[bars.length - 1].endTime : null;

        return {
            bars,
            priceStepUsed,
            domainStart,
            domainEnd,
        } satisfies BuildFootprintResult;
    } catch (error) {
        console.error("buildFootprintBars failed", error);
        const fallback = computeFallbackPriceStep(trades.filter(isFiniteTrade));
        return {
            bars: [],
            priceStepUsed: fallback,
            domainStart: null,
            domainEnd: null,
        } satisfies BuildFootprintResult;
    }
}

