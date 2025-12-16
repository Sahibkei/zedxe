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
    StatementGrid,
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

type StatementDefinition = {
    id: string;
    label: string;
    concepts?: string[];
    statement: 'ic' | 'bs' | 'cf';
    aggregation?: 'flow' | 'point';
    valueType?: 'currency' | 'perShare' | 'count';
    children?: StatementDefinition[];
};

const INCOME_STATEMENT_DEFINITIONS: StatementDefinition[] = [
    {
        id: 'revenue',
        label: 'Revenue',
        statement: 'ic',
        aggregation: 'flow',
        concepts: ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet'],
    },
    {
        id: 'cost-of-revenue',
        label: 'Cost of Revenue',
        statement: 'ic',
        aggregation: 'flow',
        concepts: ['CostOfRevenue', 'CostOfGoodsAndServicesSold'],
    },
    {
        id: 'gross-profit',
        label: 'Gross Profit',
        statement: 'ic',
        aggregation: 'flow',
        concepts: ['GrossProfit'],
    },
    {
        id: 'operating-expenses',
        label: 'Operating Expenses',
        statement: 'ic',
        aggregation: 'flow',
        concepts: ['OperatingExpenses'],
        children: [
            {
                id: 'rnd',
                label: 'Research & Development',
                statement: 'ic',
                aggregation: 'flow',
                concepts: ['ResearchAndDevelopmentExpense'],
            },
            {
                id: 'sga',
                label: 'Selling, General & Admin',
                statement: 'ic',
                aggregation: 'flow',
                concepts: ['SellingGeneralAndAdministrativeExpense'],
            },
        ],
    },
    {
        id: 'operating-income',
        label: 'Operating Income',
        statement: 'ic',
        aggregation: 'flow',
        concepts: ['OperatingIncomeLoss'],
    },
    {
        id: 'other-income',
        label: 'Other Income/Expense',
        statement: 'ic',
        aggregation: 'flow',
        children: [
            {
                id: 'interest-income',
                label: 'Interest Income',
                statement: 'ic',
                aggregation: 'flow',
                concepts: ['InterestIncomeOperating', 'InterestIncomeNonoperating'],
            },
            {
                id: 'interest-expense',
                label: 'Interest Expense',
                statement: 'ic',
                aggregation: 'flow',
                concepts: ['InterestExpense', 'InterestExpenseNonoperating'],
            },
            {
                id: 'other-nonoperating',
                label: 'Other',
                statement: 'ic',
                aggregation: 'flow',
                concepts: ['OtherNonoperatingIncomeExpense'],
            },
        ],
    },
    {
        id: 'pretax-income',
        label: 'Pretax Income',
        statement: 'ic',
        aggregation: 'flow',
        concepts: ['IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItems'],
    },
    {
        id: 'tax-provision',
        label: 'Tax Provision',
        statement: 'ic',
        aggregation: 'flow',
        concepts: ['IncomeTaxExpenseBenefit'],
    },
    {
        id: 'net-income',
        label: 'Net Income',
        statement: 'ic',
        aggregation: 'flow',
        concepts: ['NetIncomeLoss', 'ProfitLoss'],
    },
    {
        id: 'eps-basic',
        label: 'EPS (Basic)',
        statement: 'ic',
        aggregation: 'flow',
        valueType: 'perShare',
        concepts: ['EarningsPerShareBasic'],
    },
    {
        id: 'eps-diluted',
        label: 'EPS (Diluted)',
        statement: 'ic',
        aggregation: 'flow',
        valueType: 'perShare',
        concepts: ['EarningsPerShareDiluted'],
    },
    {
        id: 'shares-basic',
        label: 'Weighted Avg Shares (Basic)',
        statement: 'ic',
        aggregation: 'flow',
        valueType: 'count',
        concepts: ['WeightedAverageNumberOfSharesOutstandingBasic'],
    },
    {
        id: 'shares-diluted',
        label: 'Weighted Avg Shares (Diluted)',
        statement: 'ic',
        aggregation: 'flow',
        valueType: 'count',
        concepts: ['WeightedAverageNumberOfDilutedSharesOutstanding'],
    },
];

const BALANCE_SHEET_DEFINITIONS: StatementDefinition[] = [
    {
        id: 'total-assets',
        label: 'Total Assets',
        statement: 'bs',
        aggregation: 'point',
        concepts: ['Assets'],
    },
    {
        id: 'cash',
        label: 'Cash & Equivalents',
        statement: 'bs',
        aggregation: 'point',
        concepts: ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsAndShortTermInvestments'],
    },
    {
        id: 'receivables',
        label: 'Receivables',
        statement: 'bs',
        aggregation: 'point',
        concepts: ['AccountsReceivableNetCurrent'],
    },
    {
        id: 'inventory',
        label: 'Inventory',
        statement: 'bs',
        aggregation: 'point',
        concepts: ['InventoryNet'],
    },
    {
        id: 'ppe',
        label: 'Property, Plant & Equipment',
        statement: 'bs',
        aggregation: 'point',
        concepts: ['PropertyPlantAndEquipmentNet'],
    },
    {
        id: 'intangibles',
        label: 'Intangibles & Goodwill',
        statement: 'bs',
        aggregation: 'point',
        concepts: ['Goodwill', 'IntangibleAssetsNetExcludingGoodwill'],
    },
    {
        id: 'total-liabilities',
        label: 'Total Liabilities',
        statement: 'bs',
        aggregation: 'point',
        concepts: ['Liabilities'],
    },
    {
        id: 'debt-current',
        label: 'Short-term Debt',
        statement: 'bs',
        aggregation: 'point',
        concepts: ['DebtCurrent', 'LongTermDebtCurrent'],
    },
    {
        id: 'debt-long',
        label: 'Long-term Debt',
        statement: 'bs',
        aggregation: 'point',
        concepts: ['LongTermDebtNoncurrent', 'LongTermDebtAndCapitalLeaseObligations'],
    },
    {
        id: 'total-equity',
        label: 'Total Equity',
        statement: 'bs',
        aggregation: 'point',
        concepts: [
            'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest',
            'StockholdersEquity',
        ],
    },
];

const CASH_FLOW_DEFINITIONS: StatementDefinition[] = [
    {
        id: 'operating-cash-flow',
        label: 'Net Cash from Operating Activities',
        statement: 'cf',
        aggregation: 'flow',
        concepts: [
            'NetCashProvidedByUsedInOperatingActivities',
            'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations',
        ],
    },
    {
        id: 'investing-cash-flow',
        label: 'Net Cash from Investing Activities',
        statement: 'cf',
        aggregation: 'flow',
        concepts: ['NetCashProvidedByUsedInInvestingActivities'],
    },
    {
        id: 'financing-cash-flow',
        label: 'Net Cash from Financing Activities',
        statement: 'cf',
        aggregation: 'flow',
        concepts: ['NetCashProvidedByUsedInFinancingActivities'],
    },
    {
        id: 'capex',
        label: 'Capital Expenditures',
        statement: 'cf',
        aggregation: 'flow',
        concepts: ['PaymentsToAcquirePropertyPlantAndEquipment'],
    },
    {
        id: 'depreciation',
        label: 'Depreciation & Amortization',
        statement: 'cf',
        aggregation: 'flow',
        concepts: ['DepreciationDepletionAndAmortization'],
    },
    {
        id: 'sbc',
        label: 'Stock-based Compensation',
        statement: 'cf',
        aggregation: 'flow',
        concepts: ['ShareBasedCompensation'],
    },
];

const formatStatementDateLabel = (endDate?: string, year?: number) => {
    if (endDate) {
        const parsed = new Date(endDate);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
        }
    }
    return year ? `FY ${year}` : '—';
};

const createStatementGrid = ({
    annualReports,
    quarterlyReports,
    statement,
    definitions,
    fallbackCurrency,
    defaultAggregation,
}: {
    annualReports?: { endDate?: string; year?: number; report?: any; currency?: string }[];
    quarterlyReports?: { endDate?: string; report?: any; currency?: string }[];
    statement: 'ic' | 'bs' | 'cf';
    definitions: StatementDefinition[];
    fallbackCurrency?: string;
    defaultAggregation: 'flow' | 'point';
}): StatementGrid => {
    const sortedAnnual = sortReports((annualReports as any[]) || []) as any[];
    const sortedQuarterly = sortReports((quarterlyReports as any[]) || []) as any[];

    const annualColumns = sortedAnnual.slice(0, 4).map((report, index) => ({
        key: `annual-${index}`,
        label: formatStatementDateLabel(report?.endDate, report?.year),
        date: report?.endDate,
        type: 'annual' as const,
        currency: report?.currency,
        source: report,
    }));

    const columnsWithSource = [
        { key: 'ttm', label: 'TTM', type: 'ttm' as const },
        ...annualColumns,
    ];

    const columns = columnsWithSource.map(({ source, ...col }) => col);

    const valueFromReport = (report: any, concepts?: string[]) => {
        if (!report || !concepts || concepts.length === 0) return undefined;
        const items = report?.report?.[statement];
        return pickValue(items, concepts);
    };

    const computeTtmValue = (concepts?: string[], aggregation?: 'flow' | 'point') => {
        if (!concepts || concepts.length === 0 || sortedQuarterly.length === 0) return undefined;
        if (aggregation === 'point') {
            return valueFromReport(sortedQuarterly[0], concepts);
        }

        const values = sortedQuarterly
            .slice(0, 4)
            .map((report) => valueFromReport(report, concepts))
            .filter((value): value is number => typeof value === 'number');

        if (values.length === 0) return undefined;
        return values.reduce((sum, value) => sum + value, 0);
    };

    const buildRows = (defs: StatementDefinition[]): any[] =>
        defs.map((def) => {
            const children = def.children ? buildRows(def.children) : undefined;
            const valuesByColumnKey: Record<string, number | undefined> = {};
            const aggregation = def.aggregation ?? defaultAggregation;

            columnsWithSource.forEach((column) => {
                let value: number | undefined;
                if (column.key === 'ttm') {
                    value = computeTtmValue(def.concepts, aggregation);
                } else if ('source' in column) {
                    value = valueFromReport((column as any).source, def.concepts);
                }

                if (value === undefined && children && children.length) {
                    const childValues = children
                        .map((child) => child.valuesByColumnKey[column.key])
                        .filter((childValue): childValue is number => typeof childValue === 'number');
                    if (childValues.length > 0) {
                        value = childValues.reduce((sum, childValue) => sum + childValue, 0);
                    }
                }

                valuesByColumnKey[column.key] = value;
            });

            return {
                id: def.id,
                label: def.label,
                concept: def.concepts?.[0],
                valueType: def.valueType,
                valuesByColumnKey,
                children,
            };
        });

    const currencyCandidate =
        columnsWithSource.find((col) => 'currency' in col && col.currency)?.currency ||
        fallbackCurrency ||
        sortedAnnual[0]?.currency ||
        sortedQuarterly[0]?.currency;

    return {
        columns,
        rows: buildRows(definitions),
        currency: currencyCandidate,
    };
};

const mapFilings: FilingsMapperFn = (filingsResp) => {
    const filings: FilingInfo[] = filingsResp?.filings || [];
    return filings.map((f) => ({
        ...f,
        description: f.description ?? f.companyName,
        companyName: f.companyName ?? f.description,
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

/**
 * Fetches stock profile, metrics, filings and financials for the given symbol with provider fallbacks.
 */
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
            status.push({
                source: 'finnhub',
                level: 'warning',
                message: e instanceof Error ? e.message : 'Profile fetch failed.',
            });
            return undefined;
        }),
        metricsPromise.catch((e) => {
            status.push({
                source: 'finnhub',
                level: 'warning',
                message: e instanceof Error ? e.message : 'Metrics fetch failed.',
            });
            return undefined;
        }),
        annualPromise.catch((e) => {
            status.push({
                source: 'finnhub',
                level: 'warning',
                message: e instanceof Error ? e.message : 'Annual financials fetch failed.',
            });
            return undefined;
        }),
        quarterlyPromise.catch((e) => {
            status.push({
                source: 'finnhub',
                level: 'warning',
                message: e instanceof Error ? e.message : 'Quarterly financials fetch failed.',
            });
            return undefined;
        }),
        quotePromise.catch((e) => {
            status.push({
                source: 'finnhub',
                level: 'warning',
                message: e instanceof Error ? e.message : 'Quote fetch failed.',
            });
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
    const statements = {
        income: createStatementGrid({
            annualReports: annualRes?.data,
            quarterlyReports: quarterlyRes?.data,
            statement: 'ic',
            definitions: INCOME_STATEMENT_DEFINITIONS,
            fallbackCurrency: company.currency,
            defaultAggregation: 'flow',
        }),
        balanceSheet: createStatementGrid({
            annualReports: annualRes?.data,
            quarterlyReports: quarterlyRes?.data,
            statement: 'bs',
            definitions: BALANCE_SHEET_DEFINITIONS,
            fallbackCurrency: company.currency,
            defaultAggregation: 'point',
        }),
        cashFlow: createStatementGrid({
            annualReports: annualRes?.data,
            quarterlyReports: quarterlyRes?.data,
            statement: 'cf',
            definitions: CASH_FLOW_DEFINITIONS,
            fallbackCurrency: company.currency,
            defaultAggregation: 'flow',
        }),
    } satisfies StockProfileV2Model['financials']['statements'];

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
            statements,
        },
        filings,
        providerStatus: status,
        providerErrors,
    };
}
