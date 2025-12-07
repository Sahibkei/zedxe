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

export type PortfolioPerformancePoint = {
    date: string; // ISO date string (YYYY-MM-DD)
    value: number; // portfolio market value in base currency
};

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

const getRangeStartDate = (range: PortfolioPerformanceRange, today: Date): Date => {
    const start = new Date(today);
    switch (range) {
        case '1D':
            start.setUTCDate(start.getUTCDate() - 1);
            break;
        case '1W':
            start.setUTCDate(start.getUTCDate() - 6);
            break;
        case '1M':
            start.setUTCDate(start.getUTCDate() - 29);
            break;
        case '3M':
            start.setUTCDate(start.getUTCDate() - 89);
            break;
        case '6M':
            start.setUTCDate(start.getUTCDate() - 179);
            break;
        case '1Y':
            start.setUTCDate(start.getUTCDate() - 364);
            break;
        case 'YTD':
            start.setUTCMonth(0, 1);
            start.setUTCHours(0, 0, 0, 0);
            break;
        case 'MAX':
        default:
            break;
    }
    return startOfDay(start);
};

const buildDateStrings = (startDate: Date, endDate: Date): string[] => {
    const dateCursor = startOfDay(startDate);
    const end = startOfDay(endDate);
    const dateStrings: string[] = [];

    while (dateCursor <= end) {
        dateStrings.push(normalizeDateString(dateCursor));
        dateCursor.setUTCDate(dateCursor.getUTCDate() + 1);
    }

    return dateStrings;
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

const fetchPricesForSymbols = async (symbols: string[], startDate: Date, endDate: Date) => {
    const priceMaps: Record<string, Record<string, number>> = {};

    await Promise.all(
        symbols.map(async (symbol) => {
            priceMaps[symbol] = await fetchDailyCloses(symbol, startDate, endDate);
        })
    );

    return priceMaps;
};

const findLastKnownClose = (
    priceMap: Record<string, number>,
    dateStr: string,
    dateStrings: string[],
    maxDaysBack?: number
): number | undefined => {
    const targetIndex = dateStrings.indexOf(dateStr);
    if (targetIndex === -1) return undefined;

    const minIndex = typeof maxDaysBack === 'number' ? Math.max(0, targetIndex - maxDaysBack) : 0;
    for (let i = targetIndex; i >= minIndex; i--) {
        const candidate = priceMap[dateStrings[i]];
        if (typeof candidate === 'number') return candidate;
    }

    return undefined;
};

export async function getPortfolioPerformanceSeries(
    userId: string,
    portfolioId: string,
    range: PortfolioPerformanceRange,
    options?: { allowFallbackFlatSeries?: boolean }
): Promise<PortfolioPerformancePoint[]> {
    if (!userId || !portfolioId) {
        throw new Error('Missing user or portfolio id');
    }

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
    type Holding = { symbol: string; netQuantity: number; tradeCurrency: string; earliestTradeDate: Date };
    const holdingsMap: Record<string, Holding> = {};

    for (const tx of transactions) {
        const symbol = tx.symbol.toUpperCase();
        const quantity = tx.type === 'SELL' ? -Math.abs(tx.quantity) : Math.abs(tx.quantity);
        const tradeCurrency = (tx.currency || baseCurrency).toUpperCase();
        const tradeDate = startOfDay(new Date(tx.tradeDate));

        if (!holdingsMap[symbol]) {
            holdingsMap[symbol] = {
                symbol,
                netQuantity: 0,
                tradeCurrency,
                earliestTradeDate: tradeDate,
            };
        }

        holdingsMap[symbol].netQuantity += quantity;
        if (tradeDate < holdingsMap[symbol].earliestTradeDate) {
            holdingsMap[symbol].earliestTradeDate = tradeDate;
        }
        if (!holdingsMap[symbol].tradeCurrency) {
            holdingsMap[symbol].tradeCurrency = tradeCurrency;
        }
    }

    const holdings = Object.values(holdingsMap).filter((holding) => holding.netQuantity > 0);
    if (holdings.length === 0) {
        return [];
    }

    const earliestActiveTrade = holdings.reduce((min, h) => (h.earliestTradeDate < min ? h.earliestTradeDate : min), holdings[0].earliestTradeDate);

    const today = startOfDay(new Date());
    const rawRangeStart = getRangeStartDate(range, today);
    const rangeStart = range === 'MAX' ? earliestActiveTrade : startDateAfterEarliest(rawRangeStart, earliestActiveTrade);
    const dateStrings = buildDateStrings(rangeStart, today);

    const tradeCurrencies = Array.from(new Set(holdings.map((h) => h.tradeCurrency)));
    tradeCurrencies.push(baseCurrency);
    const fxRates = await getFxRatesForCurrencies(tradeCurrencies, baseCurrency);

    const symbols = holdings.map((h) => h.symbol);
    const symbolPrices = await fetchPricesForSymbols(symbols, rangeStart, today);

    const points: PortfolioPerformancePoint[] = dateStrings.map((dateStr) => {
        let totalValue = 0;

        for (const holding of holdings) {
            const priceMap = symbolPrices[holding.symbol] || {};
            const close = priceMap[dateStr] ?? findLastKnownClose(priceMap, dateStr, dateStrings);
            if (typeof close !== 'number') continue;

            const fxRate = holding.tradeCurrency === baseCurrency ? 1 : fxRates[holding.tradeCurrency] ?? 1;
            totalValue += holding.netQuantity * close * fxRate;
        }

        return { date: dateStr, value: totalValue };
    });

    const allowFallbackFlatSeries = options?.allowFallbackFlatSeries ?? true;
    const hasNonZero = points.some((p) => p.value > 0);

    if (!hasNonZero && allowFallbackFlatSeries) {
        const summary = await getPortfolioSummary(userId, portfolioId);
        const currentValue = summary.totals.currentValue;

        return dateStrings.map((dateStr) => ({ date: dateStr, value: currentValue }));
    }

    return points;
}

const startDateAfterEarliest = (candidate: Date, earliest: Date) => {
    return candidate < earliest ? earliest : candidate;
};

export type { PortfolioDocument, TransactionDocument };
