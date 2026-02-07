import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';

import { auth } from '@/lib/better-auth/auth';
import { getDailyHistory } from '@/lib/market/providers';
import {
    computeBeta,
    computeMaxDrawdown,
    computeReturns,
    computeSharpe,
    computeVolatility,
    type PortfolioAnalyticsRange,
    type PortfolioAnalyticsRatios,
} from '@/lib/portfolio/analytics';
import { getPortfolioPerformanceSeries, type PortfolioPerformancePoint, type PortfolioPerformanceRange } from '@/lib/portfolio/portfolio-service';

const BENCHMARK_SYMBOL = 'SPY';
const DEFAULT_RANGE: PortfolioAnalyticsRange = '1m';
const RISK_FREE_DAILY = Number(process.env.PORTFOLIO_RISK_FREE_DAILY ?? '0');

const RANGE_MAP: Record<PortfolioAnalyticsRange, PortfolioPerformanceRange> = {
    '1m': '1M',
    '3m': '3M',
    '6m': '6M',
    '1y': '1Y',
    all: 'MAX',
};

const emptyRatios: PortfolioAnalyticsRatios = {
    totalReturnPct: null,
    benchmarkReturnPct: null,
    volAnnual: null,
    sharpeAnnual: null,
    beta: null,
    maxDrawdownPct: null,
};

const parseRange = (value: string | null): PortfolioAnalyticsRange => {
    if (!value) return DEFAULT_RANGE;
    const normalized = value.trim().toLowerCase();
    if (normalized === '1m' || normalized === '3m' || normalized === '6m' || normalized === '1y' || normalized === 'all') {
        return normalized;
    }
    return DEFAULT_RANGE;
};

const toDate = (value: string) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const computeTotalReturnPct = (series: Array<{ value: number }>) => {
    if (series.length < 2) return null;
    const first = series[0]?.value;
    const last = series[series.length - 1]?.value;
    if (!Number.isFinite(first) || !Number.isFinite(last) || first === 0) return null;
    const pct = ((last / first) - 1) * 100;
    return Number.isFinite(pct) ? pct : null;
};

const getBenchmarkHistoryCached = unstable_cache(
    async (symbol: string, fromDate: string, toDate: string) => {
        return getDailyHistory({
            symbol,
            from: fromDate,
            to: toDate,
        });
    },
    ['portfolio-benchmark-daily-history'],
    { revalidate: 300 }
);

type AlignedReturnPair = {
    portfolio: number;
    benchmark: number;
};

const alignReturns = (
    portfolioSeries: PortfolioPerformancePoint[],
    benchmarkMap: Map<string, number>
): AlignedReturnPair[] => {
    const alignedPairs: AlignedReturnPair[] = [];
    for (let i = 1; i < portfolioSeries.length; i += 1) {
        const previous = portfolioSeries[i - 1];
        const current = portfolioSeries[i];
        const benchmarkPrevious = benchmarkMap.get(previous.date);
        const benchmarkCurrent = benchmarkMap.get(current.date);

        if (
            !Number.isFinite(previous.value) ||
            !Number.isFinite(current.value) ||
            previous.value <= 0 ||
            typeof benchmarkPrevious !== 'number' ||
            typeof benchmarkCurrent !== 'number' ||
            benchmarkPrevious <= 0
        ) {
            continue;
        }

        const portfolioReturn = current.value / previous.value - 1;
        const benchmarkReturn = benchmarkCurrent / benchmarkPrevious - 1;
        if (!Number.isFinite(portfolioReturn) || !Number.isFinite(benchmarkReturn)) {
            continue;
        }

        alignedPairs.push({
            portfolio: portfolioReturn,
            benchmark: benchmarkReturn,
        });
    }

    return alignedPairs;
};

export async function GET(request: NextRequest) {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const portfolioId = searchParams.get('portfolioId')?.trim();
    if (!portfolioId) {
        return NextResponse.json({ error: 'portfolioId is required' }, { status: 400 });
    }

    const range = parseRange(searchParams.get('range'));
    const mappedRange = RANGE_MAP[range];

    try {
        const series = await getPortfolioPerformanceSeries(session.user.id, portfolioId, mappedRange, {
            allowFallbackFlatSeries: false,
        });

        if (!series.length) {
            return NextResponse.json({
                range,
                asOf: new Date().toISOString(),
                series: [],
                benchmark: {
                    symbol: BENCHMARK_SYMBOL,
                    series: [],
                    totalReturnPct: null,
                },
                ratios: emptyRatios,
            });
        }

        const startDate = toDate(series[0].date);
        const endDate = toDate(series[series.length - 1].date);
        if (!startDate || !endDate || endDate <= startDate) {
            return NextResponse.json({
                range,
                asOf: new Date().toISOString(),
                series,
                benchmark: {
                    symbol: BENCHMARK_SYMBOL,
                    series: [],
                    totalReturnPct: null,
                },
                ratios: {
                    ...emptyRatios,
                    totalReturnPct: computeTotalReturnPct(series),
                },
            });
        }

        const benchmarkSeries = (await getBenchmarkHistoryCached(
            BENCHMARK_SYMBOL,
            startDate.toISOString().slice(0, 10),
            endDate.toISOString().slice(0, 10)
        )) as Awaited<ReturnType<typeof getDailyHistory>>;

        const benchmarkMap = new Map<string, number>(benchmarkSeries.map((point) => [point.date, point.close]));
        const portfolioReturnPoints = computeReturns(series);
        const portfolioReturns = portfolioReturnPoints.map((point) => point.value);

        const alignedPairs = alignReturns(series, benchmarkMap);
        const alignedPortfolioReturns = alignedPairs.map((pair) => pair.portfolio);
        const alignedBenchmarkReturns = alignedPairs.map((pair) => pair.benchmark);

        const totalReturnPct = computeTotalReturnPct(series);
        const benchmarkReturnPct = computeTotalReturnPct(benchmarkSeries.map((point) => ({ value: point.close })));
        const volatility = computeVolatility(portfolioReturns);
        const sharpe = computeSharpe(portfolioReturns, Number.isFinite(RISK_FREE_DAILY) ? RISK_FREE_DAILY : 0);
        const beta = computeBeta(alignedPortfolioReturns, alignedBenchmarkReturns);
        const maxDrawdown = computeMaxDrawdown(series);

        return NextResponse.json({
            range,
            asOf: new Date().toISOString(),
            series,
            benchmark: {
                symbol: BENCHMARK_SYMBOL,
                series: benchmarkSeries,
                totalReturnPct: benchmarkReturnPct,
            },
            ratios: {
                totalReturnPct,
                benchmarkReturnPct,
                volAnnual: volatility == null ? null : volatility * 100,
                sharpeAnnual: sharpe,
                beta,
                maxDrawdownPct: maxDrawdown == null ? null : maxDrawdown * 100,
            },
        });
    } catch (error) {
        console.error('GET /api/portfolio/analytics error:', error);
        return NextResponse.json({ error: 'Failed to load portfolio analytics' }, { status: 500 });
    }
}
