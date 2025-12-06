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
    portfolioValue: number; // portfolio market value in base currency
    investedCapital: number; // cumulative invested amount in base currency
    unrealizedPnL: number; // portfolioValue - investedCapital
    /**
     * Legacy alias used by ratio helpers; equal to portfolioValue.
     * Keep it populated so existing metrics continue to work.
     */
    value: number;
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

export async function convertToBaseCurrency(
    amount: number,
    fromCurrency: string,
    baseCurrency: string,
    fxCache?: Map<string, number>
): Promise<number> {
    const normalizedFrom = fromCurrency?.trim().toUpperCase();
    const normalizedBase = baseCurrency?.trim().toUpperCase();

    if (!normalizedFrom || !normalizedBase) return amount;
    if (normalizedFrom === normalizedBase) return amount;

    const rate = await getFxRate(normalizedFrom, normalizedBase, fxCache);
    return amount * (rate || 1);
}

/*
Example walkthrough for clarity:
10 AAPL shares priced at 278.78 USD each → 2,787.80 USD.
If the portfolio base currency is EUR and fx(USD→EUR) = 0.92, the same holding is valued at
2,787.80 * 0.92 ≈ 2,564.78 EUR. USD and EUR bases therefore show different numeric totals.
*/

if (process.env.NODE_ENV === 'test-metrics') {
    // Identity conversion sanity check (no network call because currencies match)
    void (async () => {
        const identity = await convertToBaseCurrency(123.45, 'USD', 'USD');
        console.assert(identity === 123.45, 'convertToBaseCurrency identity sanity');
    })();
}

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

export async function getPortfolioRatios(userId: string, portfolioId: string): Promise<PortfolioRatios> {
    try {
        await connectToDatabase();
        const portfolio = await Portfolio.findOne({ _id: portfolioId, userId }).lean();
        if (!portfolio) return emptyRatios;

        const baseCurrency = (portfolio.baseCurrency || 'USD').toUpperCase();
        const fxCache = new Map<string, number>();

        let range: PortfolioPerformanceRange = '1Y';
        let points = await getPortfolioPerformanceSeries(userId, portfolioId, range);

        if (!points || points.length < 2) {
            range = 'MAX';
            points = await getPortfolioPerformanceSeries(userId, portfolioId, range);
        }

        if (!points || points.length < 2) {
            return emptyRatios;
        }

        const startDate = startOfDay(new Date(points[0].date));
        const endDate = startOfDay(new Date(points[points.length - 1].date));

        const benchmarkClosesRaw = await fetchDailyCloses(BENCHMARK_SYMBOL, startDate, endDate);
        const benchmarkCloses: Record<string, number> = {};
        await Promise.all(
            Object.entries(benchmarkClosesRaw).map(async ([date, close]) => {
                // Finnhub benchmark closes are USD; convert for base currency comparisons.
                benchmarkCloses[date] = await convertToBaseCurrency(close, 'USD', baseCurrency, fxCache);
            })
        );

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
    const fxCache = new Map<string, number>();

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
        const signedQty = tx.type === 'SELL' ? -Math.abs(tx.quantity) : Math.abs(tx.quantity);
        const totalValue = await convertToBaseCurrency(
            tx.price * Math.abs(tx.quantity),
            txCurrency,
            baseCurrency,
            fxCache
        );

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
        const priceInBase = await convertToBaseCurrency(currentPrice, positionCurrency, baseCurrency, fxCache);
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

const fetchDailyCloses = async (symbol: string, from: Date, to: Date): Promise<Record<string, number>> => {
    const token = process.env.FINNHUB_API_KEY ?? process.env.NEXT_PUBLIC_FINNHUB_API_KEY ?? '';
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

export async function getPortfolioPerformanceSeries(
    userId: string,
    portfolioId: string,
    range: PortfolioPerformanceRange
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
    if (transactions.length === 0) return [];

    const baseCurrency = (portfolio.baseCurrency || 'USD').toUpperCase();
    const fxCache = new Map<string, number>();

    const today = startOfDay(new Date());
    const earliestTxDate = startOfDay(new Date(transactions[0].tradeDate));

    const rangeStartRaw = getRangeStartDate(range, today);
    const startDate = range === 'MAX' ? earliestTxDate : startDateAfterEarliest(rangeStartRaw, earliestTxDate);

    const dateStrings: string[] = [];
    const dateCursor = new Date(startDate);
    while (dateCursor <= today) {
        dateStrings.push(normalizeDateString(dateCursor));
        dateCursor.setUTCDate(dateCursor.getUTCDate() + 1);
    }

    const symbols = Array.from(new Set(transactions.map((tx) => tx.symbol.toUpperCase())));
    const snapshots = symbols.length > 0 ? await getSnapshotsForSymbols(symbols) : {};

    const priceMaps: Record<string, Record<string, number>> = {};
    await Promise.all(
        symbols.map(async (symbol) => {
            priceMaps[symbol] = await fetchDailyCloses(symbol, startDate, today);
        })
    );

    type TxEvent = {
        date: Date;
        symbol: string;
        quantityChange: number;
        tradeValueBase: number;
        currency: string;
    };

    const txEvents: TxEvent[] = [];
    for (const tx of transactions) {
        const symbol = tx.symbol.toUpperCase();
        const currency = (tx.currency || baseCurrency).toUpperCase();
        const signedQty = tx.type === 'SELL' ? -Math.abs(tx.quantity) : Math.abs(tx.quantity);
        const tradeNotional = tx.price * Math.abs(tx.quantity);
        const tradeValueBase = await convertToBaseCurrency(tradeNotional, currency, baseCurrency, fxCache);

        txEvents.push({
            date: startOfDay(new Date(tx.tradeDate)),
            symbol,
            quantityChange: signedQty,
            tradeValueBase: tx.type === 'SELL' ? -tradeValueBase : tradeValueBase,
            currency,
        });
    }

    txEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

    const symbolCurrencies: Record<string, string> = {};
    txEvents.forEach((tx) => {
        if (!symbolCurrencies[tx.symbol]) {
            symbolCurrencies[tx.symbol] = tx.currency;
        }
    });

    const stateBySymbol: Record<
        string,
        { quantity: number; lastPrice: number | null; fxMultiplier: number; snapshotPrice?: number }
    > = {};

    await Promise.all(
        symbols.map(async (symbol) => {
            const currency = symbolCurrencies[symbol] || baseCurrency;
            const fxMultiplier = await convertToBaseCurrency(1, currency, baseCurrency, fxCache);
            const snapshotPrice = snapshots[symbol]?.currentPrice;
            stateBySymbol[symbol] = {
                quantity: 0,
                lastPrice: snapshotPrice ?? null,
                fxMultiplier,
                snapshotPrice: snapshotPrice ?? undefined,
            };
        })
    );

    let txIdx = 0;
    let investedCapital = 0;
    const points: PortfolioPerformancePoint[] = [];

    for (const dateStr of dateStrings) {
        const currentDate = startOfDay(new Date(dateStr));

        while (txIdx < txEvents.length && txEvents[txIdx].date.getTime() <= currentDate.getTime()) {
            const event = txEvents[txIdx];
            investedCapital += event.tradeValueBase;

            const state = stateBySymbol[event.symbol];
            if (state) {
                state.quantity += event.quantityChange;
            }

            txIdx += 1;
        }

        let totalValue = 0;

        for (const symbol of symbols) {
            const state = stateBySymbol[symbol];
            if (!state) continue;

            const priceOnDate = priceMaps[symbol]?.[dateStr];
            if (typeof priceOnDate === 'number') {
                state.lastPrice = priceOnDate;
            } else if (state.lastPrice == null && typeof state.snapshotPrice === 'number') {
                state.lastPrice = state.snapshotPrice;
            }

            if (state.quantity <= 0 || typeof state.lastPrice !== 'number') continue;

            totalValue += state.quantity * state.lastPrice * (state.fxMultiplier || 1);
        }

        const portfolioValue = totalValue;
        points.push({
            date: dateStr,
            portfolioValue,
            investedCapital,
            unrealizedPnL: portfolioValue - investedCapital,
            value: portfolioValue,
        });
    }

    const hasValuedPoints = points.some((p) => p.portfolioValue > 0);

    if (!hasValuedPoints) {
        console.warn(
            `getPortfolioPerformanceSeries: no valued points computed for portfolio ${portfolioId} in range ${range}`
        );
        return [];
    }

    return points;
}

const startDateAfterEarliest = (candidate: Date, earliest: Date) => {
    return candidate < earliest ? earliest : candidate;
};

export type { PortfolioDocument, TransactionDocument };
