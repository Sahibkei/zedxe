import { connectToDatabase } from '@/database/mongoose';
import { Portfolio, type PortfolioDocument } from '@/database/models/portfolio.model';
import { Transaction, type TransactionDocument } from '@/database/models/transaction.model';
import { getSnapshotsForSymbols } from '@/lib/actions/finnhub.actions';
import { fetchJSON } from '@/lib/actions/finnhub.actions';
import { getFxRate } from '@/lib/finnhub/fx';
import {
    computeBenchmarkSeries,
    computePortfolioRatios,
    type PerformancePoint,
    type PortfolioRatios,
} from '@/lib/portfolio/metrics';
export type { PortfolioRatios } from '@/lib/portfolio/metrics';

export interface PositionSummary {
    symbol: string;
    companyName?: string;
    quantity: number;
    avgPrice: number;
    currentPrice: number;
    currentValue: number;
    pnlAbs: number;
    pnlPct: number;
    weightPct: number;
}

export interface PortfolioTotals {
    currentValue: number;
    dayChangeValue: number;
    dayChangePct: number;
}

export interface PortfolioSummary {
    portfolio: { id: string; name: string; baseCurrency: string; weeklyReportEnabled: boolean };
    totals: PortfolioTotals;
    positions: PositionSummary[];
    ratios: PortfolioRatios;
}

export interface PortfolioPerformancePoint {
    date: string; // "YYYY-MM-DD"
    portfolioValue: number;
    investedCapital: number; // placeholder, will be implemented in a later PR
    unrealizedPnL: number; // placeholder, will be implemented in a later PR
    value: number; // alias for portfolioValue, used by the chart
}

export type PortfolioPerformanceRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'YTD' | 'MAX';

export type PortfolioLean = {
    id: string;
    name: string;
    baseCurrency: string;
    weeklyReportEnabled: boolean;
    createdAt?: Date;
    updatedAt?: Date;
};

const BENCHMARK_SYMBOL = '^GSPC';

const mapPortfolio = (portfolio: { _id: unknown; name: string; baseCurrency: string; weeklyReportEnabled?: boolean; createdAt?: Date; updatedAt?: Date }): PortfolioLean => ({
    id: String(portfolio._id),
    name: portfolio.name,
    baseCurrency: portfolio.baseCurrency,
    weeklyReportEnabled: Boolean(portfolio.weeklyReportEnabled),
    createdAt: portfolio.createdAt,
    updatedAt: portfolio.updatedAt,
});

export async function getUserPortfolios(userId: string): Promise<PortfolioLean[]> {
    if (!userId) return [];

    await connectToDatabase();
    const portfolios = await Portfolio.find({ userId }).sort({ createdAt: -1 }).lean();
    return portfolios.map(mapPortfolio);
}

export async function setWeeklyReportPortfolio(userId: string, portfolioId: string) {
    if (!userId || !portfolioId) return;

    await connectToDatabase();

    await Portfolio.updateMany({ userId }, { $set: { weeklyReportEnabled: false } });
    await Portfolio.updateOne({ _id: portfolioId, userId }, { $set: { weeklyReportEnabled: true } });
}

export async function clearWeeklyReportSelection(userId: string) {
    if (!userId) return;

    await connectToDatabase();
    await Portfolio.updateMany({ userId }, { $set: { weeklyReportEnabled: false } });
}

const emptyRatios: PortfolioRatios = {
    beta: null,
    sharpe: null,
    benchmarkReturnPct: null,
    totalReturnPct: null,
};

const getFxRatesForCurrencies = async (currencies: string[], baseCurrency: string) => {
    const normalizedBase = baseCurrency.toUpperCase();
    const rates: Record<string, number> = { [normalizedBase]: 1 };

    await Promise.all(
        currencies.map(async (currency) => {
            const normalized = currency.toUpperCase();
            if (normalized === normalizedBase) {
                rates[normalized] = 1;
                return;
            }

            if (rates[normalized] !== undefined) return;

            const rate = await getFxRate(normalized, normalizedBase);
            rates[normalized] = rate;
        })
    );

    return rates;
};

export async function getPortfolioRatios(userId: string, portfolioId: string): Promise<PortfolioRatios> {
    try {
        let range: PortfolioPerformanceRange = '1Y';
        let points = await getPortfolioPerformanceSeries(userId, portfolioId, range, { allowFallbackFlatSeries: false });

        if (!points || points.length < 2) {
            range = 'MAX';
            points = await getPortfolioPerformanceSeries(userId, portfolioId, range, { allowFallbackFlatSeries: false });
        }

        if (!points || points.length < 2) {
            return emptyRatios;
        }

        const startDate = startOfDay(new Date(points[0].date));
        const endDate = startOfDay(new Date(points[points.length - 1].date));

        const benchmarkCloses = await fetchDailyCloses(BENCHMARK_SYMBOL, startDate, endDate);
        const benchmarkPoints: PerformancePoint[] = computeBenchmarkSeries(
            benchmarkCloses,
            points.map((p) => p.date)
        );

        return computePortfolioRatios(points, benchmarkPoints);
    } catch (error) {
        console.error('getPortfolioRatios error:', error);
        return emptyRatios;
    }
}

export async function getPortfolioSummary(userId: string, portfolioId: string): Promise<PortfolioSummary> {
    if (!userId || !portfolioId) {
        throw new Error('Missing user or portfolio id');
    }

    await connectToDatabase();

    const portfolio = await Portfolio.findOne({ _id: portfolioId, userId }).lean();
    if (!portfolio) {
        throw new Error('Portfolio not found');
    }

    const transactions = await Transaction.find({ userId, portfolioId }).sort({ tradeDate: 1 }).lean();

    const baseCurrency = (portfolio.baseCurrency || 'USD').toUpperCase();
    const currencies = new Set<string>(transactions.map((tx) => (tx.currency || baseCurrency).toUpperCase()));
    currencies.add(baseCurrency);
    const fxRates = await getFxRatesForCurrencies(Array.from(currencies), baseCurrency);

    const aggregated: Record<
        string,
        {
            symbol: string;
            quantity: number;
            totalCost: number;
            currency: string;
        }
    > = {};

    for (const tx of transactions) {
        const symbol = tx.symbol.toUpperCase();
        const txCurrency = (tx.currency || baseCurrency).toUpperCase();
        const fxRateCandidate = txCurrency === baseCurrency ? 1 : fxRates[txCurrency];
        const fallbackFxRate = typeof tx.fxRateToBase === 'number' && tx.fxRateToBase > 0 ? tx.fxRateToBase : 1;
        const fxRate = typeof fxRateCandidate === 'number' && fxRateCandidate > 0 ? fxRateCandidate : fallbackFxRate;
        const signedQty = tx.type === 'SELL' ? -Math.abs(tx.quantity) : Math.abs(tx.quantity);
        const totalValue = tx.price * Math.abs(tx.quantity) * fxRate;

        if (!aggregated[symbol]) {
            aggregated[symbol] = { symbol, quantity: 0, totalCost: 0, currency: txCurrency };
        }

        aggregated[symbol].quantity += signedQty;
        aggregated[symbol].totalCost += tx.type === 'SELL' ? -totalValue : totalValue;
        aggregated[symbol].currency = aggregated[symbol].currency || txCurrency;
    }

    const activeSymbols = Object.values(aggregated)
        .filter((entry) => entry.quantity > 0)
        .map((entry) => entry.symbol);

    const snapshots = activeSymbols.length > 0 ? await getSnapshotsForSymbols(activeSymbols) : {};

    const positions: PositionSummary[] = [];

    let totalCurrentValue = 0;
    let totalDayChangeValue = 0;

    for (const entry of Object.values(aggregated)) {
        if (entry.quantity <= 0) continue; // Ignore closed positions for now

        const snapshot = snapshots[entry.symbol];
        const currentPrice = typeof snapshot?.currentPrice === 'number' ? snapshot.currentPrice : undefined;
        if (currentPrice === undefined || currentPrice === null || currentPrice <= 0) {
            // TODO: show N/A in UI when price is missing instead of skipping
            continue;
        }
        const positionCurrency = entry.currency || baseCurrency;
        const fxRate = positionCurrency === baseCurrency ? 1 : fxRates[positionCurrency] ?? 1;
        const priceInBase = currentPrice * fxRate;
        const avgPrice = entry.quantity > 0 ? entry.totalCost / entry.quantity : 0;
        const currentValue = entry.quantity * priceInBase;
        const pnlAbs = currentValue - entry.totalCost;
        const pnlPct = entry.totalCost !== 0 ? (pnlAbs / entry.totalCost) * 100 : 0;

        const changePercent = snapshot?.changePercent ?? 0; // TODO: replace with previous-close based change when available
        const changeFactor = 1 + changePercent / 100;
        const positionDayChangeValue =
            changePercent && changeFactor !== 0
                ? currentValue - currentValue / changeFactor
                : 0;

        totalCurrentValue += currentValue;
        totalDayChangeValue += positionDayChangeValue;

        positions.push({
            symbol: entry.symbol,
            companyName: snapshot?.company,
            quantity: entry.quantity,
            avgPrice,
            currentPrice: priceInBase,
            currentValue,
            pnlAbs,
            pnlPct,
            weightPct: 0, // placeholder until total value is known
        });
    }

    const totals: PortfolioTotals = {
        currentValue: totalCurrentValue,
        dayChangeValue: totalDayChangeValue,
        dayChangePct: totalCurrentValue !== 0 ? (totalDayChangeValue / (totalCurrentValue - totalDayChangeValue)) * 100 : 0,
    };

    const withWeights = positions.map((pos) => ({
        ...pos,
        weightPct: totalCurrentValue > 0 ? (pos.currentValue / totalCurrentValue) * 100 : 0,
    }));

    const ratios = await getPortfolioRatios(userId, portfolioId);

    const summary: PortfolioSummary = {
        portfolio: {
            id: String(portfolio._id),
            name: portfolio.name,
            baseCurrency: portfolio.baseCurrency,
            weeklyReportEnabled: Boolean(portfolio.weeklyReportEnabled),
        },
        totals,
        positions: withWeights,
        ratios,
    };

    return summary;
}

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

const normalizeDateString = (value: Date) => value.toISOString().slice(0, 10);

const startOfDay = (value: Date) => {
    const d = new Date(value);
    d.setUTCHours(0, 0, 0, 0);
    return d;
};

const fetchDailyCloses = async (symbol: string, from: Date, to: Date): Promise<Record<string, number>> => {
    const token = process.env.FINNHUB_API_KEY ?? '';
    if (!token) {
        console.error('getPortfolioPerformanceSeries: FINNHUB API key missing');
        return {};
    }

    type FinnhubCandleResponse = { c?: number[]; t?: number[]; s?: 'ok' | 'no_data' | string };

    const fromTs = Math.floor(from.getTime() / 1000);
    const toTs = Math.floor(to.getTime() / 1000);
    const url = `${FINNHUB_BASE_URL}/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${fromTs}&to=${toTs}&token=${token}`;

    try {
        const data = await fetchJSON<FinnhubCandleResponse>(url, 3600);
        if (!data || data.s !== 'ok' || !Array.isArray(data.c) || !Array.isArray(data.t)) {
            return {};
        }

        const closes: Record<string, number> = {};
        const len = Math.min(data.c.length, data.t.length);
        for (let i = 0; i < len; i++) {
            const ts = data.t[i];
            const close = data.c[i];
            if (typeof ts !== 'number' || typeof close !== 'number') continue;
            const date = new Date(ts * 1000);
            closes[normalizeDateString(startOfDay(date))] = close;
        }
        return closes;
    } catch (error) {
        console.error('getPortfolioPerformanceSeries candle fetch error for', symbol, error);
        // TODO: Add caching / fallback prices when market data is unavailable
        return {};
    }
};

const addDays = (value: Date, days: number) => {
    const d = startOfDay(new Date(value));
    d.setUTCDate(d.getUTCDate() + days);
    return d;
};

const buildDateRange = (range: PortfolioPerformanceRange, earliestActiveTradeDate: Date) => {
    const today = startOfDay(new Date());
    let startCandidate = today;

    switch (range) {
        case '1D':
            startCandidate = addDays(today, -1);
            break;
        case '1W':
            startCandidate = addDays(today, -7);
            break;
        case '1M':
            startCandidate = addDays(today, -30);
            break;
        case '3M':
            startCandidate = addDays(today, -90);
            break;
        case '6M':
            startCandidate = addDays(today, -180);
            break;
        case '1Y':
            startCandidate = addDays(today, -365);
            break;
        case 'YTD':
            startCandidate = startOfDay(new Date(Date.UTC(today.getUTCFullYear(), 0, 1)));
            break;
        case 'MAX':
        default:
            startCandidate = earliestActiveTradeDate;
            break;
    }

    const startDate = startCandidate < earliestActiveTradeDate ? earliestActiveTradeDate : startCandidate;
    const endDate = today;

    const dateStrings: string[] = [];
    const dateCursor = new Date(startDate);
    while (dateCursor <= endDate) {
        dateStrings.push(normalizeDateString(dateCursor));
        dateCursor.setUTCDate(dateCursor.getUTCDate() + 1);
    }

    return { startDate, endDate, dateStrings };
};

export async function getPortfolioPerformanceSeries(
    userId: string,
    portfolioId: string,
    range: PortfolioPerformanceRange,
    options?: { allowFallbackFlatSeries?: boolean }
): Promise<PortfolioPerformancePoint[]> {
    // Compute an index-style performance series using current net holdings priced over the requested date range.
    // This deliberately ignores historical cash flows/PNL (investedCapital and unrealizedPnL are placeholders) and
    // focuses on returning a usable time series so the chart can render.
    if (!userId || !portfolioId) {
        throw new Error('Missing user or portfolio id');
    }

    const allowFallbackFlatSeries = options?.allowFallbackFlatSeries ?? false;

    await connectToDatabase();

    const portfolio = await Portfolio.findOne({ _id: portfolioId, userId }).lean();
    if (!portfolio) {
        throw new Error('Portfolio not found');
    }

    const transactions = await Transaction.find({ userId, portfolioId }).sort({ tradeDate: 1 }).lean();
    if (!transactions || transactions.length === 0) {
        return [];
    }

    const baseCurrency = (portfolio.baseCurrency || 'USD').toUpperCase();

    const holdingsAggregated: Record<string, { quantity: number; currency: string; earliestTradeDate: Date }> = {};
    for (const tx of transactions) {
        const symbol = tx.symbol.toUpperCase();
        const signedQty = tx.type === 'SELL' ? -Math.abs(tx.quantity) : Math.abs(tx.quantity);
        const txCurrency = (tx.currency || baseCurrency).toUpperCase();
        const tradeDate = startOfDay(new Date(tx.tradeDate));

        if (!holdingsAggregated[symbol]) {
            holdingsAggregated[symbol] = { quantity: 0, currency: txCurrency, earliestTradeDate: tradeDate };
        }

        holdingsAggregated[symbol].quantity += signedQty;
        holdingsAggregated[symbol].currency = holdingsAggregated[symbol].currency || txCurrency;
        if (tradeDate < holdingsAggregated[symbol].earliestTradeDate) {
            holdingsAggregated[symbol].earliestTradeDate = tradeDate;
        }
    }

    const activeHoldings = Object.entries(holdingsAggregated)
        .filter(([, data]) => data.quantity > 0)
        .reduce<Record<string, { quantity: number; currency: string; earliestTradeDate: Date }>>((acc, [symbol, data]) => {
            acc[symbol] = data;
            return acc;
        }, {});

    if (Object.keys(activeHoldings).length === 0) {
        return [];
    }

    const activeEntries = Object.values(activeHoldings);
    const earliestActiveTradeDate = activeEntries.reduce((min, entry) =>
        entry.earliestTradeDate < min ? entry.earliestTradeDate : min
    , activeEntries[0].earliestTradeDate);

    const { startDate, endDate, dateStrings } = buildDateRange(range, earliestActiveTradeDate);

    const priceMaps: Record<string, Record<string, number>> = {};
    await Promise.all(
        Object.keys(activeHoldings).map(async (symbol) => {
            priceMaps[symbol] = await fetchDailyCloses(symbol, startDate, endDate);
        })
    );

    const currencies = new Set<string>([baseCurrency, ...Object.values(activeHoldings).map((h) => h.currency)]);
    const fxRates = await getFxRatesForCurrencies(Array.from(currencies), baseCurrency);

    const points: PortfolioPerformancePoint[] = [];
    const lastCloseBySymbol: Record<string, number | undefined> = {};
    const hasPositions = Object.keys(activeHoldings).length > 0;
    const startDateStr = dateStrings[0] ?? normalizeDateString(startDate);
    const endDateStr = dateStrings[dateStrings.length - 1] ?? normalizeDateString(endDate);

    const logAndReturn = (items: PortfolioPerformancePoint[]) => {
        if (process.env.NODE_ENV !== 'production') {
            const allEqual = items.every((p) => p.portfolioValue === (items[0]?.portfolioValue ?? 0));
            console.log(
                '[getPortfolioPerformanceSeries] portfolioId=%s range=%s points=%d first=%o last=%o allEqual=%s',
                portfolioId,
                range,
                items.length,
                items[0] ? { date: items[0].date, value: items[0].value ?? items[0].portfolioValue } : null,
                items[items.length - 1]
                    ? { date: items[items.length - 1].date, value: items[items.length - 1].value ?? items[items.length - 1].portfolioValue }
                    : null,
                allEqual
            );
        }
        return items;
    };

    for (const dateStr of dateStrings) {
        let portfolioValue = 0;
        let hasAnyPrice = false;

        for (const [symbol, holding] of Object.entries(activeHoldings)) {
            const qty = holding.quantity;
            if (!qty) continue;

            const symbolPrices = priceMaps[symbol] ?? {};
            let close = symbolPrices[dateStr];
            if (typeof close !== 'number') {
                close = lastCloseBySymbol[symbol];
            }
            if (typeof close !== 'number') continue;

            const fxRateCandidate = holding.currency === baseCurrency ? 1 : fxRates[holding.currency] ?? 1;
            const fxRate = typeof fxRateCandidate === 'number' && fxRateCandidate > 0 ? fxRateCandidate : 1;
            hasAnyPrice = true;
            lastCloseBySymbol[symbol] = close;
            portfolioValue += qty * close * fxRate;
        }

        if (hasAnyPrice) {
            points.push({
                date: dateStr,
                portfolioValue,
                investedCapital: 0, // placeholder; will be implemented in a later PR
                unrealizedPnL: 0, // placeholder; will be implemented in a later PR
                value: portfolioValue,
            });
        }
    }

    if (points.length >= 2) {
        return logAndReturn(points);
    }

    if (!allowFallbackFlatSeries) {
        return logAndReturn(points);
    }

    if (hasPositions && points.length === 1) {
        const single = points[0];
        const expanded: PortfolioPerformancePoint[] = [];

        expanded.push({ ...single, date: startDateStr });
        expanded.push({ ...single, date: endDateStr });

        return logAndReturn(expanded);
    }

    if (hasPositions && points.length === 0) {
        const summary = await getPortfolioSummary(userId, portfolioId);
        const currentValue = summary?.totals?.currentValue ?? 0;

        if (currentValue > 0) {
            const fallback: PortfolioPerformancePoint[] = [
                {
                    date: startDateStr,
                    portfolioValue: currentValue,
                    investedCapital: 0,
                    unrealizedPnL: 0,
                    value: currentValue,
                },
                {
                    date: endDateStr,
                    portfolioValue: currentValue,
                    investedCapital: 0,
                    unrealizedPnL: 0,
                    value: currentValue,
                },
            ];

            return logAndReturn(fallback);
        }
    }

    return logAndReturn(points);
}

export type { PortfolioDocument, TransactionDocument };
