import 'server-only';

import { getFinnhubFinancials, getFinnhubMetrics, getFinnhubProfile, getFinnhubQuote } from './providers/finnhub';
import { getRecentSecFilings } from './providers/sec';
import type {
    FinancialsMapperFn,
    FilingInfo,
    FilingsMapperFn,
    ProfileMapperFn,
    RatioMapperFn,
    StockFinancialRow,
    StockProfileV2Model,
} from './stockProfileV2.types';

function normalizeSymbol(input: string) {
    const symbolRaw = (input || '').trim();
    const upper = symbolRaw.toUpperCase();
    const hasExchange = upper.includes(':');
    const finnhubSymbol = hasExchange ? upper.split(':')[1] || upper : upper;
    const tvSymbol = hasExchange ? upper : `NASDAQ:${upper}`;
    const secTicker = finnhubSymbol;

    return { symbolRaw, finnhubSymbol, tvSymbol, secTicker };
}

const QUARTER_FROM_MONTH = [
    { months: [0, 1, 2], quarter: 1 },
    { months: [3, 4, 5], quarter: 2 },
    { months: [6, 7, 8], quarter: 3 },
    { months: [9, 10, 11], quarter: 4 },
];

function deriveQuarter(dateString?: string) {
    if (!dateString) return undefined;
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return undefined;
    const month = date.getUTCMonth();
    const found = QUARTER_FROM_MONTH.find((q) => q.months.includes(month));
    return found?.quarter;
}

const pickValue = (items: { concept?: string; label?: string; value?: number }[] | undefined, concepts: string[]) => {
    if (!items) return undefined;
    for (const concept of concepts) {
        const found = items.find((i) => i.concept?.toLowerCase() === concept.toLowerCase());
        if (found?.value !== undefined) return found.value;
    }

    // fallback: match by label contains
    for (const concept of concepts) {
        const found = items.find((i) => i.label?.toLowerCase().includes(concept.toLowerCase()));
        if (found?.value !== undefined) return found.value;
    }

    return undefined;
};

const mapFinancials: FinancialsMapperFn = ({ financials, limit = 8, frequency }) => {
    const rows: StockFinancialRow[] = [];
    const entries = financials?.data || [];
    const seen = new Set<string>();

    entries
        .slice()
        .sort((a, b) => {
            const aTime = a?.endDate ? new Date(a.endDate).getTime() : 0;
            const bTime = b?.endDate ? new Date(b.endDate).getTime() : 0;
            return bTime - aTime;
        })
        .forEach((entry) => {
            const endDate = entry.endDate;
            const year = endDate ? new Date(endDate).getUTCFullYear() : entry.year;
            if (!year) return;
            const quarter = entry.quarter ?? deriveQuarter(endDate);
            const dedupeKey = frequency === 'annual' ? String(year) : quarter ? `${year}-Q${quarter}` : undefined;
            if (!dedupeKey || seen.has(dedupeKey)) return;
            seen.add(dedupeKey);

            const ic = entry.report?.ic;
            const cf = entry.report?.cf;

            const revenue = pickValue(ic, ['us-gaap:Revenues', 'us-gaap:SalesRevenueNet', 'revenue']);
            const operatingIncome = pickValue(ic, ['us-gaap:OperatingIncomeLoss', 'operating income']);
            const netIncome = pickValue(ic, ['us-gaap:NetIncomeLoss', 'net income']);
            const eps = pickValue(ic, ['us-gaap:EarningsPerShareDiluted', 'eps diluted', 'eps']);
            const operatingCashFlow = pickValue(cf, [
                'us-gaap:NetCashProvidedByUsedInOperatingActivities',
                'operating cash flow',
            ]);

            const label = frequency === 'annual' ? `FY ${year}` : `Q${quarter} ${year}`;

            rows.push({
                label: label.trim(),
                endDate,
                revenue,
                operatingIncome,
                netIncome,
                eps,
                operatingCashFlow,
                currency: entry.currency,
            });
        });

    return rows.slice(0, limit);
};

const mapFilings: FilingsMapperFn = (filingsResp) => {
    const filings: FilingInfo[] = filingsResp?.filings || [];
    return filings.map((f) => ({
        ...f,
    }));
};

const mapProfile: ProfileMapperFn = (profile) => ({
    name: (profile as any)?.name || (profile as any)?.ticker || profile?.symbol || profile?.report?.ic?.[0]?.label,
    website: (profile as any)?.weburl || (profile as any)?.website,
    country: (profile as any)?.country,
    industry: (profile as any)?.finnhubIndustry,
    exchange: (profile as any)?.exchange,
    marketCap: (profile as any)?.marketCapitalization
        ? (profile as any).marketCapitalization * 1_000_000
        : undefined,
    ipo: (profile as any)?.ipo,
    currency: (profile as any)?.currency,
    description: (profile as any)?.description,
});

const mapRatios: RatioMapperFn = (metrics) => {
    const safeNumber = (value: unknown): number | undefined => {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : undefined;
        }
        return undefined;
    };

    const rawPe = safeNumber(metrics?.peNormalizedAnnual ?? metrics?.peBasicExclExtraTTM ?? metrics?.peTTM);
    const rawPb = safeNumber(metrics?.pbAnnual ?? metrics?.priceToBookMRQ ?? metrics?.priceToBookRatioTTM);
    const rawPs = safeNumber(metrics?.psTTM ?? metrics?.priceToSalesTTM);
    const rawEvEbitda = safeNumber(metrics?.evEbitdaAnnual ?? metrics?.evToEbitda ?? metrics?.enterpriseToEbitda);
    const rawDividend = safeNumber(metrics?.dividendYieldIndicatedAnnual ?? metrics?.dividendYield5Y ?? metrics?.dividendYield);

    let dividendYieldPercent: number | undefined = rawDividend;
    if (typeof rawDividend === 'number') {
        // Heuristic: Finnhub sometimes returns decimals (0.006) and sometimes percents (1.2)
        dividendYieldPercent = rawDividend < 1 ? rawDividend * 100 : rawDividend;
    }

    return {
        pe: rawPe,
        pb: rawPb,
        ps: rawPs,
        evToEbitda: rawEvEbitda,
        dividendYieldPercent,
    };
};

export async function getStockProfileV2(symbolInput: string): Promise<StockProfileV2Model> {
    const { symbolRaw, finnhubSymbol, tvSymbol, secTicker } = normalizeSymbol(symbolInput);

    const status: StockProfileV2Model['providerStatus'] = [];

    const finnhubAvailable = Boolean(process.env.FINNHUB_API_KEY);
    if (!finnhubAvailable) {
        status.push({ source: 'finnhub', level: 'error', message: 'Finnhub API key is missing.' });
    }

    const secAvailable = Boolean(process.env.SEC_USER_AGENT);
    if (!secAvailable) {
        status.push({ source: 'sec', level: 'warning', message: 'SEC user agent is missing; filings may be unavailable.' });
    }

    const profilePromise = finnhubAvailable ? getFinnhubProfile(finnhubSymbol) : Promise.resolve(undefined);
    const metricsPromise = finnhubAvailable ? getFinnhubMetrics(finnhubSymbol) : Promise.resolve(undefined);
    const annualPromise = finnhubAvailable ? getFinnhubFinancials(finnhubSymbol, 'annual') : Promise.resolve(undefined);
    const quarterlyPromise = finnhubAvailable ? getFinnhubFinancials(finnhubSymbol, 'quarterly') : Promise.resolve(undefined);
    const quotePromise = finnhubAvailable ? getFinnhubQuote(finnhubSymbol) : Promise.resolve(undefined);
    const secPromise = secAvailable ? getRecentSecFilings(secTicker).catch((e) => {
        status.push({ source: 'sec', level: 'warning', message: e instanceof Error ? e.message : 'Failed to load SEC filings.' });
        return undefined;
    }) : Promise.resolve(undefined);

    const [profileRes, metricsRes, annualRes, quarterlyRes, quoteRes, filingsRes] = await Promise.all([
        profilePromise.catch((e) => {
            status.push({ source: 'finnhub', level: 'warning', message: e instanceof Error ? e.message : 'Profile fetch failed.' });
            return undefined;
        }),
        metricsPromise.catch((e) => {
            status.push({ source: 'finnhub', level: 'warning', message: e instanceof Error ? e.message : 'Metrics fetch failed.' });
            return undefined;
        }),
        annualPromise.catch((e) => {
            status.push({ source: 'finnhub', level: 'warning', message: e instanceof Error ? e.message : 'Annual financials fetch failed.' });
            return undefined;
        }),
        quarterlyPromise.catch((e) => {
            status.push({ source: 'finnhub', level: 'warning', message: e instanceof Error ? e.message : 'Quarterly financials fetch failed.' });
            return undefined;
        }),
        quotePromise.catch((e) => {
            status.push({ source: 'finnhub', level: 'warning', message: e instanceof Error ? e.message : 'Quote fetch failed.' });
            return undefined;
        }),
        secPromise,
    ]);

    const company = mapProfile(profileRes as any);
    const metrics = mapRatios(metricsRes?.metric ?? undefined);
    const annual = mapFinancials({ financials: annualRes, limit: 5, frequency: 'annual' });
    const quarterly = mapFinancials({ financials: quarterlyRes, limit: 8, frequency: 'quarterly' });
    const filings = mapFilings(filingsRes);

    const providerErrors = status
        .filter((s) => s.level === 'warning' || s.level === 'error')
        .map((s) => `${s.source.toUpperCase()}: ${s.message}`);

    return {
        symbolRaw,
        finnhubSymbol,
        tvSymbol,
        secTicker,
        company: {
            ...company,
            name: (profileRes as any)?.name || company.name || finnhubSymbol,
            website: (profileRes as any)?.weburl || company.website,
            industry: (profileRes as any)?.finnhubIndustry || company.industry,
            exchange: (profileRes as any)?.exchange || company.exchange,
        },
        price: {
            current: quoteRes?.c,
            changePercent: quoteRes?.dp,
        },
        metrics,
        financials: {
            annual,
            quarterly,
        },
        filings,
        providerStatus: status,
        providerErrors,
    };
}
