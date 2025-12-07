import { connectToDatabase } from '@/database/mongoose';
import { Portfolio, type PortfolioDocument } from '@/database/models/portfolio.model';
import { Transaction, type TransactionDocument } from '@/database/models/transaction.model';
import { getSnapshotsForSymbols } from '@/lib/actions/finnhub.actions';
import { fetchJSON } from '@/lib/actions/finnhub.actions';
import { getFxRateLatest } from '@/lib/finnhub/fx';
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
    date: string; // ISO yyyy-mm-dd
    portfolioValue: number; // total portfolio value in base currency
    investedCapital: number;
    unrealizedPnL: number;
    value: number; // legacy alias == portfolioValue
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

            const rate = await getFxRateLatest(normalized, normalizedBase);
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
    range: PortfolioPerformanceRange,
    _options?: { allowFallbackFlatSeries?: boolean }
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
    const currencies = new Set<string>(transactions.map((tx) => (tx.currency || baseCurrency).toUpperCase()));
    currencies.add(baseCurrency);
    const fxRates = await getFxRatesForCurrencies(Array.from(currencies), baseCurrency);

    const resolveFxRate = async (currency: string) => {
        const normalized = currency.toUpperCase();
        if (normalized === baseCurrency) return 1;
        const cached = fxRates[normalized];
        if (typeof cached === 'number' && cached > 0) return cached;
        const fetched = await getFxRateLatest(normalized, baseCurrency);
        fxRates[normalized] = fetched;
        return fetched;
    };

    const today = startOfDay(new Date());
    const earliestTxDate = startOfDay(new Date(transactions[0].tradeDate));

    const rangeStartRaw = getRangeStartDate(range, today);
    const startDate = range === 'MAX' ? earliestTxDate : startDateAfterEarliest(rangeStartRaw, earliestTxDate);

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

    const hasHistoricalPrices = Object.values(priceMaps).some((map) => Object.keys(map).length > 0);

    type TxSummary = { date: Date; quantity: number; cost: number };
    const txsBySymbol: Record<string, { currency: string; txs: TxSummary[] }> = {};
    for (const tx of transactions) {
        const symbol = tx.symbol.toUpperCase();
        const signedQty = tx.type === 'SELL' ? -Math.abs(tx.quantity) : Math.abs(tx.quantity);
        const txCurrency = (tx.currency || baseCurrency).toUpperCase();
        const fxRateCandidate = await resolveFxRate(txCurrency);
        const fxRate =
            txCurrency === baseCurrency
                ? 1
                : typeof tx.fxRateToBase === 'number' && tx.fxRateToBase > 0
                  ? tx.fxRateToBase
                  : fxRateCandidate;
        const totalValueBase = tx.price * Math.abs(tx.quantity) * fxRate;

        if (!txsBySymbol[symbol]) txsBySymbol[symbol] = { currency: txCurrency, txs: [] };
        txsBySymbol[symbol].txs.push({
            date: startOfDay(new Date(tx.tradeDate)),
            quantity: signedQty,
            cost: tx.type === 'SELL' ? -totalValueBase : totalValueBase,
        });
        if (!txsBySymbol[symbol].currency) {
            txsBySymbol[symbol].currency = txCurrency;
        }
    }

    Object.values(txsBySymbol).forEach((entry) => entry.txs.sort((a, b) => a.date.getTime() - b.date.getTime()));

    type SymbolState = {
        idx: number;
        quantity: number;
        totalCost: number;
        txs: TxSummary[];
        lastPrice?: number;
        fxRate: number;
    };
    const stateBySymbol: Record<string, SymbolState> = {};
    for (const symbol of symbols) {
        const txGroup = txsBySymbol[symbol];
        const symbolCurrency = txGroup?.currency || baseCurrency;
        const fxRate = await resolveFxRate(symbolCurrency);
        stateBySymbol[symbol] = {
            idx: 0,
            quantity: 0,
            totalCost: 0,
            txs: txGroup?.txs ?? [],
            lastPrice: undefined,
            fxRate,
        };
    }

    const series: PortfolioPerformancePoint[] = [];

    for (const dateStr of dateStrings) {
        const currentDate = startOfDay(new Date(dateStr));
        let totalValue = 0;
        let totalInvested = 0;

        for (const symbol of symbols) {
            const state = stateBySymbol[symbol];
            const txs = state?.txs ?? [];

            while (state.idx < txs.length && txs[state.idx].date.getTime() <= currentDate.getTime()) {
                state.quantity += txs[state.idx].quantity;
                state.totalCost += txs[state.idx].cost;
                state.idx += 1;
            }

            const priceOnDate = priceMaps[symbol]?.[dateStr];
            if (typeof priceOnDate === 'number') {
                state.lastPrice = priceOnDate;
            }

            if (typeof state.lastPrice !== 'number' || state.quantity === 0) {
                continue;
            }

            const positionValue = state.quantity * state.lastPrice * (state.fxRate || 1);
            const invested = Math.max(state.totalCost, 0);

            totalValue += positionValue;
            totalInvested += invested;
        }

        const unrealizedPnL = totalValue - totalInvested;

        series.push({
            date: dateStr,
            portfolioValue: totalValue,
            investedCapital: totalInvested,
            unrealizedPnL,
            value: totalValue,
        });
    }

    if (process.env.NODE_ENV !== 'production') {
        console.log(
            '[getPortfolioPerformanceSeries] sample',
            series.slice(0, 10).map((p) => ({
                date: p.date,
                value: p.portfolioValue ?? p.value,
            }))
        );
    }

    const hasNonZeroSeries = series.some((point) => Number.isFinite(point.portfolioValue) && point.portfolioValue > 0);

    if ((!hasHistoricalPrices || !hasNonZeroSeries) && symbols.length > 0) {
        const snapshots = await getSnapshotsForSymbols(symbols);
        let currentValue = 0;
        let investedCapital = 0;

        for (const symbol of symbols) {
            const state = stateBySymbol[symbol];
            const quantity = state?.quantity ?? 0;
            if (!quantity || quantity <= 0) continue;

            const snapshotPrice = snapshots[symbol]?.currentPrice;
            if (typeof snapshotPrice !== 'number' || snapshotPrice <= 0) continue;

            const fxRate = state?.fxRate ?? 1;
            currentValue += quantity * snapshotPrice * fxRate;
            investedCapital += Math.max(state?.totalCost ?? 0, 0);
        }

        if (currentValue > 0) {
            const fallbackSeries = dateStrings.map((date) => ({
                date,
                portfolioValue: currentValue,
                investedCapital,
                unrealizedPnL: currentValue - investedCapital,
                value: currentValue,
            }));

            if (process.env.NODE_ENV !== 'production') {
                console.log(
                    '[getPortfolioPerformanceSeries] sample',
                    fallbackSeries.slice(0, 10).map((p) => ({
                        date: p.date,
                        value: p.portfolioValue ?? p.value,
                    }))
                );
            }

            return fallbackSeries;
        }
    }

    return series;
}

const startDateAfterEarliest = (candidate: Date, earliest: Date) => {
    return candidate < earliest ? earliest : candidate;
};

export type { PortfolioDocument, TransactionDocument };
