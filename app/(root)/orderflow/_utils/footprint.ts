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

export interface BuildFootprintOptions {
    windowSeconds: number;
    bucketSizeSeconds: number;
    referenceTimestamp: number;
    priceStep?: number;
}

const bucketPrice = (price: number, priceStep?: number) => {
    if (!priceStep || priceStep <= 0) return price;
    const decimals = (priceStep.toString().split(".")[1] ?? "").length;
    const bucketed = Math.floor(price / priceStep) * priceStep;
    return Number(bucketed.toFixed(decimals));
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

export const buildFootprintBars = (
    trades: NormalizedTrade[],
    { windowSeconds, bucketSizeSeconds, referenceTimestamp, priceStep }: BuildFootprintOptions,
): FootprintBar[] => {
    if (!trades.length) return [];

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
    const bars: FootprintBar[] = [];

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

        const cellsMap = new Map<number, FootprintCell>();

        bucketTrades.forEach((trade) => {
            const cellPrice = bucketPrice(trade.price, priceStep);
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

        bars.push({
            bucketStart,
            bucketEnd,
            open,
            high,
            low,
            close,
            totalVolume: totalBuyVolume + totalSellVolume,
            totalDelta: totalBuyVolume - totalSellVolume,
            cells,
        });
    }

    return bars;
};

