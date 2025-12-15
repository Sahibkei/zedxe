import 'server-only';

import { getFinnhubFinancials, getFinnhubMetrics, getFinnhubProfile, getFinnhubQuote } from './providers/finnhub';
import { getRecentSecFilings, getSecCompanyFacts } from './providers/sec';
import type { SecCompanyFacts } from './providers/sec';
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
const normalizeConcept = (concept?: string) => concept?.toLowerCase().replace(/[^a-z0-9]/g, '');

const pickValue = (
    items: { concept?: string; label?: string; value?: number }[] | undefined,
    concepts: string[]
): number | undefined => {
    if (!items) return undefined;
    const normalizedTargets = concepts.map(normalizeConcept).filter(Boolean) as string[];

    for (const item of items) {
        const normalizedConcept = normalizeConcept(item.concept) || normalizeConcept(item.label);
        const numericValue = typeof item.value === 'number' ? item.value : undefined;
        if (!normalizedConcept || numericValue === undefined) continue;

        const isExact = normalizedTargets.includes(normalizedConcept);
        const isPartial = normalizedTargets.some((target) => normalizedConcept.includes(target));
        if (isExact || isPartial) return numericValue;
    }

    return undefined;
};

const sortRows = (rows: StockFinancialRow[]) =>
    rows.slice().sort((a, b) => {
        const aTime = a?.endDate ? new Date(a.endDate).getTime() : 0;
        const bTime = b?.endDate ? new Date(b.endDate).getTime() : 0;
        return bTime - aTime;
    });

const sortReports = (reports: { endDate?: string; filedDate?: string }[]) =>
    reports.slice().sort((a, b) => {
        const aTime = a?.endDate ? new Date(a.endDate).getTime() : a?.filedDate ? new Date(a.filedDate).getTime() : 0;
        const bTime = b?.endDate ? new Date(b.endDate).getTime() : b?.filedDate ? new Date(b.filedDate).getTime() : 0;
        return bTime - aTime;
    });

const mapFinancials: FinancialsMapperFn = ({ financials, limit = 8, frequency }) => {
    const rows: StockFinancialRow[] = [];
    const entries = financials?.data || [];
    const seen = new Set<string>();

    sortReports(entries as any).forEach((entry) => {
        const endDate = (entry as any).endDate;
        const year = (entry as any).year ?? (endDate ? new Date(endDate).getUTCFullYear() : undefined);
        const quarter = (entry as any).quarter ?? deriveQuarter(endDate);
        if (!year) return;

        const dedupeKey = frequency === 'annual' ? String(year) : quarter ? `${year}-Q${quarter}` : undefined;
        if (!dedupeKey || seen.has(dedupeKey)) return;
        if (frequency === 'quarterly' && !quarter) return;
        seen.add(dedupeKey);

        const ic = (entry as any).report?.ic;
        const cf = (entry as any).report?.cf;

        const revenue = pickValue(ic, [
            'us-gaap_Revenues',
            'us-gaap_SalesRevenueNet',
            'us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax',
            'total revenue',
            'revenue',
        ]);
        const grossProfit = pickValue(ic, ['us-gaap_GrossProfit', 'gross profit']);
        const operatingIncome = pickValue(ic, ['us-gaap_OperatingIncomeLoss', 'operating income']);
        const netIncome = pickValue(ic, [
            'us-gaap_NetIncomeLoss',
            'us-gaap_ProfitLoss',
            'net income',
        ]);
        const eps = pickValue(ic, ['us-gaap_EarningsPerShareDiluted', 'eps diluted', 'eps']);
        const operatingCashFlow = pickValue(cf, [
            'us-gaap_NetCashProvidedByUsedInOperatingActivities',
            'us-gaap_NetCashProvidedByUsedInOperatingActivitiesContinuingOperations',
            'operating cash flow',
        ]);

        const label = frequency === 'annual' ? `FY ${year}` : `Q${quarter} ${year}`;

        rows.push({
            label: label.trim(),
            endDate,
            revenue,
            grossProfit,
            operatingIncome,
            netIncome,
            eps,
            operatingCashFlow,
            currency: (entry as any).currency,
        });
    });

    return rows.slice(0, limit);
};

type SecFactUnits = {
    end?: string;
    fy?: number;
    fp?: string;
    form?: string;
    val?: number;
    frame?: string;
};

type SecFactMap = Record<string, { units?: Record<string, SecFactUnits[]> }> | undefined;

const SEC_FACT_TARGETS: Record<keyof Omit<StockFinancialRow, 'label'>, string[]> = {
    endDate: [],
    revenue: ['Revenues', 'SalesRevenueNet', 'RevenueFromContractWithCustomerExcludingAssessedTax'],
    grossProfit: ['GrossProfit'],
    operatingIncome: ['OperatingIncomeLoss'],
    netIncome: ['NetIncomeLoss', 'ProfitLoss'],
    eps: ['EarningsPerShareDiluted'],
    operatingCashFlow: ['NetCashProvidedByUsedInOperatingActivities'],
    currency: [],
};

function mapSecFinancials(facts: SecCompanyFacts | undefined, frequency: 'annual' | 'quarterly', limit: number) {
    const factMap = facts?.facts?.['us-gaap'] as SecFactMap;
    if (!factMap) return [] as StockFinancialRow[];

    const rows = new Map<string, StockFinancialRow>();

    Object.entries(SEC_FACT_TARGETS).forEach(([key, concepts]) => {
        if (concepts.length === 0) return;
        concepts.forEach((concept) => {
            const units = factMap[concept]?.units?.USD || [];
            units.forEach((entry) => {
                const year = entry.fy ?? (entry.end ? new Date(entry.end).getUTCFullYear() : undefined);
                const quarterMatch = entry.fp?.match(/^Q([1-4])$/);
                const quarter = quarterMatch ? Number(quarterMatch[1]) : undefined;
                const isAnnual = entry.fp === 'FY' || !quarter;

                if (frequency === 'annual' && !isAnnual) return;
                if (frequency === 'quarterly' && (!quarter || entry.fp === 'FY')) return;

                const label = frequency === 'annual' ? `FY ${year}` : `Q${quarter} ${year}`;
                if (!label || !year) return;

                const existing = rows.get(label) || { label, endDate: entry.end };
                const numericValue = typeof entry.val === 'number' ? entry.val : undefined;

                (existing as any)[key] ??= numericValue;
                if (!existing.endDate && entry.end) existing.endDate = entry.end;

                rows.set(label, existing);
            });
        });
    });

    return sortRows(Array.from(rows.values())).slice(0, limit);
}

function mergeFinancialRows(primary: StockFinancialRow[], secondary: StockFinancialRow[], limit: number) {
    const combined = new Map<string, StockFinancialRow>();

    const apply = (row: StockFinancialRow, preferExisting: boolean) => {
        const existing = combined.get(row.label);
        if (!existing) {
            combined.set(row.label, { ...row });
            return;
        }

        const target = preferExisting ? existing : row;
        const source = preferExisting ? row : existing;

        target.endDate ||= source.endDate;
        target.currency ||= source.currency;
        target.revenue ??= source.revenue;
        target.grossProfit ??= source.grossProfit;
        target.operatingIncome ??= source.operatingIncome;
        target.netIncome ??= source.netIncome;
        target.eps ??= source.eps;
        target.operatingCashFlow ??= source.operatingCashFlow;

        combined.set(row.label, preferExisting ? target : source);
    };

    primary.forEach((row) => apply(row, true));
    secondary.forEach((row) => apply(row, false));

    return sortRows(Array.from(combined.values())).slice(0, limit);
}

const mapFilings: FilingsMapperFn = (filingsResp) => {
    const filings: FilingInfo[] = filingsResp?.filings || [];
    return filings.map((f) => ({
        ...f,
    }));
};

const mapProfile: ProfileMapperFn = (profile) => ({
    name: profile?.name || profile?.ticker,
    website: profile?.weburl,
    country: profile?.country,
    industry: profile?.finnhubIndustry,
    exchange: profile?.exchange,
    marketCap: profile?.marketCapitalization ? profile.marketCapitalization * 1_000_000 : undefined,
    ipo: profile?.ipo,
    currency: profile?.currency,
    description: profile?.description,
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
    const rawDebtToEquity = safeNumber(
        metrics?.totalDebtToEquityQuarterly ?? metrics?.totalDebtToEquityAnnual ?? metrics?.totalDebtToEquity
    );
    const rawCurrentRatio = safeNumber(metrics?.currentRatioQuarterly ?? metrics?.currentRatioAnnual);
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
        debtToEquity: rawDebtToEquity,
        currentRatio: rawCurrentRatio,
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
    const quarterlyPromise = finnhubAvailable
        ? getFinnhubFinancials(finnhubSymbol, 'quarterly')
        : Promise.resolve(undefined);
    const quotePromise = finnhubAvailable ? getFinnhubQuote(finnhubSymbol) : Promise.resolve(undefined);
    const secPromise = secAvailable
        ? getRecentSecFilings(secTicker).catch((e) => {
              status.push({ source: 'sec', level: 'warning', message: e instanceof Error ? e.message : 'Failed to load SEC filings.' });
              return undefined;
          })
        : Promise.resolve(undefined);
    const secFactsPromise = secAvailable
        ? getSecCompanyFacts(secTicker).catch((e) => {
              status.push({ source: 'sec', level: 'warning', message: e instanceof Error ? e.message : 'Company facts fetch failed.' });
              return undefined;
          })
        : Promise.resolve(undefined);

    const [profileRes, metricsRes, annualRes, quarterlyRes, quoteRes, filingsRes, secFacts] = await Promise.all([
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
        secFactsPromise,
    ]);

    const company = mapProfile(profileRes);
    const metrics = mapRatios(metricsRes?.metric ?? undefined);
    const annualPrimary = mapFinancials({ financials: annualRes, limit: 5, frequency: 'annual' });
    const quarterlyPrimary = mapFinancials({ financials: quarterlyRes, limit: 8, frequency: 'quarterly' });
    const secAnnual = mapSecFinancials(secFacts || {}, 'annual', 5);
    const secQuarterly = mapSecFinancials(secFacts || {}, 'quarterly', 8);
    const annual = mergeFinancialRows(annualPrimary, secAnnual, 5);
    const quarterly = mergeFinancialRows(quarterlyPrimary, secQuarterly, 8);
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
            name: (profileRes as any)?.name || secFacts?.entityName || company.name || finnhubSymbol,
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
