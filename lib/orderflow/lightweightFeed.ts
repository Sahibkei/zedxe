import { VolumeProfileLevel } from "@/app/(root)/orderflow/_components/volume-profile";
import { FootprintBar } from "@/app/(root)/orderflow/_utils/footprint";
import { OrderbookLevel } from "@/hooks/useOrderbookStream";

export type FootprintCluster = {
    price: number;
    bidVolume: number;
    askVolume: number;
    totalVolume: number;
    delta: number;
};

export type FootprintCandle = {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    clusters: FootprintCluster[];
};

export type VolumeProfileDatum = {
    price: number;
    volume: number;
    buyVolume: number;
    sellVolume: number;
};

export type DomDepthLevel = {
    price: number;
    bidSize: number;
    askSize: number;
};

export const mapFootprintBarsToCandles = (bars: FootprintBar[]): FootprintCandle[] =>
    bars.map((bar) => ({
        time: bar.bucketStart,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.totalVolume,
        clusters: bar.cells.map((cell) => ({
            price: cell.price,
            bidVolume: cell.sellVolume,
            askVolume: cell.buyVolume,
            totalVolume: cell.totalVolume,
            delta: cell.buyVolume - cell.sellVolume,
        })),
    }));

export const mapVolumeProfileToHistogram = (levels: VolumeProfileLevel[]): VolumeProfileDatum[] =>
    levels.map((level) => ({
        price: level.price,
        volume: level.totalVolume,
        buyVolume: level.buyVolume,
        sellVolume: level.sellVolume,
    }));

export const combineOrderbookDepth = (
    bids: OrderbookLevel[],
    asks: OrderbookLevel[],
    maxLevels = 18,
): DomDepthLevel[] => {
    const combined: DomDepthLevel[] = [];
    const capped = Math.max(1, maxLevels);

    for (let index = 0; index < capped; index += 1) {
        const bid = bids[index];
        const ask = asks[index];

        if (bid) {
            combined.push({ price: bid.price, bidSize: bid.size, askSize: 0 });
        }
        if (ask) {
            combined.push({ price: ask.price, bidSize: 0, askSize: ask.size });
        }
    }

    return combined.sort((a, b) => b.price - a.price);
};
