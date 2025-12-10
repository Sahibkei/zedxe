import { AggregateFootprintOptions, FootprintBar, FootprintCell, FootprintTimeframe, RawTrade } from './types';

export const TIMEFRAME_TO_MS: Record<FootprintTimeframe, number> = {
    '5s': 5_000,
    '15s': 15_000,
    '30s': 30_000,
    '1m': 60_000,
    '3m': 180_000,
    '5m': 300_000,
    '15m': 900_000,
    '30m': 1_800_000,
    '1h': 3_600_000,
    '4h': 14_400_000,
    '1d': 86_400_000,
};

const getBucketDecimals = (priceStep?: number): number => {
    if (!priceStep) return 0;

    const str = priceStep < 1 ? priceStep.toFixed(20).replace(/\.?0+$/, '') : priceStep.toString();
    const [, decimals = ''] = str.split('.');
    return decimals.length;
};

const bucketPrice = (price: number, priceStep?: number) => {
    if (!priceStep) return price;
    const bucket = Math.floor(price / priceStep) * priceStep;
    return Number(bucket.toFixed(getBucketDecimals(priceStep)));
};

interface MutableFootprintBar extends Omit<FootprintBar, 'cells' | 'delta'> {
    cells: Map<number, FootprintCell>;
}

const ensurePriceStep = (priceStep?: number) => {
    if (priceStep === undefined) return;
    if (priceStep <= 0) {
        throw new Error('priceStep must be greater than 0');
    }
};

export const aggregateFootprintBars = (
    trades: RawTrade[],
    options: AggregateFootprintOptions
): FootprintBar[] => {
    const { timeframe, priceStep } = options;
    const timeframeMs = TIMEFRAME_TO_MS[timeframe];

    if (!timeframeMs) {
        throw new Error(`Unsupported timeframe: ${timeframe}`);
    }

    ensurePriceStep(priceStep);

    if (!trades.length) return [];

    const sortedTrades = [...trades].sort((a, b) => (a.ts === b.ts ? a.price - b.price : a.ts - b.ts));
    const barsByKey = new Map<string, MutableFootprintBar>();

    for (const trade of sortedTrades) {
        const startTime = Math.floor(trade.ts / timeframeMs) * timeframeMs;
        const key = `${trade.symbol}-${startTime}`;
        const bucketedPrice = bucketPrice(trade.price, priceStep);

        let bar = barsByKey.get(key);
        if (!bar) {
            bar = {
                symbol: trade.symbol,
                timeframe,
                startTime,
                endTime: startTime + timeframeMs,
                open: trade.price,
                high: trade.price,
                low: trade.price,
                close: trade.price,
                cells: new Map(),
                totalBidVolume: 0,
                totalAskVolume: 0,
            };
            barsByKey.set(key, bar);
        } else {
            bar.close = trade.price;
            bar.high = Math.max(bar.high, trade.price);
            bar.low = Math.min(bar.low, trade.price);
        }

        const existingCell = bar.cells.get(bucketedPrice);
        const cell: FootprintCell = existingCell ?? {
            price: bucketedPrice,
            bidVolume: 0,
            askVolume: 0,
            tradesCount: 0,
        };

        if (trade.side === 'buy') {
            cell.askVolume += trade.quantity;
            bar.totalAskVolume += trade.quantity;
        } else {
            cell.bidVolume += trade.quantity;
            bar.totalBidVolume += trade.quantity;
        }

        cell.tradesCount += 1;
        bar.cells.set(bucketedPrice, cell);
    }

    const bars: FootprintBar[] = Array.from(barsByKey.values())
        .map((bar) => ({
            ...bar,
            cells: Array.from(bar.cells.values()).sort((a, b) => a.price - b.price),
            delta: bar.totalAskVolume - bar.totalBidVolume,
        }))
        .sort((a, b) =>
            a.symbol === b.symbol ? a.startTime - b.startTime : a.symbol.localeCompare(b.symbol)
        );

    return bars;
};
