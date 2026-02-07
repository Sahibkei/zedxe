import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';

import { connectToDatabase } from '@/database/mongoose';
import { Portfolio } from '@/database/models/portfolio.model';
import { Transaction } from '@/database/models/transaction.model';
import { auth } from '@/lib/better-auth/auth';
import { getFxRate } from '@/lib/finnhub/fx';
import { getDailyHistory } from '@/lib/market/providers';
import {
    computeBeta,
    computeMaxDrawdown,
    computeReturns,
    computeSharpe,
    computeVolatility,
    type AnalyticsSeriesPoint,
    type PortfolioAnalyticsHistoryPoint,
    type PortfolioAnalyticsRange,
    type PortfolioAnalyticsRatios,
    type PortfolioAnalyticsResponse,
} from '@/lib/portfolio/analytics';

const BENCHMARK_SYMBOL_CANDIDATES = ['SPY', '^GSPC'] as const;
const DEFAULT_BENCHMARK_SYMBOL = BENCHMARK_SYMBOL_CANDIDATES[0];
const DEFAULT_RANGE: PortfolioAnalyticsRange = '1m';
const RISK_FREE_DAILY = Number(process.env.PORTFOLIO_RISK_FREE_DAILY ?? '0');
const HISTORY_FALLBACK_DAYS = 400;
const MIN_SERIES_POINTS = 2;

const emptyRatios: PortfolioAnalyticsRatios = {
    totalReturnPct: null,
    benchmarkReturnPct: null,
    volAnnual: null,
    sharpeAnnual: null,
    beta: null,
    maxDrawdownPct: null,
};

type HoldingAggregate = {
    symbol: string;
    quantity: number;
    totalCost: number;
    avgCost: number;
};

const parseRange = (value: string | null): PortfolioAnalyticsRange => {
    if (!value) return DEFAULT_RANGE;
    const normalized = value.trim().toLowerCase();
    if (normalized === '1m' || normalized === '3m' || normalized === '6m' || normalized === '1y' || normalized === 'all') {
        return normalized;
    }
    return DEFAULT_RANGE;
};

const startOfUtcDay = (value: Date) => {
    const normalized = new Date(value);
    normalized.setUTCHours(0, 0, 0, 0);
    return normalized;
};

const dateToIso = (value: Date) => value.toISOString().slice(0, 10);

const subtractUtcDays = (value: Date, days: number) => {
    const normalized = new Date(value);
    normalized.setUTCDate(normalized.getUTCDate() - days);
    return normalized;
};

const getRangeStartDate = (range: PortfolioAnalyticsRange, toDate: Date, firstTradeDate?: Date | null) => {
    if (range === 'all' && firstTradeDate) {
        return startOfUtcDay(firstTradeDate);
    }

    const start = new Date(toDate);
    switch (range) {
        case '1m':
            return subtractUtcDays(start, 30);
        case '3m':
            return subtractUtcDays(start, 90);
        case '6m':
            return subtractUtcDays(start, 180);
        case '1y':
            return subtractUtcDays(start, 365);
        case 'all':
            return subtractUtcDays(start, 3650);
        default:
            return subtractUtcDays(start, 30);
    }
};

const computeTotalReturnPct = (series: Array<{ value: number }>) => {
    if (series.length < 2) return null;
    const first = series[0]?.value;
    const last = series[series.length - 1]?.value;
    if (!Number.isFinite(first) || !Number.isFinite(last) || first === 0) return null;
    const pct = ((last / first) - 1) * 100;
    return Number.isFinite(pct) ? pct : null;
};

const normalizeSeries = (series: Awaited<ReturnType<typeof getDailyHistory>>) => {
    const normalized = series
        .filter((point) => point?.date && typeof point.close === 'number' && Number.isFinite(point.close) && point.close > 0)
        .sort((a, b) => a.date.localeCompare(b.date));

    const deduped = new Map<string, number>();
    for (const point of normalized) {
        deduped.set(point.date, point.close);
    }

    return Array.from(deduped.entries()).map(([date, close]) => ({ date, close }));
};

const buildCalendarDateGrid = (fromDate: Date, toDate: Date) => {
    const dateGrid: string[] = [];
    const cursor = new Date(fromDate);
    while (cursor <= toDate) {
        dateGrid.push(dateToIso(cursor));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return dateGrid;
};

const getSeedCloseForRangeStart = (symbolSeries: Map<string, number>, firstDate: string) => {
    let seed: number | null = null;
    for (const [date, close] of symbolSeries.entries()) {
        if (date > firstDate) break;
        seed = close;
    }

    if (seed == null) {
        const firstKnownClose = symbolSeries.values().next().value;
        if (typeof firstKnownClose === 'number' && Number.isFinite(firstKnownClose) && firstKnownClose > 0) {
            return firstKnownClose;
        }
    }

    return seed;
};

const buildBenchmarkSeriesForGrid = (
    dateGrid: string[],
    benchmarkSeriesMap: Map<string, number>
): AnalyticsSeriesPoint[] => {
    if (!dateGrid.length) return [];
    const benchmarkSeries: AnalyticsSeriesPoint[] = [];
    let runningClose = getSeedCloseForRangeStart(benchmarkSeriesMap, dateGrid[0]);

    for (const date of dateGrid) {
        const closeOnDate = benchmarkSeriesMap.get(date);
        if (typeof closeOnDate === 'number' && Number.isFinite(closeOnDate) && closeOnDate > 0) {
            runningClose = closeOnDate;
        }

        if (typeof runningClose !== 'number' || !Number.isFinite(runningClose) || runningClose <= 0) {
            continue;
        }

        benchmarkSeries.push({
            date,
            value: runningClose,
        });
    }

    return benchmarkSeries;
};

const getDailyHistoryCached = unstable_cache(
    async (symbol: string, fromDate: string, toDate: string) => {
        return getDailyHistory({
            symbol,
            from: fromDate,
            to: toDate,
        });
    },
    ['portfolio-daily-history'],
    { revalidate: 300 }
);

const fetchHistoryWithFallback = async (symbol: string, fromIso: string, toIso: string, fallbackFromIso: string) => {
    const primarySeries = normalizeSeries(await getDailyHistoryCached(symbol, fromIso, toIso));
    if (primarySeries.length >= MIN_SERIES_POINTS) {
        return { series: primarySeries, usedFallback: false };
    }

    const fallbackSeries = normalizeSeries(await getDailyHistoryCached(symbol, fallbackFromIso, toIso));
    if (fallbackSeries.length > primarySeries.length) {
        return { series: fallbackSeries, usedFallback: true };
    }

    return { series: primarySeries, usedFallback: false };
};

const aggregateHoldings = async (
    transactions: Array<{
        symbol: string;
        type: 'BUY' | 'SELL';
        quantity: number;
        price: number;
        currency: string;
        fxRateToBase: number | null;
    }>,
    baseCurrency: string
) => {
    const bySymbol = new Map<string, { quantity: number; totalCost: number }>();
    const fxRateCache = new Map<string, number>();

    const resolveFxRate = async (currency: string, fxRateToBase: number | null) => {
        const normalized = currency.toUpperCase();
        if (normalized === baseCurrency) return 1;
        if (typeof fxRateToBase === 'number' && Number.isFinite(fxRateToBase) && fxRateToBase > 0) {
            return fxRateToBase;
        }
        if (fxRateCache.has(normalized)) {
            return fxRateCache.get(normalized) || 1;
        }
        const fetched = await getFxRate(normalized, baseCurrency);
        const rate = Number.isFinite(fetched) && fetched > 0 ? fetched : 1;
        fxRateCache.set(normalized, rate);
        return rate;
    };

    for (const tx of transactions) {
        const symbol = tx.symbol.toUpperCase();
        const quantity = Math.abs(Number(tx.quantity));
        const price = Number(tx.price);
        if (!symbol || !Number.isFinite(quantity) || !Number.isFinite(price) || quantity <= 0 || price <= 0) {
            continue;
        }

        const fxRate = await resolveFxRate(tx.currency || baseCurrency, tx.fxRateToBase);
        const signedQuantity = tx.type === 'SELL' ? -quantity : quantity;
        const signedCost = tx.type === 'SELL' ? -(quantity * price * fxRate) : quantity * price * fxRate;

        const current = bySymbol.get(symbol) || { quantity: 0, totalCost: 0 };
        current.quantity += signedQuantity;
        current.totalCost += signedCost;
        bySymbol.set(symbol, current);
    }

    const holdings: HoldingAggregate[] = [];
    for (const [symbol, state] of bySymbol.entries()) {
        if (!Number.isFinite(state.quantity) || state.quantity <= 0) continue;
        const avgCost = state.quantity > 0 ? state.totalCost / state.quantity : 0;
        holdings.push({
            symbol,
            quantity: state.quantity,
            totalCost: state.totalCost,
            avgCost: Number.isFinite(avgCost) ? avgCost : 0,
        });
    }

    return holdings;
};

const computeHistoryFromHoldings = (
    dateGrid: string[],
    holdings: HoldingAggregate[],
    historiesBySymbol: Map<string, Map<string, number>>
): PortfolioAnalyticsHistoryPoint[] => {
    const history: PortfolioAnalyticsHistoryPoint[] = [];
    const runningCloseBySymbol = new Map<string, number>();
    const costBasis = holdings.reduce((acc, holding) => acc + holding.quantity * holding.avgCost, 0);
    const normalizedCostBasis = Number.isFinite(costBasis) ? costBasis : 0;
    const firstGridDate = dateGrid[0];

    if (firstGridDate) {
        for (const holding of holdings) {
            const symbolSeries = historiesBySymbol.get(holding.symbol);
            if (!symbolSeries) continue;

            const seedClose = getSeedCloseForRangeStart(symbolSeries, firstGridDate);
            if (typeof seedClose === 'number' && Number.isFinite(seedClose) && seedClose > 0) {
                runningCloseBySymbol.set(holding.symbol, seedClose);
            }
        }
    }

    for (const date of dateGrid) {
        let totalValue = 0;
        let contributors = 0;

        for (const holding of holdings) {
            const symbolSeries = historiesBySymbol.get(holding.symbol);
            if (!symbolSeries) continue;

            const closeOnDate = symbolSeries.get(date);
            if (typeof closeOnDate === 'number' && Number.isFinite(closeOnDate) && closeOnDate > 0) {
                runningCloseBySymbol.set(holding.symbol, closeOnDate);
            }

            const close = runningCloseBySymbol.get(holding.symbol);
            if (typeof close !== 'number' || !Number.isFinite(close) || close <= 0) continue;

            totalValue += holding.quantity * close;
            contributors += 1;
        }

        if (contributors === 0 || !Number.isFinite(totalValue)) {
            continue;
        }

        history.push({
            date,
            value: totalValue,
            costBasis: normalizedCostBasis > 0 ? normalizedCostBasis : undefined,
        });
    }

    return history;
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
    const warnings: string[] = [];

    try {
        await connectToDatabase();

        const portfolio = await Portfolio.findOne({ _id: portfolioId, userId: session.user.id });
        if (!portfolio) {
            return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
        }

        const transactions = await Transaction.find({ userId: session.user.id, portfolioId }).sort({ tradeDate: 1 });
        const firstTradeDate = transactions.length > 0 ? startOfUtcDay(new Date(transactions[0].tradeDate)) : null;
        const toDate = startOfUtcDay(new Date());
        const rangeStartDate = getRangeStartDate(range, toDate, firstTradeDate);
        const fromDate = range === 'all' && firstTradeDate && firstTradeDate > rangeStartDate ? firstTradeDate : rangeStartDate;

        const baseCurrency = (portfolio.baseCurrency || 'USD').toUpperCase();
        const holdings = await aggregateHoldings(
            transactions.map((tx) => ({
                symbol: tx.symbol,
                type: tx.type,
                quantity: tx.quantity,
                price: tx.price,
                currency: tx.currency || baseCurrency,
                fxRateToBase: tx.fxRateToBase,
            })),
            baseCurrency
        );

        if (holdings.length === 0) {
            warnings.push('No open holdings found for this portfolio.');
            const emptyResponse: PortfolioAnalyticsResponse = {
                range,
                asOf: new Date().toISOString(),
                benchmarkSymbol: DEFAULT_BENCHMARK_SYMBOL,
                history: [],
                ratios: emptyRatios,
                warnings,
            };
            return NextResponse.json(emptyResponse);
        }

        const fromIso = dateToIso(fromDate);
        const toIso = dateToIso(toDate);
        const fallbackFromIso = dateToIso(subtractUtcDays(fromDate, HISTORY_FALLBACK_DAYS));
        const dateGrid = buildCalendarDateGrid(fromDate, toDate);

        const historyResults = await Promise.all(
            holdings.map(async (holding) => {
                try {
                    const { series } = await fetchHistoryWithFallback(
                        holding.symbol,
                        fromIso,
                        toIso,
                        fallbackFromIso
                    );
                    if (!series.length) {
                        return {
                            holding,
                            series: [] as Array<{ date: string; close: number }>,
                            warning: `Missing history for ${holding.symbol}.`,
                        };
                    }
                    return {
                        holding,
                        series,
                    };
                } catch (error) {
                    console.error('portfolio analytics symbol history error:', holding.symbol, error);
                    return {
                        holding,
                        series: [] as Array<{ date: string; close: number }>,
                        warning: `Missing history for ${holding.symbol}.`,
                    };
                }
            })
        );

        const symbolWarnings = historyResults
            .flatMap((result) => (result.warning ? [result.warning] : []))
            .filter(Boolean);
        warnings.push(...symbolWarnings);

        const validSeries = historyResults.filter((result) => result.series.length > 0);
        if (validSeries.length === 0) {
            warnings.push('Unable to compute portfolio NAV because no symbol history was returned.');
            const emptyResponse: PortfolioAnalyticsResponse = {
                range,
                asOf: new Date().toISOString(),
                benchmarkSymbol: DEFAULT_BENCHMARK_SYMBOL,
                history: [],
                ratios: emptyRatios,
                warnings,
            };
            return NextResponse.json(emptyResponse);
        }

        const historiesBySymbol = new Map<string, Map<string, number>>();
        for (const item of validSeries) {
            const symbolMap = new Map<string, number>();
            for (const point of item.series) {
                if (!point.date || typeof point.close !== 'number' || !Number.isFinite(point.close) || point.close <= 0) continue;
                symbolMap.set(point.date, point.close);
            }
            historiesBySymbol.set(item.holding.symbol, symbolMap);
        }

        const includedSymbols = new Set(validSeries.map((item) => item.holding.symbol));
        const computableHoldings = holdings.filter((holding) => includedSymbols.has(holding.symbol));
        const history = computeHistoryFromHoldings(dateGrid, computableHoldings, historiesBySymbol);

        if (history.length < 2) {
            warnings.push('Not enough daily history points to compute full analytics for this range.');
        }

        let benchmarkSymbol: string = DEFAULT_BENCHMARK_SYMBOL;
        let benchmarkSeriesMap = new Map<string, number>();
        let benchmarkFound = false;

        for (const candidate of BENCHMARK_SYMBOL_CANDIDATES) {
            try {
                const { series } = await fetchHistoryWithFallback(candidate, fromIso, toIso, fallbackFromIso);
                if (!series.length) continue;

                benchmarkSymbol = candidate;
                benchmarkSeriesMap = new Map(series.map((point) => [point.date, point.close]));
                benchmarkFound = true;
                break;
            } catch (error) {
                console.error('portfolio analytics benchmark history error:', candidate, error);
            }
        }

        if (!benchmarkFound) {
            warnings.push(`Missing benchmark history for ${DEFAULT_BENCHMARK_SYMBOL} in selected range.`);
        }

        const benchmarkAnalyticsSeries = buildBenchmarkSeriesForGrid(dateGrid, benchmarkSeriesMap);

        const portfolioReturns = computeReturns(history);
        const benchmarkReturns = computeReturns(benchmarkAnalyticsSeries);
        const benchmarkReturnsByDate = new Map(benchmarkReturns.map((point) => [point.date, point.value]));

        const alignedPortfolioReturns: number[] = [];
        const alignedBenchmarkReturns: number[] = [];
        for (const point of portfolioReturns) {
            const benchmarkReturn = benchmarkReturnsByDate.get(point.date);
            if (typeof benchmarkReturn !== 'number' || !Number.isFinite(benchmarkReturn)) {
                continue;
            }
            alignedPortfolioReturns.push(point.value);
            alignedBenchmarkReturns.push(benchmarkReturn);
        }

        const ratios: PortfolioAnalyticsRatios = {
            totalReturnPct: computeTotalReturnPct(history),
            benchmarkReturnPct: computeTotalReturnPct(benchmarkAnalyticsSeries),
            volAnnual: (() => {
                const value = computeVolatility(portfolioReturns.map((point) => point.value));
                return value == null ? null : value * 100;
            })(),
            sharpeAnnual: computeSharpe(
                portfolioReturns.map((point) => point.value),
                Number.isFinite(RISK_FREE_DAILY) ? RISK_FREE_DAILY : 0
            ),
            beta: computeBeta(alignedPortfolioReturns, alignedBenchmarkReturns),
            maxDrawdownPct: (() => {
                const value = computeMaxDrawdown(history);
                return value == null ? null : value * 100;
            })(),
        };

        const response: PortfolioAnalyticsResponse = {
            range,
            asOf: new Date().toISOString(),
            benchmarkSymbol,
            history,
            ratios,
            warnings: warnings.length ? warnings : undefined,
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('GET /api/portfolio/analytics error:', error);
        return NextResponse.json({ error: 'Failed to load portfolio analytics' }, { status: 500 });
    }
}
