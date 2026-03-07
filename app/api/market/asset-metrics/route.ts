import { NextResponse } from "next/server";
import { fetchJsonWithTimeout } from "@/lib/http/fetchWithTimeout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CACHE_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 180;
const DEFAULT_SYMBOL = "^GSPC";
const METRIC_RANGE = "3y";
const METRIC_INTERVAL = "1d";
const RISK_RANGE = "5y";
const RISK_INTERVAL = "1d";
const ANNUALIZATION_FACTOR = Math.sqrt(252);

const SUPPORTED_US_INDEX_RISK = new Set(["^GSPC", "^NDX", "^DJI", "^RUT"]);

const SECTOR_BASKET = [
    { symbol: "XLC", label: "Communication" },
    { symbol: "XLY", label: "Consumer Disc." },
    { symbol: "XLP", label: "Consumer Staples" },
    { symbol: "XLE", label: "Energy" },
    { symbol: "XLF", label: "Financials" },
    { symbol: "XLV", label: "Health Care" },
    { symbol: "XLI", label: "Industrials" },
    { symbol: "XLK", label: "Technology" },
    { symbol: "XLB", label: "Materials" },
    { symbol: "XLRE", label: "Real Estate" },
    { symbol: "XLU", label: "Utilities" },
] as const;

type YahooChartResponse = {
    chart?: {
        result?: Array<{
            meta?: {
                symbol?: string;
                shortName?: string;
                longName?: string;
            };
            timestamp?: number[];
            indicators?: {
                quote?: Array<{
                    close?: Array<number | null>;
                }>;
            };
        }>;
        error?: {
            code?: string;
            description?: string;
        };
    };
};

type PricePoint = {
    t: number;
    close: number;
};

type MetricPoint = {
    t: number;
    close: number;
    drawdown: number;
    vol20: number | null;
    vol60: number | null;
    vol120: number | null;
    sharpe20: number | null;
    sharpe60: number | null;
    sharpe120: number | null;
};

type BenchmarkSensitivityPoint = {
    t: number;
    beta60: number | null;
    beta120: number | null;
    corr60: number | null;
    corr120: number | null;
};

type PerformanceSummary = {
    totalReturnPct: number;
    annualizedReturnPct: number | null;
    years: number;
    startClose: number;
    endClose: number;
};

type SectorRiskPoint = {
    symbol: string;
    label: string;
    returnPct: number;
    correlationToBenchmark: number | null;
};

type CorrelationMatrix = {
    labels: string[];
    values: number[][];
};

type AssetMetricsResponse = {
    updatedAt: string;
    source: "yahoo";
    symbol: string;
    name: string;
    summary: PerformanceSummary | null;
    metrics: MetricPoint[];
    benchmarkSensitivity: {
        benchmarkSymbol: string;
        benchmarkName: string;
        points: BenchmarkSensitivityPoint[];
    } | null;
    riskMatrix: {
        benchmarkSymbol: string;
        benchmarkName: string;
        benchmarkSummary: PerformanceSummary | null;
        sectors: SectorRiskPoint[];
        sectorSeries: Array<{
            symbol: string;
            label: string;
            points: PricePoint[];
        }>;
        correlations: CorrelationMatrix;
    } | null;
};

type HistorySeries = {
    symbol: string;
    name: string;
    points: PricePoint[];
};

const cache = new Map<string, { expiresAt: number; payload: AssetMetricsResponse }>();

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const parseSymbol = (raw: string | null) => (raw ?? DEFAULT_SYMBOL).trim().toUpperCase() || DEFAULT_SYMBOL;

const pruneExpiredCacheEntries = (now: number) => {
    for (const [key, entry] of cache) {
        if (entry.expiresAt <= now) cache.delete(key);
    }
};

const getCachedPayload = (cacheKey: string) => {
    const now = Date.now();
    const cached = cache.get(cacheKey);
    if (!cached) return null;
    if (cached.expiresAt <= now) {
        cache.delete(cacheKey);
        return null;
    }

    cache.delete(cacheKey);
    cache.set(cacheKey, cached);
    return cached.payload;
};

const setCachedPayload = (cacheKey: string, payload: AssetMetricsResponse) => {
    const now = Date.now();
    pruneExpiredCacheEntries(now);
    cache.delete(cacheKey);
    cache.set(cacheKey, { expiresAt: now + CACHE_TTL_MS, payload });

    while (cache.size > MAX_CACHE_ENTRIES) {
        const oldestKey = cache.keys().next().value as string | undefined;
        if (!oldestKey) break;
        cache.delete(oldestKey);
    }
};

const fetchYahooSeries = async (symbol: string, range: string, interval: string): Promise<HistorySeries | null> => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
    const result = await fetchJsonWithTimeout<YahooChartResponse>(
        url,
        {
            cache: "no-store",
            headers: {
                Accept: "application/json",
                "User-Agent": "Mozilla/5.0",
            },
        },
        { timeoutMs: 9000, retries: 1, backoffBaseMs: 250 }
    );

    if (!result.ok) return null;
    if (result.data.chart?.error) return null;

    const node = result.data.chart?.result?.[0];
    const timestamps = node?.timestamp ?? [];
    const closes = node?.indicators?.quote?.[0]?.close ?? [];
    const count = Math.min(timestamps.length, closes.length);
    const points: PricePoint[] = [];

    for (let index = 0; index < count; index += 1) {
        const t = timestamps[index];
        const close = closes[index];
        if (!isFiniteNumber(t) || !isFiniteNumber(close) || close <= 0) continue;
        points.push({ t, close });
    }

    if (points.length < 2) return null;

    return {
        symbol: node?.meta?.symbol ?? symbol,
        name: node?.meta?.shortName ?? node?.meta?.longName ?? symbol,
        points,
    };
};

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

const variance = (values: number[]) => {
    if (values.length < 2) return 0;
    const avg = mean(values);
    return values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
};

const standardDeviation = (values: number[]) => {
    if (values.length < 2) return 0;
    return Math.sqrt(variance(values));
};

const correlation = (xs: number[], ys: number[]) => {
    if (xs.length < 2 || ys.length < 2 || xs.length !== ys.length) return null;
    const xMean = mean(xs);
    const yMean = mean(ys);
    let numerator = 0;
    let xDenominator = 0;
    let yDenominator = 0;

    for (let index = 0; index < xs.length; index += 1) {
        const xDelta = xs[index] - xMean;
        const yDelta = ys[index] - yMean;
        numerator += xDelta * yDelta;
        xDenominator += xDelta ** 2;
        yDenominator += yDelta ** 2;
    }

    const denominator = Math.sqrt(xDenominator * yDenominator);
    if (!denominator) return null;
    return numerator / denominator;
};

const buildReturnSeries = (points: PricePoint[]) =>
    points.slice(1).map((point, index) => ({
        t: point.t,
        value: points[index].close > 0 ? point.close / points[index].close - 1 : 0,
    }));

const rollingMetric = (returns: number[], endIndex: number, window: number, mode: "vol" | "sharpe") => {
    if (endIndex + 1 < window) return null;
    const sample = returns.slice(endIndex + 1 - window, endIndex + 1);
    const std = standardDeviation(sample);
    if (mode === "vol") return std * ANNUALIZATION_FACTOR * 100;
    if (!std) return null;
    return (mean(sample) / std) * ANNUALIZATION_FACTOR;
};

const buildMetricSeries = (points: PricePoint[]): MetricPoint[] => {
    const returns = buildReturnSeries(points);
    const returnValues = returns.map((entry) => entry.value);
    let peak = points[0]?.close ?? 0;

    return points.map((point, index) => {
        peak = Math.max(peak, point.close);
        const drawdown = peak > 0 ? ((point.close / peak) - 1) * 100 : 0;
        const returnIndex = index - 1;

        return {
            t: point.t,
            close: point.close,
            drawdown,
            vol20: returnIndex >= 0 ? rollingMetric(returnValues, returnIndex, 20, "vol") : null,
            vol60: returnIndex >= 0 ? rollingMetric(returnValues, returnIndex, 60, "vol") : null,
            vol120: returnIndex >= 0 ? rollingMetric(returnValues, returnIndex, 120, "vol") : null,
            sharpe20: returnIndex >= 0 ? rollingMetric(returnValues, returnIndex, 20, "sharpe") : null,
            sharpe60: returnIndex >= 0 ? rollingMetric(returnValues, returnIndex, 60, "sharpe") : null,
            sharpe120: returnIndex >= 0 ? rollingMetric(returnValues, returnIndex, 120, "sharpe") : null,
        };
    });
};

const buildReturnMap = (points: PricePoint[]) => new Map(buildReturnSeries(points).map((point) => [point.t, point.value]));

const computePairwiseCorrelation = (left: Map<number, number>, right: Map<number, number>) => {
    const xs: number[] = [];
    const ys: number[] = [];

    for (const [time, leftValue] of left) {
        const rightValue = right.get(time);
        if (!isFiniteNumber(rightValue)) continue;
        xs.push(leftValue);
        ys.push(rightValue);
    }

    return correlation(xs, ys);
};

const computeTotalReturn = (points: PricePoint[]) => {
    const first = points[0]?.close;
    const last = points[points.length - 1]?.close;
    if (!first || !last) return 0;
    return ((last / first) - 1) * 100;
};

const computeAnnualizedReturn = (points: PricePoint[]) => {
    const first = points[0];
    const last = points[points.length - 1];
    if (!first || !last || first.close <= 0 || last.close <= 0) {
        return null;
    }

    const years = (last.t - first.t) / (365.25 * 24 * 60 * 60);
    if (!Number.isFinite(years) || years <= 0) return null;
    return (Math.pow(last.close / first.close, 1 / years) - 1) * 100;
};

const summarizePerformance = (points: PricePoint[]): PerformanceSummary | null => {
    const first = points[0];
    const last = points[points.length - 1];
    if (!first || !last) return null;

    const years = Math.max((last.t - first.t) / (365.25 * 24 * 60 * 60), 0);
    return {
        totalReturnPct: computeTotalReturn(points),
        annualizedReturnPct: computeAnnualizedReturn(points),
        years,
        startClose: first.close,
        endClose: last.close,
    };
};

const takeTrailingPoints = (points: PricePoint[], maxPoints: number) =>
    points.length > maxPoints ? points.slice(points.length - maxPoints) : points;

const buildAlignedReturnPairs = (assetPoints: PricePoint[], benchmarkPoints: PricePoint[]) => {
    const benchmarkMap = new Map(buildReturnSeries(benchmarkPoints).map((point) => [point.t, point.value]));
    return buildReturnSeries(assetPoints)
        .map((point) => {
            const benchmark = benchmarkMap.get(point.t);
            if (!isFiniteNumber(benchmark)) return null;
            return {
                t: point.t,
                asset: point.value,
                benchmark,
            };
        })
        .filter(
            (
                entry
            ): entry is {
                t: number;
                asset: number;
                benchmark: number;
            } => Boolean(entry)
        );
};

const rollingBeta = (
    sample: Array<{
        asset: number;
        benchmark: number;
    }>
) => {
    if (sample.length < 2) return null;
    const assetReturns = sample.map((point) => point.asset);
    const benchmarkReturns = sample.map((point) => point.benchmark);
    const assetMean = mean(assetReturns);
    const benchmarkMean = mean(benchmarkReturns);
    const benchmarkVariance = variance(benchmarkReturns);
    if (!benchmarkVariance) return null;

    const covariance =
        sample.reduce(
            (sum, point) => sum + (point.asset - assetMean) * (point.benchmark - benchmarkMean),
            0
        ) / sample.length;

    return covariance / benchmarkVariance;
};

const buildBenchmarkSensitivity = (
    assetSeries: HistorySeries,
    benchmarkSeries: HistorySeries
): AssetMetricsResponse["benchmarkSensitivity"] => {
    const alignedPairs = buildAlignedReturnPairs(assetSeries.points, benchmarkSeries.points);
    if (alignedPairs.length < 120) {
        return null;
    }

    const points = alignedPairs.map((pair, index) => {
        const window60 = alignedPairs.slice(Math.max(0, index - 59), index + 1);
        const window120 = alignedPairs.slice(Math.max(0, index - 119), index + 1);
        const corr60 = correlation(
            window60.map((item) => item.asset),
            window60.map((item) => item.benchmark)
        );
        const corr120 = correlation(
            window120.map((item) => item.asset),
            window120.map((item) => item.benchmark)
        );

        return {
            t: pair.t,
            beta60: window60.length >= 60 ? rollingBeta(window60) : null,
            beta120: window120.length >= 120 ? rollingBeta(window120) : null,
            corr60: window60.length >= 60 ? corr60 : null,
            corr120: window120.length >= 120 ? corr120 : null,
        };
    });

    return {
        benchmarkSymbol: benchmarkSeries.symbol,
        benchmarkName: benchmarkSeries.name,
        points,
    };
};

const buildRiskMatrix = async (symbol: string, name: string) => {
    if (!SUPPORTED_US_INDEX_RISK.has(symbol)) return null;

    const benchmarkSeries = await fetchYahooSeries(symbol, RISK_RANGE, RISK_INTERVAL);
    if (!benchmarkSeries) return null;

    const sectorSeriesResults = await Promise.allSettled(
        SECTOR_BASKET.map((sector) => fetchYahooSeries(sector.symbol, RISK_RANGE, RISK_INTERVAL))
    );

    const sectors = sectorSeriesResults
        .map((result, index) => {
            const meta = SECTOR_BASKET[index];
            if (result.status !== "fulfilled" || !result.value) return null;
            return {
                symbol: meta.symbol,
                label: meta.label,
                series: result.value,
            };
        })
        .filter(
            (entry): entry is { symbol: string; label: string; series: HistorySeries } => Boolean(entry)
        );

    if (!sectors.length) return null;

    const correlationBenchmarkPoints = takeTrailingPoints(benchmarkSeries.points, 252);
    const benchmarkReturns = buildReturnMap(correlationBenchmarkPoints);
    const labels = [...sectors.map((sector) => sector.label), symbol.replace("^", "")];
    const returnMaps = [
        ...sectors.map((sector) => buildReturnMap(takeTrailingPoints(sector.series.points, 252))),
        benchmarkReturns,
    ];

    const correlationValues = labels.map((_, rowIndex) =>
        labels.map((__, colIndex) => {
            if (rowIndex === colIndex) return 1;
            const value = computePairwiseCorrelation(returnMaps[rowIndex], returnMaps[colIndex]);
            return value ?? 0;
        })
    );

    return {
        benchmarkSymbol: symbol,
        benchmarkName: name,
        benchmarkSummary: summarizePerformance(benchmarkSeries.points),
        sectors: sectors.map((sector) => ({
            symbol: sector.symbol,
            label: sector.label,
            returnPct: computeTotalReturn(sector.series.points),
            correlationToBenchmark: computePairwiseCorrelation(
                buildReturnMap(takeTrailingPoints(sector.series.points, 252)),
                benchmarkReturns
            ),
        })),
        sectorSeries: sectors.map((sector) => ({
            symbol: sector.symbol,
            label: sector.label,
            points: sector.series.points,
        })),
        correlations: {
            labels,
            values: correlationValues,
        },
    };
};

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = parseSymbol(searchParams.get("symbol"));
    const cacheKey = symbol;
    const cachedPayload = getCachedPayload(cacheKey);
    if (cachedPayload) {
        return NextResponse.json(cachedPayload);
    }

    const baseSeries = await fetchYahooSeries(symbol, METRIC_RANGE, METRIC_INTERVAL);
    if (!baseSeries) {
        return NextResponse.json(
            {
                updatedAt: new Date().toISOString(),
                source: "yahoo",
                symbol,
                name: symbol,
                summary: null,
                metrics: [],
                benchmarkSensitivity: null,
                riskMatrix: null,
            } satisfies AssetMetricsResponse
        );
    }

    const benchmarkSeries =
        baseSeries.symbol === "^GSPC"
            ? baseSeries
            : await fetchYahooSeries("^GSPC", METRIC_RANGE, METRIC_INTERVAL);

    const payload: AssetMetricsResponse = {
        updatedAt: new Date().toISOString(),
        source: "yahoo",
        symbol: baseSeries.symbol,
        name: baseSeries.name,
        summary: summarizePerformance(baseSeries.points),
        metrics: buildMetricSeries(baseSeries.points),
        benchmarkSensitivity:
            benchmarkSeries && benchmarkSeries.points.length >= 120
                ? buildBenchmarkSensitivity(baseSeries, benchmarkSeries)
                : null,
        riskMatrix: await buildRiskMatrix(baseSeries.symbol, baseSeries.name),
    };

    setCachedPayload(cacheKey, payload);
    return NextResponse.json(payload);
}
