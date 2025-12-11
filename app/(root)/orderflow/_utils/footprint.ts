import type { VolumeProfileLevel } from "@/app/(root)/orderflow/_components/volume-profile";
import type { NormalizedTrade } from "@/hooks/useOrderflowStream";

export type FootprintCell = VolumeProfileLevel & {
    tradesCount?: number;
};

export type FootprintBar = {
    bucketStart: number;
    bucketEnd: number;
    open: number;
    high: number;
    low: number;
    close: number;
    totalVolume: number;
    totalDelta: number;
    cells: FootprintCell[];
};

export type RowSizeMode = "tick" | "atr-auto";

export interface BuildFootprintOptions {
    windowSeconds: number;
    bucketSizeSeconds: number;
    referenceTimestamp: number;
    rowSizeMode: RowSizeMode;
    tickSize: number;
    atrPeriod: number;
}

export interface BuildFootprintResult {
    bars: FootprintBar[];
    priceStepUsed: number;
}

const bucketPrice = (price: number, priceStep?: number) => {
    if (!priceStep || priceStep <= 0) return price;
    const decimals = (priceStep.toString().split(".")[1] ?? "").length;
    const bucketed = Math.floor(price / priceStep) * priceStep;
    return Number(bucketed.toFixed(decimals));
};

const resolveFallbackStep = (tickSize: number, referencePrice: number = 0): number => {
    if (tickSize > 0) return tickSize;
    if (referencePrice > 0) return Math.max(referencePrice * 0.0005, 0.01);
    return 0.01;
};

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

export const computeAtrPriceStep = (
    bars: Pick<FootprintBar, "high" | "low" | "close">[],
    period: number,
    fallbackStep = 0,
): number => {
    if (!bars.length) {
        return Math.max(fallbackStep, 0.01);
    }

    const effectivePeriod = Math.max(1, Math.min(period, bars.length));
    const recentBars = bars.slice(-effectivePeriod);

    let prevClose = recentBars[0].close;
    const trueRanges: number[] = [];

    recentBars.forEach((bar, index) => {
        if (index > 0) {
            prevClose = recentBars[index - 1].close;
        }

        const range = bar.high - bar.low;
        const highClose = Math.abs(bar.high - prevClose);
        const lowClose = Math.abs(bar.low - prevClose);
        const trueRange = Math.max(range, highClose, lowClose);
        trueRanges.push(trueRange);
    });

    const atr = trueRanges.reduce((sum, value) => sum + value, 0) / trueRanges.length;
    const referencePrice = recentBars[recentBars.length - 1]?.close ?? 0;
    const minimumStep = fallbackStep > 0 ? fallbackStep : resolveFallbackStep(0, referencePrice);
    const step = Math.max(minimumStep, atr / 20);

    return Number.isFinite(step) && step > 0 ? step : minimumStep;
};

export const buildFootprintBars = (
    trades: NormalizedTrade[],
    { windowSeconds, bucketSizeSeconds, referenceTimestamp, rowSizeMode, tickSize, atrPeriod }: BuildFootprintOptions,
): BuildFootprintResult => {
    if (!trades.length) {
        const safeStep = resolveFallbackStep(tickSize);
        return { bars: [], priceStepUsed: safeStep };
    }

    const windowStart = referenceTimestamp - windowSeconds * 1000;
    const bucketSizeMs = bucketSizeSeconds * 1000;
    const bucketCount = Math.ceil(windowSeconds / bucketSizeSeconds);

    const buckets = new Map<number, NormalizedTrade[]>();

    trades.forEach((trade) => {
        if (trade.timestamp < windowStart) return;
        const bucketIndex = Math.floor((trade.timestamp - windowStart) / bucketSizeMs);
        if (bucketIndex < 0 || bucketIndex >= bucketCount) return;

        const bucketTrades = buckets.get(bucketIndex) ?? [];
        bucketTrades.push(trade);
        buckets.set(bucketIndex, bucketTrades);
    });

    let lastClose: number | null = null;
    const rawBars: (Pick<FootprintBar, "bucketStart" | "bucketEnd" | "open" | "high" | "low" | "close"> & {
        trades: NormalizedTrade[];
    })[] = [];

    for (let index = 0; index < bucketCount; index += 1) {
        const bucketStart = windowStart + index * bucketSizeMs;
        const bucketEnd = bucketStart + bucketSizeMs;
        const bucketTrades = buckets.get(index)?.sort((a, b) => a.timestamp - b.timestamp) ?? [];

        if (!bucketTrades.length && lastClose === null) {
            continue;
        }

        const open = bucketTrades[0]?.price ?? lastClose ?? 0;
        const close = bucketTrades[bucketTrades.length - 1]?.price ?? open;
        const high = bucketTrades.length ? Math.max(...bucketTrades.map((trade) => trade.price)) : open;
        const low = bucketTrades.length ? Math.min(...bucketTrades.map((trade) => trade.price)) : open;

        lastClose = close;

        rawBars.push({ bucketStart, bucketEnd, open, high, low, close, trades: bucketTrades });
    }

    if (!rawBars.length) {
        const lastTradePrice = trades[trades.length - 1]?.price ?? 0;
        const safeStep = resolveFallbackStep(tickSize, lastTradePrice);
        return { bars: [], priceStepUsed: safeStep };
    }

    const referencePrice = rawBars[rawBars.length - 1]?.close ?? 0;
    const inferredStep = tickSize > 0 ? tickSize : inferPriceStepFromTrades(trades);
    const fallbackStep = inferredStep > 0 ? inferredStep : resolveFallbackStep(0, referencePrice);

    const atrPriceStep = rowSizeMode === "atr-auto" ? computeAtrPriceStep(rawBars, atrPeriod, fallbackStep) : undefined;
    const resolvedPriceStep = Math.max(rowSizeMode === "tick" ? fallbackStep : atrPriceStep ?? fallbackStep, 0.01);

    const bars: FootprintBar[] = rawBars.map((bar) => {
        const cellsMap = new Map<number, FootprintCell>();

        bar.trades.forEach((trade) => {
            const cellPrice = bucketPrice(trade.price, resolvedPriceStep);
            const existing = cellsMap.get(cellPrice) ?? {
                price: cellPrice,
                buyVolume: 0,
                sellVolume: 0,
                totalVolume: 0,
                imbalancePercent: 0,
                dominantSide: null,
                tradesCount: 0,
            };

            if (trade.side === "buy") {
                existing.buyVolume += trade.quantity;
            } else {
                existing.sellVolume += trade.quantity;
            }
            existing.tradesCount = (existing.tradesCount ?? 0) + 1;
            cellsMap.set(cellPrice, existing);
        });

        const cells = Array.from(cellsMap.values())
            .map((cell) => {
                const totalVolume = cell.buyVolume + cell.sellVolume;
                const dominantSide = totalVolume === 0 ? null : cell.buyVolume >= cell.sellVolume ? "buy" : "sell";
                const imbalancePercent = totalVolume > 0 ? (Math.abs(cell.buyVolume - cell.sellVolume) / totalVolume) * 100 : 0;

                return {
                    ...cell,
                    totalVolume,
                    imbalancePercent,
                    dominantSide,
                } satisfies FootprintCell;
            })
            .sort((a, b) => b.price - a.price);

        const totalBuyVolume = cells.reduce((sum, cell) => sum + cell.buyVolume, 0);
        const totalSellVolume = cells.reduce((sum, cell) => sum + cell.sellVolume, 0);

        return {
            bucketStart: bar.bucketStart,
            bucketEnd: bar.bucketEnd,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            totalVolume: totalBuyVolume + totalSellVolume,
            totalDelta: totalBuyVolume - totalSellVolume,
            cells,
        } satisfies FootprintBar;
    });

    return { bars, priceStepUsed: resolvedPriceStep };
};

