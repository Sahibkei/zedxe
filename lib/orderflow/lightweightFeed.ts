import { FootprintBar } from "@/app/(root)/orderflow/_utils/footprint";

export interface FootprintCandle {
    timeMs: number;
    open: number;
    high: number;
    low: number;
    close: number;
}

export const mapFootprintBarsToCandles = (bars: FootprintBar[]): FootprintCandle[] =>
    bars.map((bar) => ({
        timeMs: bar.bucketStart,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
    }));
