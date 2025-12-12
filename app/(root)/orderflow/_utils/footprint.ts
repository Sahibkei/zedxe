import type { VolumeProfileLevel } from "@/app/(root)/orderflow/_components/volume-profile";
import type { NormalizedTrade } from "@/hooks/useOrderflowStream";

export interface TickConfig {
    tickSize: number;
    priceDecimals: number;
}

export interface FootprintCell {
    price: number;
    priceTicks: number;
    buyVolume: number;
    sellVolume: number;
    totalVolume: number;
    imbalancePercent: number;
    dominantSide: "buy" | "sell" | null;
    tradesCount: number;
}

export interface FootprintBar {
    index: number;
    bucketStart: number;
    bucketEnd: number;
    open: number;
    high: number;
    low: number;
    close: number;
    totalVolume: number;
    totalDelta: number;
    cells: FootprintCell[];
}

export interface FootprintSnapshot {
    bars: FootprintBar[];
    priceMin: number;
    priceMax: number;
    tickConfig: TickConfig;
    rowSizeTicks: number;
    bucketSizeSeconds: number;
    windowSeconds: number;
    lastPrice: number | null;
}

export interface BuildFootprintOptions {
    windowSeconds: number;
    bucketSizeSeconds: number;
    referenceTimestamp: number;
    tickSize?: number;
    priceDecimals?: number;
    atrLookback?: number;
    rowSizeTicks?: number;
}

const countDecimals = (value: number) => {
    const [, decimals = ""] = value.toString().split(".");
    return decimals.length;
};

export const priceToTicks = (price: number, cfg: TickConfig): number =>
    Math.round(price / cfg.tickSize);

export const ticksToPrice = (ticks: number, cfg: TickConfig): number =>
    Number((ticks * cfg.tickSize).toFixed(cfg.priceDecimals));

export const inferTickSizeFromTrades = (trades: NormalizedTrade[]): number => {
    if (trades.length < 2) return 0;
    const sorted = [...trades]
        .map((trade) => trade.price)
        .filter((price) => Number.isFinite(price))
        .sort((a, b) => a - b);

    const deltas: number[] = [];
    for (let index = 1; index < sorted.length; index += 1) {
        const diff = sorted[index] - sorted[index - 1];
        if (diff > 0) {
            deltas.push(diff);
        }
    }

    if (!deltas.length) return 0;
    deltas.sort((a, b) => a - b);
    const middle = Math.floor(deltas.length / 2);
    return deltas.length % 2 === 0 ? (deltas[middle - 1] + deltas[middle]) / 2 : deltas[middle];
};

const normalizeTickConfig = (tickSize: number, priceDecimals?: number): TickConfig => {
    const safeTick = tickSize > 0 ? tickSize : 0.01;
    const decimalsFromTick = countDecimals(safeTick);
    return {
        tickSize: safeTick,
        priceDecimals: priceDecimals ?? Math.max(decimalsFromTick, 2),
    };
};

const bucketTrades = (
    trades: NormalizedTrade[],
    windowStart: number,
    bucketCount: number,
    bucketSizeMs: number,
) => {
    const buckets = new Map<number, NormalizedTrade[]>();
    trades.forEach((trade) => {
        if (trade.timestamp < windowStart) return;
        const bucketIndex = Math.floor((trade.timestamp - windowStart) / bucketSizeMs);
        if (bucketIndex < 0 || bucketIndex >= bucketCount) return;
        const bucketTrades = buckets.get(bucketIndex) ?? [];
        bucketTrades.push(trade);
        buckets.set(bucketIndex, bucketTrades);
    });
    return buckets;
};

const buildCells = (trades: NormalizedTrade[], cfg: TickConfig): FootprintCell[] => {
    const cells = new Map<number, FootprintCell>();

    trades.forEach((trade) => {
        const priceTicks = priceToTicks(trade.price, cfg);
        const price = ticksToPrice(priceTicks, cfg);
        const existing = cells.get(priceTicks) ?? {
            price,
            priceTicks,
            buyVolume: 0,
            sellVolume: 0,
            totalVolume: 0,
            imbalancePercent: 0,
            dominantSide: null as FootprintCell["dominantSide"],
            tradesCount: 0,
        };

        if (trade.side === "buy") {
            existing.buyVolume += trade.quantity;
        } else {
            existing.sellVolume += trade.quantity;
        }

        existing.tradesCount += 1;
        cells.set(priceTicks, existing);
    });

    return Array.from(cells.values())
        .map((cell) => {
            const totalVolume = cell.buyVolume + cell.sellVolume;
            const dominantSide = totalVolume === 0 ? null : cell.buyVolume >= cell.sellVolume ? "buy" : "sell";
            const imbalancePercent = totalVolume > 0 ? (Math.abs(cell.buyVolume - cell.sellVolume) / totalVolume) * 100 : 0;
            return {
                ...cell,
                totalVolume,
                dominantSide,
                imbalancePercent,
            } satisfies FootprintCell;
        })
        .sort((a, b) => b.priceTicks - a.priceTicks);
};

const computeAtr = (bars: FootprintBar[], lookback = 14): number => {
    if (bars.length < 2) return 0;
    const atrValues: number[] = [];
    for (let i = 1; i < bars.length; i += 1) {
        const prevClose = bars[i - 1].close;
        const bar = bars[i];
        const highLow = bar.high - bar.low;
        const highPrevClose = Math.abs(bar.high - prevClose);
        const lowPrevClose = Math.abs(bar.low - prevClose);
        const tr = Math.max(highLow, highPrevClose, lowPrevClose);
        atrValues.push(tr);
    }

    if (!atrValues.length) return 0;
    const slice = atrValues.slice(-lookback);
    const sum = slice.reduce((acc, value) => acc + value, 0);
    return sum / slice.length;
};

export const buildFootprintSnapshot = (
    trades: NormalizedTrade[],
    {
        windowSeconds,
        bucketSizeSeconds,
        referenceTimestamp,
        tickSize,
        priceDecimals,
        atrLookback = 14,
        rowSizeTicks,
    }: BuildFootprintOptions,
): FootprintSnapshot => {
    if (!trades.length) {
        const cfg = normalizeTickConfig(tickSize ?? 0.01, priceDecimals);
        return {
            bars: [],
            priceMin: 0,
            priceMax: 0,
            tickConfig: cfg,
            rowSizeTicks: rowSizeTicks ?? 1,
            bucketSizeSeconds,
            windowSeconds,
            lastPrice: null,
        };
    }

    const sortedTrades = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    const lastPrice = sortedTrades[sortedTrades.length - 1]?.price ?? null;
    const inferredTick = tickSize ?? inferTickSizeFromTrades(sortedTrades);
    const fallbackTick = lastPrice ? Math.max(lastPrice * 0.0005, 0.01) : 0.01;
    const tickConfig = normalizeTickConfig(inferredTick > 0 ? inferredTick : fallbackTick, priceDecimals);

    const windowStart = referenceTimestamp - windowSeconds * 1000;
    const bucketSizeMs = bucketSizeSeconds * 1000;
    const bucketCount = Math.ceil(windowSeconds / bucketSizeSeconds);
    const buckets = bucketTrades(sortedTrades, windowStart, bucketCount, bucketSizeMs);

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
        const prices = bucketTrades.map((trade) => trade.price);
        const high = prices.length ? Math.max(...prices) : open;
        const low = prices.length ? Math.min(...prices) : open;

        const cells = buildCells(bucketTrades, tickConfig);
        const totalBuyVolume = cells.reduce((sum, cell) => sum + cell.buyVolume, 0);
        const totalSellVolume = cells.reduce((sum, cell) => sum + cell.sellVolume, 0);

        bars.push({
            index,
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

        lastClose = close;
    }

    if (!bars.length) {
        return {
            bars: [],
            priceMin: 0,
            priceMax: 0,
            tickConfig,
            rowSizeTicks: rowSizeTicks ?? 1,
            bucketSizeSeconds,
            windowSeconds,
            lastPrice,
        };
    }

    const priceMin = Math.min(...bars.map((bar) => bar.low));
    const priceMax = Math.max(...bars.map((bar) => bar.high));

    const atr = computeAtr(bars, atrLookback);
    const atrTicks = atr > 0 ? Math.max(1, Math.round(atr / tickConfig.tickSize)) : 0;
    const autoRow = atrTicks > 0 ? Math.max(1, Math.round(atrTicks / 2)) : Math.max(1, Math.round(1));

    return {
        bars,
        priceMin,
        priceMax,
        tickConfig,
        rowSizeTicks: rowSizeTicks ?? autoRow,
        bucketSizeSeconds,
        windowSeconds,
        lastPrice,
    };
};

export const buildVolumeProfile = (
    snapshot: FootprintSnapshot,
    centerPrice?: number,
    levelsPerSide = 8,
): { levels: VolumeProfileLevel[]; referencePrice: number | null } => {
    const { bars, tickConfig, rowSizeTicks } = snapshot;
    if (!bars.length) return { levels: [], referencePrice: centerPrice ?? null };

    const referencePrice = centerPrice ?? bars[bars.length - 1]?.close ?? null;
    if (!referencePrice) return { levels: [], referencePrice: null };

    const centerTicks = priceToTicks(referencePrice, tickConfig);
    const startTicks = centerTicks - rowSizeTicks * levelsPerSide;
    const endTicks = centerTicks + rowSizeTicks * levelsPerSide;

    const aggregation = new Map<number, { buyVolume: number; sellVolume: number }>();

    bars.forEach((bar) => {
        bar.cells.forEach((cell) => {
            if (cell.priceTicks < startTicks - rowSizeTicks || cell.priceTicks > endTicks + rowSizeTicks) return;
            const bucketed = Math.round(cell.priceTicks / rowSizeTicks) * rowSizeTicks;
            const existing = aggregation.get(bucketed) ?? { buyVolume: 0, sellVolume: 0 };
            existing.buyVolume += cell.buyVolume;
            existing.sellVolume += cell.sellVolume;
            aggregation.set(bucketed, existing);
        });
    });

    const levels: VolumeProfileLevel[] = [];
    for (let ticks = startTicks; ticks <= endTicks; ticks += rowSizeTicks) {
        const price = ticksToPrice(ticks, tickConfig);
        const volume = aggregation.get(ticks) ?? { buyVolume: 0, sellVolume: 0 };
        const totalVolume = volume.buyVolume + volume.sellVolume;
        const imbalancePercent = totalVolume > 0 ? (Math.abs(volume.buyVolume - volume.sellVolume) / totalVolume) * 100 : 0;
        const dominantSide = totalVolume === 0 ? null : volume.buyVolume >= volume.sellVolume ? "buy" : "sell";

        levels.push({
            price,
            buyVolume: volume.buyVolume,
            sellVolume: volume.sellVolume,
            totalVolume,
            imbalancePercent,
            dominantSide,
        });
    }

    return { levels, referencePrice };
};

