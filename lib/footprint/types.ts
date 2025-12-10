export type FootprintTimeframe =
    | '5s'
    | '15s'
    | '30s'
    | '1m'
    | '3m'
    | '5m'
    | '15m'
    | '30m'
    | '1h'
    | '4h'
    | '1d';

export interface RawTrade {
    symbol: string; // e.g. "BTCUSDT"
    price: number; // trade price
    quantity: number; // trade size (base units)
    side: 'buy' | 'sell'; // aggressor side (buy = lifted ask, sell = hit bid)
    ts: number; // trade timestamp in ms since epoch
}

export interface FootprintCell {
    price: number; // price level (after rounding to priceStep if provided)
    bidVolume: number; // total volume traded while hitting the bid at this price
    askVolume: number; // total volume traded while lifting the ask at this price
    tradesCount: number; // number of trades that occurred at this price level
}

export interface FootprintBar {
    symbol: string;
    timeframe: FootprintTimeframe;

    startTime: number; // start of the bar (ms since epoch)
    endTime: number; // end of the bar (exclusive, ms since epoch)

    open: number;
    high: number;
    low: number;
    close: number;

    cells: FootprintCell[]; // sorted by price ascending

    totalBidVolume: number;
    totalAskVolume: number;
    delta: number; // totalAskVolume - totalBidVolume
}

export interface AggregateFootprintOptions {
    timeframe: FootprintTimeframe;
    /**
     * Optional price step for bucketing prices.
     * Example: 1.0 means group all prices into 1-point buckets,
     * 0.5 means 0.5-point buckets.
     * If omitted, each distinct raw trade price becomes its own bucket.
     */
    priceStep?: number;
}
