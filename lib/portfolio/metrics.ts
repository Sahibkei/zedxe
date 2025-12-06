export type PerformancePoint = { date: string; value: number };

export type PortfolioRatios = {
    beta: number | null;
    sharpe: number | null;
    benchmarkReturnPct: number | null;
    totalReturnPct: number | null;
};

export const computeDailyReturns = (
    points: PerformancePoint[]
): Array<{ date: string; return: number }> => {
    const returns: Array<{ date: string; return: number }> = [];
    for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];

        if (!Number.isFinite(prev.value) || !Number.isFinite(curr.value)) continue;
        if (prev.value <= 0 || curr.value <= 0) continue;

        const simpleReturn = (curr.value - prev.value) / prev.value;
        returns.push({ date: curr.date, return: simpleReturn });
    }
    return returns;
};

const mean = (values: number[]) => {
    if (!values.length) return 0;
    return values.reduce((acc, v) => acc + v, 0) / values.length;
};

const variance = (values: number[]) => {
    if (!values.length) return 0;
    const m = mean(values);
    return mean(values.map((v) => (v - m) ** 2));
};

const stddev = (values: number[]) => Math.sqrt(variance(values));

export const computeTotalReturnPct = (points: PerformancePoint[]): number | null => {
    if (points.length < 2) return null;

    const valid = points.filter((p) => Number.isFinite(p.value) && p.value > 0);
    if (valid.length < 2) return null;

    const first = valid[0];
    const last = valid[valid.length - 1];
    if (!first || !last) return null;

    return ((last.value - first.value) / first.value) * 100;
};

export const computePortfolioRatios = (
    portfolioPoints: PerformancePoint[],
    benchmarkPoints: PerformancePoint[]
): PortfolioRatios => {
    // Benchmark and portfolio series are expected to be aligned by date strings (YYYY-MM-DD).
    // Any gaps are naturally skipped when returns cannot be paired on the same day.
    const filteredPortfolio = portfolioPoints.filter((p) => Number.isFinite(p.value) && p.value > 0);
    const filteredBenchmark = benchmarkPoints.filter((p) => Number.isFinite(p.value) && p.value > 0);

    if (filteredPortfolio.length < 2 || filteredBenchmark.length < 2) {
        return {
            beta: null,
            sharpe: null,
            benchmarkReturnPct: null,
            totalReturnPct: null,
        };
    }

    const portfolioReturns = computeDailyReturns(filteredPortfolio);
    const benchmarkReturns = computeDailyReturns(filteredBenchmark);

    const benchmarkReturnsByDate = new Map<string, number>();
    benchmarkReturns.forEach((item) => benchmarkReturnsByDate.set(item.date, item.return));

    const alignedPortfolioReturns: number[] = [];
    const alignedBenchmarkReturns: number[] = [];

    for (const { date, return: pReturn } of portfolioReturns) {
        const bReturn = benchmarkReturnsByDate.get(date);
        if (bReturn == null || !Number.isFinite(pReturn) || !Number.isFinite(bReturn)) continue;
        alignedPortfolioReturns.push(pReturn);
        alignedBenchmarkReturns.push(bReturn);
    }

    const benchmarkReturnPct = computeTotalReturnPct(filteredBenchmark);
    const totalReturnPct = computeTotalReturnPct(filteredPortfolio);

    let sharpe: number | null = null;
    if (portfolioReturns.length > 1) {
        const portfolioReturnValues = portfolioReturns.map((r) => r.return);
        const sd = stddev(portfolioReturnValues);
        if (sd > 0) {
            const meanReturn = mean(portfolioReturnValues);
            // Risk-free rate assumed to be 0%; annualized with 252 trading days.
            sharpe = (meanReturn / sd) * Math.sqrt(252);
        }
    }

    let beta: number | null = null;
    if (alignedBenchmarkReturns.length >= 30) {
        const benchVariance = variance(alignedBenchmarkReturns);
        if (benchVariance > 0) {
            const meanP = mean(alignedPortfolioReturns);
            const meanB = mean(alignedBenchmarkReturns);
            const covariance = mean(
                alignedPortfolioReturns.map((r, idx) => r * alignedBenchmarkReturns[idx])
            ) - meanP * meanB;
            beta = covariance / benchVariance;
        }
    }

    return {
        beta: Number.isFinite(beta ?? NaN) ? beta : null,
        sharpe: Number.isFinite(sharpe ?? NaN) ? sharpe : null,
        benchmarkReturnPct: Number.isFinite(benchmarkReturnPct ?? NaN) ? benchmarkReturnPct : null,
        totalReturnPct: Number.isFinite(totalReturnPct ?? NaN) ? totalReturnPct : null,
    };
};

export const computeBenchmarkSeries = (
    benchmarkCloses: Record<string, number>,
    portfolioDates: string[]
): PerformancePoint[] => {
    return portfolioDates
        .map((date) => {
            const value = benchmarkCloses[date];
            return typeof value === 'number'
                ? { date, value }
                : null;
        })
        .filter((p): p is PerformancePoint => Boolean(p));
};

// Lightweight inline sanity tests that can be executed manually with NODE_ENV=test-metrics
// to validate core calculations without a full test runner.
if (process.env.NODE_ENV === 'test-metrics') {
    const sampleSeries: PerformancePoint[] = [
        { date: '2024-01-01', value: 100 },
        { date: '2024-01-02', value: 110 },
        { date: '2024-01-03', value: 105 },
    ];

    console.assert(computeTotalReturnPct(sampleSeries)?.toFixed(2) === '5.00', 'total return sanity');
    const returns = computeDailyReturns(sampleSeries).map((r) => r.return.toFixed(4));
    console.assert(returns[0] === '0.1000' && returns[1] === '-0.0455', 'daily return sanity');
}
