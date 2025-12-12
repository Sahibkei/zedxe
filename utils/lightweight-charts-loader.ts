export type UTCTimestamp = number;
export type LogicalRange = { from: number; to: number } | null;
export type CandlestickData = {
    time: UTCTimestamp;
    open: number;
    high: number;
    low: number;
    close: number;
};

export type SeriesPartialOptions = Record<string, unknown>;

export interface ITimeScaleApi {
    subscribeVisibleLogicalRangeChange(callback: (range: LogicalRange) => void): void;
    unsubscribeVisibleLogicalRangeChange(callback: (range: LogicalRange) => void): void;
    scrollToRealTime(): void;
    getVisibleLogicalRange(): LogicalRange;
}

export interface ISeriesApi {
    setData(data: CandlestickData[]): void;
    update(bar: CandlestickData): void;
}

export interface IChartApi {
    applyOptions(options: Record<string, unknown>): void;
    addCandlestickSeries(options?: SeriesPartialOptions): ISeriesApi;
    timeScale(): ITimeScaleApi;
    remove(): void;
}

export enum CrosshairMode {
    Normal = 0,
    Magnet = 1,
    Hidden = 2,
}

const chartsModulePromise = import(
    /* webpackIgnore: true */
    "https://cdn.jsdelivr.net/npm/lightweight-charts@4.2.0/dist/lightweight-charts.esm.production.js"
);

export const loadLightweightCharts = async () => chartsModulePromise;
