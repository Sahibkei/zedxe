import { NextResponse } from "next/server";
import { fetchJsonWithTimeout } from "@/lib/http/fetchWithTimeout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CACHE_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 180;
const DEFAULT_SYMBOL = "^GSPC";
const METRIC_RANGE = "3y";
const METRIC_INTERVAL = "1d";
const ANNUALIZATION_FACTOR = Math.sqrt(252);
const EPSILON = 1e-12;

const MARKET_BENCHMARKS = [
    { symbol: "^GSPC", name: "S&P 500" },
    { symbol: "^NDX", name: "NASDAQ 100" },
    { symbol: "^DJI", name: "Dow Jones" },
    { symbol: "^RUT", name: "Russell 2000" },
] as const;

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
    sortino20: number | null;
    sortino60: number | null;
    sortino120: number | null;
};

type BenchmarkSensitivityPoint = {
    t: number;
    beta20: number | null;
    beta60: number | null;
    beta120: number | null;
    corr20: number | null;
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

type BenchmarkComparisonPoint = {
    symbol: string;
    name: string;
    returnPct: number;
    annualizedReturnPct: number | null;
    relativeReturnPct: number | null;
    beta120: number | null;
    correlation120: number | null;
};

type SectorCorrelationPoint = {
    symbol: string;
    label: string;
    returnPct: number;
    annualizedReturnPct: number | null;
    correlation1Y: number | null;
};

type RiskAdjustedSummary = {
    totalReturnPct: number;
    annualizedReturnPct: number | null;
    annualizedVolatilityPct: number | null;
    maxDrawdownPct: number | null;
    sharpeRatio: number | null;
    sortinoRatio: number | null;
    calmarRatio: number | null;
    returnPerVolatility: number | null;
    trailingBeta: number | null;
    marketCorrelation: number | null;
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
    riskAdjustedSummary: RiskAdjustedSummary | null;
    benchmarkComparisons: BenchmarkComparisonPoint[];
    sectorCorrelations: SectorCorrelationPoint[];
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

const downsideDeviation = (values: number[]) => {
    if (!values.length) return 0;
    const squared = values.reduce((sum, value) => {
        const downside = Math.min(0, value);
        return sum + downside ** 2;
    }, 0);
    return Math.sqrt(squared / values.length);
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

const rollingMetric = (returns: number[], endIndex: number, window: number, mode: "vol" | "sharpe" | "sortino") => {
    if (endIndex + 1 < window) return null;
    const sample = returns.slice(endIndex + 1 - window, endIndex + 1);
    const std = standardDeviation(sample);
    if (mode === "vol") return std * ANNUALIZATION_FACTOR * 100;
    if (mode === "sortino") {
        const downside = downsideDeviation(sample);
        if (downside <= EPSILON) return null;
        return (mean(sample) / downside) * ANNUALIZATION_FACTOR;
    }
    if (std <= EPSILON) return null;
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
            sortino20: returnIndex >= 0 ? rollingMetric(returnValues, returnIndex, 20, "sortino") : null,
            sortino60: returnIndex >= 0 ? rollingMetric(returnValues, returnIndex, 60, "sortino") : null,
            sortino120: returnIndex >= 0 ? rollingMetric(returnValues, returnIndex, 120, "sortino") : null,
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
        const window20 = alignedPairs.slice(Math.max(0, index - 19), index + 1);
        const window60 = alignedPairs.slice(Math.max(0, index - 59), index + 1);
        const window120 = alignedPairs.slice(Math.max(0, index - 119), index + 1);
        const corr20 = correlation(
            window20.map((item) => item.asset),
            window20.map((item) => item.benchmark)
        );
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
            beta20: window20.length >= 20 ? rollingBeta(window20) : null,
            beta60: window60.length >= 60 ? rollingBeta(window60) : null,
            beta120: window120.length >= 120 ? rollingBeta(window120) : null,
            corr20: window20.length >= 20 ? corr20 : null,
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

const computeTrailingSnapshot = (assetSeries: HistorySeries, benchmarkSeries: HistorySeries, window: number) => {
    const alignedPairs = buildAlignedReturnPairs(assetSeries.points, benchmarkSeries.points);
    const sample = alignedPairs.slice(Math.max(0, alignedPairs.length - window));
    if (sample.length < window) {
        return { beta: null, correlation: null };
    }

    return {
        beta: rollingBeta(sample),
        correlation: correlation(
            sample.map((point) => point.asset),
            sample.map((point) => point.benchmark)
        ),
    };
};

const buildBenchmarkComparisons = (assetSeries: HistorySeries, benchmarkSeriesList: HistorySeries[]): BenchmarkComparisonPoint[] =>
    benchmarkSeriesList.map((benchmarkSeries) => {
        const benchmarkSummary = summarizePerformance(benchmarkSeries.points);
        const trailing = computeTrailingSnapshot(assetSeries, benchmarkSeries, 120);
        const assetSummary = summarizePerformance(assetSeries.points);

        return {
            symbol: benchmarkSeries.symbol,
            name: benchmarkSeries.name,
            returnPct: benchmarkSummary?.totalReturnPct ?? 0,
            annualizedReturnPct: benchmarkSummary?.annualizedReturnPct ?? null,
            relativeReturnPct:
                assetSummary && benchmarkSummary
                    ? assetSummary.totalReturnPct - benchmarkSummary.totalReturnPct
                    : null,
            beta120: trailing.beta,
            correlation120: trailing.correlation,
        };
    });

const buildSectorCorrelations = (assetSeries: HistorySeries, sectorSeriesList: HistorySeries[]): SectorCorrelationPoint[] =>
    sectorSeriesList.map((sectorSeries, index) => ({
        symbol: sectorSeries.symbol,
        label: SECTOR_BASKET[index]?.label ?? sectorSeries.symbol,
        returnPct: computeTotalReturn(takeTrailingPoints(sectorSeries.points, 252)),
        annualizedReturnPct: computeAnnualizedReturn(takeTrailingPoints(sectorSeries.points, 252)),
        correlation1Y: computePairwiseCorrelation(
            buildReturnMap(takeTrailingPoints(assetSeries.points, 252)),
            buildReturnMap(takeTrailingPoints(sectorSeries.points, 252))
        ),
    }));

const buildRiskAdjustedSummary = (
    summary: PerformanceSummary | null,
    metrics: MetricPoint[],
    benchmarkSensitivity: AssetMetricsResponse["benchmarkSensitivity"]
): RiskAdjustedSummary | null => {
    if (!summary || !metrics.length) return null;

    const latestMetric = metrics[metrics.length - 1];
    const latestSensitivity = benchmarkSensitivity?.points[benchmarkSensitivity.points.length - 1];
    const maxDrawdownPct = metrics.reduce((lowest, point) => Math.min(lowest, point.drawdown), 0);
    const annualizedVolatilityPct = latestMetric?.vol120 ?? null;
    const annualizedReturnPct = summary.annualizedReturnPct;
    const calmarRatio =
        annualizedReturnPct != null && Math.abs(maxDrawdownPct) > EPSILON ? annualizedReturnPct / Math.abs(maxDrawdownPct) : null;
    const returnPerVolatility =
        annualizedReturnPct != null && annualizedVolatilityPct != null && Math.abs(annualizedVolatilityPct) > EPSILON
            ? annualizedReturnPct / annualizedVolatilityPct
            : null;

    return {
        totalReturnPct: summary.totalReturnPct,
        annualizedReturnPct,
        annualizedVolatilityPct,
        maxDrawdownPct,
        sharpeRatio: latestMetric?.sharpe120 ?? null,
        sortinoRatio: latestMetric?.sortino120 ?? null,
        calmarRatio,
        returnPerVolatility,
        trailingBeta: latestSensitivity?.beta120 ?? null,
        marketCorrelation: latestSensitivity?.corr120 ?? null,
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
                riskAdjustedSummary: null,
                benchmarkComparisons: [],
                sectorCorrelations: [],
            } satisfies AssetMetricsResponse
        );
    }

    const marketSeriesResults = await Promise.allSettled(
        MARKET_BENCHMARKS.map((benchmark) =>
            benchmark.symbol === baseSeries.symbol
                ? Promise.resolve(baseSeries)
                : fetchYahooSeries(benchmark.symbol, METRIC_RANGE, METRIC_INTERVAL)
        )
    );

    const marketSeries = marketSeriesResults
        .map((result) => (result.status === "fulfilled" ? result.value : null))
        .filter((entry): entry is HistorySeries => Boolean(entry));

    const benchmarkSeries = marketSeries.find((entry) => entry.symbol === "^GSPC") ?? null;
    const sectorSeriesResults = await Promise.allSettled(
        SECTOR_BASKET.map((sector) => fetchYahooSeries(sector.symbol, METRIC_RANGE, METRIC_INTERVAL))
    );
    const sectorSeries = sectorSeriesResults
        .map((result) => (result.status === "fulfilled" ? result.value : null))
        .filter((entry): entry is HistorySeries => Boolean(entry));

    const metrics = buildMetricSeries(baseSeries.points);
    const benchmarkSensitivity =
        benchmarkSeries && benchmarkSeries.points.length >= 120
            ? buildBenchmarkSensitivity(baseSeries, benchmarkSeries)
            : null;
    const summary = summarizePerformance(baseSeries.points);

    const payload: AssetMetricsResponse = {
        updatedAt: new Date().toISOString(),
        source: "yahoo",
        symbol: baseSeries.symbol,
        name: baseSeries.name,
        summary,
        metrics,
        benchmarkSensitivity,
        riskAdjustedSummary: buildRiskAdjustedSummary(summary, metrics, benchmarkSensitivity),
        benchmarkComparisons: buildBenchmarkComparisons(baseSeries, marketSeries),
        sectorCorrelations: buildSectorCorrelations(baseSeries, sectorSeries),
    };

    setCachedPayload(cacheKey, payload);
    return NextResponse.json(payload);
}
