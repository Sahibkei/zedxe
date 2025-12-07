/**
 * Portfolio performance engine
 *
 * Models used:
 * - Portfolio (database/models/portfolio.model.ts): provides baseCurrency + ownership metadata
 * - Transaction (database/models/transaction.model.ts): BUY/SELL events with quantity/price per symbol
 *   (when no historical transactions exist, we fall back to the current holdings snapshot derived from
 *   aggregated transaction quantities so the chart still renders a meaningful equity curve)
 *
 * Price utilities re-used:
 * - fetchJSON from lib/actions/finnhub.actions.ts for Finnhub candle requests
 *
 * Notes:
 * - FX conversion is intentionally ignored for now; all values are treated as if already in the portfolio base currency.
 * - Weekly Inngest reports rely on the exported getPortfolioPerformanceSeries wrapper in portfolio-service.ts.
 */
import { connectToDatabase } from '@/database/mongoose';
import { Portfolio } from '@/database/models/portfolio.model';
import { Transaction } from '@/database/models/transaction.model';
import { fetchJSON } from '@/lib/actions/finnhub.actions';

export type PortfolioPerformanceRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'YTD' | 'MAX';

export interface PortfolioPerformancePoint {
    date: string; // ISO date
    portfolioValue: number;
    returnPct: number;
}

export interface PortfolioPerformanceSeries {
    portfolioId: string;
    timeframe: PortfolioPerformanceRange;
    points: PortfolioPerformancePoint[];
    currentValue: number;
    startingValue: number;
    totalReturnPct: number;
}

type FinnhubCandleResponse = { c?: number[]; t?: number[]; s?: 'ok' | 'no_data' | string };

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

const normalizeDateString = (value: Date) => value.toISOString().slice(0, 10);

const startOfDay = (value: Date) => {
    const d = new Date(value);
    d.setUTCHours(0, 0, 0, 0);
    return d;
};

const startDateAfterEarliest = (candidate: Date, earliest: Date) => {
    return candidate < earliest ? earliest : candidate;
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
        return {};
    }
};

const computeReturnPct = (value: number, start: number) => {
    if (start === 0) return 0;
    return ((value / start - 1) * 100);
};

export async function getPortfolioPerformanceSeries(
    userId: string,
    portfolioId: string,
    range: PortfolioPerformanceRange,
    options?: { allowFallbackFlatSeries?: boolean }
): Promise<PortfolioPerformanceSeries> {
    if (!userId || !portfolioId) {
        throw new Error('Missing user or portfolio id');
    }

    await connectToDatabase();

    const portfolio = await Portfolio.findOne({ _id: portfolioId, userId }).lean();
    if (!portfolio) {
        throw new Error('Portfolio not found');
    }

    const transactions = await Transaction.find({ userId, portfolioId }).sort({ tradeDate: 1 }).lean();

    const today = startOfDay(new Date());
    const earliestTxDate = transactions.length > 0 ? startOfDay(new Date(transactions[0].tradeDate)) : today;
    const rangeStartRaw = getRangeStartDate(range, today);
    const startDate = range === 'MAX' && transactions.length > 0 ? earliestTxDate : startDateAfterEarliest(rangeStartRaw, earliestTxDate);

    const dateCursor = new Date(startDate);
    const dateStrings: string[] = [];
    while (dateCursor <= today) {
        dateStrings.push(normalizeDateString(dateCursor));
        dateCursor.setUTCDate(dateCursor.getUTCDate() + 1);
    }

    const symbols = Array.from(new Set(transactions.map((tx) => tx.symbol.toUpperCase())));
    const priceMaps: Record<string, Record<string, number>> = {};
    await Promise.all(
        symbols.map(async (symbol) => {
            priceMaps[symbol] = await fetchDailyCloses(symbol, startDate, today);
        })
    );

    type TxSummary = { date: Date; quantity: number };
    const txsBySymbol: Record<string, TxSummary[]> = {};
    const holdingsSnapshot: Record<string, number> = {};
    for (const tx of transactions) {
        const symbol = tx.symbol.toUpperCase();
        const signedQty = tx.type === 'SELL' ? -Math.abs(tx.quantity) : Math.abs(tx.quantity);
        if (!txsBySymbol[symbol]) txsBySymbol[symbol] = [];
        txsBySymbol[symbol].push({ date: startOfDay(new Date(tx.tradeDate)), quantity: signedQty });
        holdingsSnapshot[symbol] = (holdingsSnapshot[symbol] || 0) + signedQty;
    }

    Object.values(txsBySymbol).forEach((entry) => entry.sort((a, b) => a.date.getTime() - b.date.getTime()));

    type SymbolState = { idx: number; quantity: number; txs: TxSummary[]; lastPrice: number | null };
    const stateBySymbol: Record<string, SymbolState> = {};
    for (const symbol of symbols) {
        const txs = txsBySymbol[symbol] || [];
        stateBySymbol[symbol] = { idx: 0, quantity: 0, txs, lastPrice: null };
    }

    const rawPoints: Array<{ date: string; portfolioValue: number }> = [];

    for (const dateStr of dateStrings) {
        const currentDate = startOfDay(new Date(dateStr));
        let totalValue = 0;

        for (const symbol of symbols) {
            const state = stateBySymbol[symbol];
            const txs = state?.txs ?? [];

            while (state.idx < txs.length && txs[state.idx].date.getTime() <= currentDate.getTime()) {
                state.quantity += txs[state.idx].quantity;
                state.idx += 1;
            }

            if (state.quantity === 0 && state.lastPrice == null) {
                continue;
            }

            const priceOnDate = priceMaps[symbol]?.[dateStr];
            if (typeof priceOnDate === 'number') {
                state.lastPrice = priceOnDate;
            }

            if (typeof state.lastPrice !== 'number') {
                continue;
            }

            totalValue += state.quantity * state.lastPrice;
        }

        rawPoints.push({ date: dateStr, portfolioValue: totalValue });
    }

    const allowFallbackFlatSeries = options?.allowFallbackFlatSeries ?? true;
    const hasNonZero = rawPoints.some((p) => p.portfolioValue > 0);

    const buildFromHoldingsSnapshot = (): PortfolioPerformanceSeries => {
        const snapshotSymbols = Object.entries(holdingsSnapshot)
            .filter(([, qty]) => qty > 0)
            .map(([sym]) => sym);

        if (snapshotSymbols.length === 0) {
            return {
                portfolioId,
                timeframe: range,
                points: [],
                currentValue: 0,
                startingValue: 0,
                totalReturnPct: 0,
            };
        }

        const rawSnapshotPoints: Array<{ date: string; portfolioValue: number }> = [];
        const state: Record<string, { qty: number; lastPrice: number | null }> = {};
        for (const sym of snapshotSymbols) {
            state[sym] = { qty: holdingsSnapshot[sym], lastPrice: null };
        }

        for (const dateStr of dateStrings) {
            let totalValue = 0;
            for (const sym of snapshotSymbols) {
                const priceOnDate = priceMaps[sym]?.[dateStr];
                if (typeof priceOnDate === 'number') {
                    state[sym].lastPrice = priceOnDate;
                }

                if (typeof state[sym].lastPrice !== 'number') continue;

                totalValue += state[sym].qty * state[sym].lastPrice;
            }
            rawSnapshotPoints.push({ date: dateStr, portfolioValue: totalValue });
        }

        const firstNonZeroSnapshot = rawSnapshotPoints.find((p) => p.portfolioValue > 0)?.portfolioValue ?? 0;
        const pointsWithReturnsSnapshot: PortfolioPerformancePoint[] = rawSnapshotPoints.map((p) => ({
            date: p.date,
            portfolioValue: p.portfolioValue,
            returnPct: computeReturnPct(p.portfolioValue, firstNonZeroSnapshot || p.portfolioValue || 0),
        }));

        const startingValueSnapshot = pointsWithReturnsSnapshot[0]?.portfolioValue ?? 0;
        const currentValueSnapshot = pointsWithReturnsSnapshot[pointsWithReturnsSnapshot.length - 1]?.portfolioValue ?? 0;
        const totalReturnPctSnapshot = computeReturnPct(currentValueSnapshot, startingValueSnapshot || firstNonZeroSnapshot || 0);

        return {
            portfolioId,
            timeframe: range,
            points: pointsWithReturnsSnapshot,
            currentValue: currentValueSnapshot,
            startingValue: startingValueSnapshot,
            totalReturnPct: totalReturnPctSnapshot,
        };
    };

    const pointsWithReturns: PortfolioPerformancePoint[] = [];
    const firstNonZero = rawPoints.find((p) => p.portfolioValue > 0)?.portfolioValue ?? rawPoints[0]?.portfolioValue ?? 0;

    for (const point of rawPoints) {
        const start = firstNonZero || 0;
        const pct = computeReturnPct(point.portfolioValue, start);
        pointsWithReturns.push({ date: point.date, portfolioValue: point.portfolioValue, returnPct: pct });
    }

    if (!hasNonZero) {
        // If transactions-based series has no value (e.g., missing history), fall back to the holdings snapshot first
        const snapshotSeries = buildFromHoldingsSnapshot();
        if (snapshotSeries.points.length > 0) {
            return snapshotSeries;
        }

        if (allowFallbackFlatSeries && pointsWithReturns.length > 0) {
            const fallbackValue = pointsWithReturns[pointsWithReturns.length - 1]?.portfolioValue ?? 0;
            const fallbackPoints = pointsWithReturns.map((p) => ({ ...p, portfolioValue: fallbackValue, returnPct: 0 }));
            return {
                portfolioId,
                timeframe: range,
                points: fallbackPoints,
                currentValue: fallbackValue,
                startingValue: fallbackValue,
                totalReturnPct: 0,
            };
        }
    }

    const startingValue = pointsWithReturns[0]?.portfolioValue ?? 0;
    const currentValue = pointsWithReturns[pointsWithReturns.length - 1]?.portfolioValue ?? 0;
    const totalReturnPct = computeReturnPct(currentValue, startingValue || firstNonZero || 0);

    return {
        portfolioId,
        timeframe: range,
        points: pointsWithReturns,
        currentValue,
        startingValue,
        totalReturnPct,
    };
}

