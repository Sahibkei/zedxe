export type AnalyticsSeriesPoint = {
    date: string;
    value: number;
};

export type PortfolioAnalyticsRange = '1m' | '3m' | '6m' | '1y' | 'all';

export type PortfolioAnalyticsRatios = {
    totalReturnPct: number | null;
    benchmarkReturnPct: number | null;
    volAnnual: number | null;
    sharpeAnnual: number | null;
    beta: number | null;
    maxDrawdownPct: number | null;
};

export type PortfolioBenchmarkSeriesPoint = {
    date: string;
    close: number;
};

export type PortfolioAnalyticsResponse = {
    range: PortfolioAnalyticsRange;
    asOf: string;
    series: Array<AnalyticsSeriesPoint & { costBasis?: number }>;
    benchmark: {
        symbol: string;
        series: PortfolioBenchmarkSeriesPoint[];
        totalReturnPct: number | null;
    };
    ratios: PortfolioAnalyticsRatios;
};

export type DailyReturnPoint = {
    date: string;
    value: number;
};

const TRADING_DAYS_PER_YEAR = 252;
const CALENDAR_DAYS_PER_YEAR = 365.25;
const EPSILON = 1e-12;

const isFiniteNumber = (value: number) => Number.isFinite(value);

const mean = (values: number[]) => {
    if (!values.length) return null;
    return values.reduce((acc, value) => acc + value, 0) / values.length;
};

const sampleVariance = (values: number[]) => {
    if (values.length < 2) return null;
    const avg = mean(values);
    if (avg == null) return null;
    const squaredDiffs = values.reduce((acc, value) => acc + (value - avg) ** 2, 0);
    return squaredDiffs / (values.length - 1);
};

const sampleStdDev = (values: number[]) => {
    const variance = sampleVariance(values);
    if (variance == null || variance < 0) return null;
    return Math.sqrt(variance);
};

export const computeReturns = (series: AnalyticsSeriesPoint[]): DailyReturnPoint[] => {
    if (series.length < 2) return [];

    const returns: DailyReturnPoint[] = [];
    for (let i = 1; i < series.length; i += 1) {
        const previousValue = series[i - 1]?.value;
        const currentValue = series[i]?.value;

        if (!isFiniteNumber(previousValue) || !isFiniteNumber(currentValue) || previousValue <= 0) {
            continue;
        }

        const dailyReturn = currentValue / previousValue - 1;
        if (!isFiniteNumber(dailyReturn)) {
            continue;
        }

        returns.push({
            date: series[i].date,
            value: dailyReturn,
        });
    }

    return returns;
};

export const computeCAGR = (series: AnalyticsSeriesPoint[]): number | null => {
    if (series.length < 2) return null;

    const first = series[0];
    const last = series[series.length - 1];

    if (!isFiniteNumber(first.value) || !isFiniteNumber(last.value) || first.value <= 0 || last.value <= 0) {
        return null;
    }

    const firstDateMs = Date.parse(first.date);
    const lastDateMs = Date.parse(last.date);
    if (!Number.isFinite(firstDateMs) || !Number.isFinite(lastDateMs) || lastDateMs <= firstDateMs) {
        return null;
    }

    const years = (lastDateMs - firstDateMs) / (1000 * 60 * 60 * 24 * CALENDAR_DAYS_PER_YEAR);
    if (years <= 0) return null;

    const cagr = Math.pow(last.value / first.value, 1 / years) - 1;
    return isFiniteNumber(cagr) ? cagr : null;
};

export const computeVolatility = (returns: number[]): number | null => {
    if (returns.length < 2) return null;

    const filtered = returns.filter((value) => isFiniteNumber(value));
    if (filtered.length < 2) return null;

    const std = sampleStdDev(filtered);
    if (std == null) return null;

    const annualized = std * Math.sqrt(TRADING_DAYS_PER_YEAR);
    return isFiniteNumber(annualized) ? annualized : null;
};

export const computeSharpe = (returns: number[], rfDaily: number): number | null => {
    if (returns.length < 2) return null;

    const filtered = returns.filter((value) => isFiniteNumber(value));
    if (filtered.length < 2) return null;

    const excessReturns = filtered.map((value) => value - rfDaily);
    const avgExcessReturn = mean(excessReturns);
    if (avgExcessReturn == null) return null;

    const std = sampleStdDev(filtered);
    if (std == null || std <= EPSILON) return null;

    const sharpe = (avgExcessReturn / std) * Math.sqrt(TRADING_DAYS_PER_YEAR);
    return isFiniteNumber(sharpe) ? sharpe : null;
};

export const computeBeta = (returns: number[], benchReturns: number[]): number | null => {
    const length = Math.min(returns.length, benchReturns.length);
    if (length < 2) return null;

    const alignedReturns: number[] = [];
    const alignedBenchReturns: number[] = [];

    for (let i = 0; i < length; i += 1) {
        const portfolioReturn = returns[i];
        const benchmarkReturn = benchReturns[i];
        if (!isFiniteNumber(portfolioReturn) || !isFiniteNumber(benchmarkReturn)) {
            continue;
        }
        alignedReturns.push(portfolioReturn);
        alignedBenchReturns.push(benchmarkReturn);
    }

    if (alignedReturns.length < 2) return null;

    const meanPortfolio = mean(alignedReturns);
    const meanBenchmark = mean(alignedBenchReturns);
    if (meanPortfolio == null || meanBenchmark == null) return null;

    let covarianceSum = 0;
    let varianceBenchSum = 0;
    for (let i = 0; i < alignedReturns.length; i += 1) {
        const portfolioDiff = alignedReturns[i] - meanPortfolio;
        const benchmarkDiff = alignedBenchReturns[i] - meanBenchmark;
        covarianceSum += portfolioDiff * benchmarkDiff;
        varianceBenchSum += benchmarkDiff ** 2;
    }

    const denominator = alignedReturns.length - 1;
    if (denominator <= 0) return null;

    const covariance = covarianceSum / denominator;
    const benchmarkVariance = varianceBenchSum / denominator;
    if (!isFiniteNumber(covariance) || !isFiniteNumber(benchmarkVariance) || benchmarkVariance <= EPSILON) {
        return null;
    }

    const beta = covariance / benchmarkVariance;
    return isFiniteNumber(beta) ? beta : null;
};

export const computeMaxDrawdown = (series: AnalyticsSeriesPoint[]): number | null => {
    if (series.length < 2) return null;

    let peak: number | null = null;
    let maxDrawdown = 0;
    let hasValidPoint = false;

    for (const point of series) {
        if (!isFiniteNumber(point.value) || point.value <= 0) {
            continue;
        }

        hasValidPoint = true;
        if (peak == null || point.value > peak) {
            peak = point.value;
            continue;
        }

        const drawdown = point.value / peak - 1;
        if (drawdown < maxDrawdown) {
            maxDrawdown = drawdown;
        }
    }

    if (!hasValidPoint) return null;
    return isFiniteNumber(maxDrawdown) ? maxDrawdown : null;
};
