export type PerformancePoint = { date: string; value: number };

export type PortfolioRatios = {
    beta: number | null;
    sharpe: number | null;
    benchmarkReturnPct: number | null;
    totalReturnPct: number | null;
};

const toDailyReturns = (points: PerformancePoint[]): Array<number | null> => {
    const returns: Array<number | null> = [];
    for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1].value;
        const curr = points[i].value;
        if (prev === 0) {
            returns.push(null);
            continue;
        }
        returns.push(curr / prev - 1);
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

const computeTotalReturnPct = (points: PerformancePoint[]): number | null => {
    if (points.length < 2) return null;
    const first = points[0].value;
    const last = points[points.length - 1].value;
    if (first === 0) return null;
    return ((last / first - 1) * 100);
};

export const computePortfolioRatios = (
    portfolioPoints: PerformancePoint[],
    benchmarkPoints: PerformancePoint[]
): PortfolioRatios => {
    if (portfolioPoints.length < 2 || benchmarkPoints.length < 2) {
        return {
            beta: null,
            sharpe: null,
            benchmarkReturnPct: null,
            totalReturnPct: null,
        };
    }

    const benchmarkByDate: Record<string, number> = {};
    benchmarkPoints.forEach((point) => {
        if (typeof point.value === 'number') {
            benchmarkByDate[point.date] = point.value;
        }
    });

    const alignedPortfolioReturns: number[] = [];
    const alignedBenchmarkReturns: number[] = [];
    const portfolioReturns = toDailyReturns(portfolioPoints);

    for (let i = 1; i < portfolioPoints.length; i++) {
        const prevDate = portfolioPoints[i - 1].date;
        const currDate = portfolioPoints[i].date;
        const portfolioReturn = portfolioReturns[i - 1];
        const benchPrev = benchmarkByDate[prevDate];
        const benchCurr = benchmarkByDate[currDate];

        if (
            portfolioReturn == null ||
            !Number.isFinite(portfolioReturn) ||
            typeof benchPrev !== 'number' ||
            typeof benchCurr !== 'number' ||
            benchPrev === 0
        ) {
            continue;
        }

        const benchReturn = benchCurr / benchPrev - 1;
        alignedPortfolioReturns.push(portfolioReturn);
        alignedBenchmarkReturns.push(benchReturn);
    }

    const validPortfolioReturns = portfolioReturns.filter((r): r is number => r != null && Number.isFinite(r));

    const benchmarkReturnPct = computeTotalReturnPct(
        benchmarkPoints.filter((p) => typeof p.value === 'number')
    );
    const totalReturnPct = computeTotalReturnPct(portfolioPoints);

    let sharpe: number | null = null;
    if (validPortfolioReturns.length > 1) {
        const sd = stddev(validPortfolioReturns);
        if (sd > 0) {
            const meanReturn = mean(validPortfolioReturns);
            sharpe = (meanReturn / sd) * Math.sqrt(252);
        }
    }

    let beta: number | null = null;
    if (alignedBenchmarkReturns.length > 1) {
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
