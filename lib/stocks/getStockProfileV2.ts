import { FinancialStatementEntry, StockProfileV2Model } from "@/lib/stocks/stockProfileV2.types";
import {
    FinnhubIncomeRow,
    getFinancialsReported,
    getFinnhubBasicFinancials,
    getFinnhubProfile,
    getFinnhubQuote,
    parseIncomeStatementRowsFromReported,
} from "@/lib/stocks/providers/finnhub";
import { getCikForTicker, getCompanyFacts, getSubmissions, normalizeTicker } from "@/lib/stocks/providers/sec";
import { buildSecArchiveUrl } from "@/lib/stocks/providers/secUrl";

const RECENT_LIMIT = 10;
const MAX_ANNUAL_YEARS = 5;
const MAX_QUARTERS = 12;

type SecFactPoint = {
    end: string;
    fy?: number;
    fp?: string;
    form?: string;
    val: number;
};

function coalesceNumber(...values: Array<number | null | undefined>) {
    for (const value of values) {
        if (typeof value === "number" && !Number.isNaN(value)) return value;
    }
    return undefined;
}

function normalizeChartSymbol(input: string): { ticker: string; chartSymbol: string } {
    const trimmed = input.trim().toUpperCase();

    if (!trimmed) {
        throw new Error("Symbol is required for stock profile lookup");
    }

    if (trimmed.includes(":")) {
        const [, tickerPart] = trimmed.split(":");
        const ticker = (tickerPart ?? trimmed).toUpperCase();
        return { ticker, chartSymbol: trimmed };
    }

    return { ticker: trimmed, chartSymbol: trimmed };
}

function mapFilings(submissions: any | undefined, cik10: string) {
    const recentForms = submissions?.filings?.recent;

    if (!recentForms?.form || !recentForms.filingDate || !recentForms.reportDate) {
        return { latest10Q: undefined, latest10K: undefined, recent: [] };
    }

    const recent: { formType: string; filingDate: string; periodEnd: string; accessionNumber?: string; primaryDocument?: string }[] = [];

    for (let i = 0; i < recentForms.form.length && recent.length < RECENT_LIMIT; i += 1) {
        const formType = recentForms.form[i];
        const filingDate = recentForms.filingDate[i];
        const periodEnd = recentForms.reportDate[i];
        const accessionNumber = recentForms.accessionNumber?.[i];
        const primaryDocument = recentForms.primaryDocument?.[i];

        if (!formType || !filingDate || !periodEnd) continue;

        recent.push({ formType, filingDate, periodEnd, accessionNumber, primaryDocument });
    }

    const latest10Q = recent.find((item) => item.formType === "10-Q");
    const latest10K = recent.find((item) => item.formType === "10-K" || item.formType === "20-F" || item.formType === "40-F");

    const decorate = (item?: typeof recent[number]) =>
        item
            ? {
                  ...item,
                  cik: cik10,
                  url: item.accessionNumber && item.primaryDocument ? buildSecArchiveUrl(cik10, item.accessionNumber, item.primaryDocument) : undefined,
              }
            : undefined;

    return {
        latest10Q: decorate(latest10Q),
        latest10K: decorate(latest10K),
        recent: recent.map((item) => ({
            ...item,
            cik: cik10,
            url: item.accessionNumber && item.primaryDocument ? buildSecArchiveUrl(cik10, item.accessionNumber, item.primaryDocument) : undefined,
        })),
    };
}

function mapRatios(metrics: Record<string, unknown> | undefined) {
    const metric = metrics ?? {};

    const dividendRaw = metric["dividendYieldIndicatedAnnual"] as number | undefined;
    const dividendYield = typeof dividendRaw === "number" ? dividendRaw / 100 : undefined;

    return {
        pe: coalesceNumber(metric["peInclExtraTTM"] as number, metric["peTTM"] as number, metric["peBasicExclExtraTTM"] as number),
        pb: coalesceNumber(metric["pbAnnual"] as number, metric["priceToBookMRQ"] as number),
        ps: coalesceNumber(metric["psTTM"] as number, metric["priceToSalesTTM"] as number),
        evToEbitda: coalesceNumber(metric["evToEbitda"] as number, metric["evebitda"] as number),
        debtToEquity: coalesceNumber(
            metric["totalDebtToEquityQuarterly"] as number,
            metric["totalDebtToEquity"] as number,
            metric["debtEquityRatio"] as number
        ),
        currentRatio: coalesceNumber(metric["currentRatioQuarterly"] as number, metric["currentRatioAnnual"] as number),
        dividendYield,
    };
}

function getFactPoints(facts: any, tag: string, preferredUnits: string[]): SecFactPoint[] {
    const units = facts?.facts?.["us-gaap"]?.[tag]?.units;
    if (!units) return [];

    const unitKey = preferredUnits.find((unit) => units[unit]) ?? Object.keys(units)[0];
    const data = unitKey ? units[unitKey] : undefined;
    if (!Array.isArray(data)) return [];

    return data
        .map((item) => {
            const end = item?.end ?? item?.endDate;
            const rawVal = typeof item?.val === "number" ? item.val : typeof item?.value === "number" ? item.value : Number(item?.val);
            if (!end || !Number.isFinite(rawVal)) return null;

            return {
                end,
                fy: typeof item?.fy === "number" ? item.fy : Number(item?.fy),
                fp: item?.fp,
                form: item?.form,
                val: rawVal,
            } satisfies SecFactPoint;
        })
        .filter(Boolean) as SecFactPoint[];
}

function filterByFp(points: SecFactPoint[], allowed: string[]) {
    return points.filter((point) => point.fp && allowed.includes(point.fp));
}

function mapByEnd(points: SecFactPoint[]) {
    const sorted = [...points].sort((a, b) => (a.end < b.end ? 1 : -1));
    const map = new Map<string, SecFactPoint>();

    for (const point of sorted) {
        if (!map.has(point.end)) {
            map.set(point.end, point);
        }
    }

    return map;
}

function buildSecFinancials(facts: any): { annual: FinancialStatementEntry[]; quarterly: FinancialStatementEntry[] } {
    const revenuePoints = getFactPoints(facts, "Revenues", ["USD"]);
    const grossPoints = getFactPoints(facts, "GrossProfit", ["USD"]);
    const operatingPoints = getFactPoints(facts, "OperatingIncomeLoss", ["USD"]);
    const netIncomePoints = getFactPoints(facts, "NetIncomeLoss", ["USD"]);
    const epsPoints = getFactPoints(facts, "EarningsPerShareDiluted", ["USD/shares", "USD / shares"]);

    const annualRevenue = filterByFp(revenuePoints, ["FY"]);
    const quarterlyRevenue = filterByFp(revenuePoints, ["Q1", "Q2", "Q3", "Q4"]);

    const annualGrossMap = mapByEnd(filterByFp(grossPoints, ["FY"]));
    const annualOperatingMap = mapByEnd(filterByFp(operatingPoints, ["FY"]));
    const annualNetIncomeMap = mapByEnd(filterByFp(netIncomePoints, ["FY"]));
    const annualEpsMap = mapByEnd(filterByFp(epsPoints, ["FY"]));

    const quarterlyGrossMap = mapByEnd(filterByFp(grossPoints, ["Q1", "Q2", "Q3", "Q4"]));
    const quarterlyOperatingMap = mapByEnd(filterByFp(operatingPoints, ["Q1", "Q2", "Q3", "Q4"]));
    const quarterlyNetIncomeMap = mapByEnd(filterByFp(netIncomePoints, ["Q1", "Q2", "Q3", "Q4"]));
    const quarterlyEpsMap = mapByEnd(filterByFp(epsPoints, ["Q1", "Q2", "Q3", "Q4"]));

    const annualSeries: FinancialStatementEntry[] = [];
    const seenAnnual = new Set<string>();
    for (const point of annualRevenue.sort((a, b) => (a.end < b.end ? 1 : -1))) {
        if (seenAnnual.has(point.end)) continue;
        seenAnnual.add(point.end);
        annualSeries.push({
            fiscalDate: point.end,
            fiscalYear: `FY ${point.fy ?? point.end.slice(0, 4)}`,
            revenue: point.val,
            grossProfit: annualGrossMap.get(point.end)?.val,
            operatingIncome: annualOperatingMap.get(point.end)?.val,
            netIncome: annualNetIncomeMap.get(point.end)?.val,
            eps: annualEpsMap.get(point.end)?.val,
        });
        if (annualSeries.length >= MAX_ANNUAL_YEARS) break;
    }

    const quarterlySeries: FinancialStatementEntry[] = [];
    const seenQuarterly = new Set<string>();
    for (const point of quarterlyRevenue.sort((a, b) => (a.end < b.end ? 1 : -1))) {
        if (seenQuarterly.has(point.end)) continue;
        seenQuarterly.add(point.end);
        quarterlySeries.push({
            fiscalDate: point.end,
            fiscalYear: `${point.fy ?? point.end.slice(0, 4)} ${point.fp}`,
            revenue: point.val,
            grossProfit: quarterlyGrossMap.get(point.end)?.val,
            operatingIncome: quarterlyOperatingMap.get(point.end)?.val,
            netIncome: quarterlyNetIncomeMap.get(point.end)?.val,
            eps: quarterlyEpsMap.get(point.end)?.val,
        });
        if (quarterlySeries.length >= MAX_QUARTERS) break;
    }

    return { annual: annualSeries, quarterly: quarterlySeries };
}

function mapFinnhubRows(rows: FinnhubIncomeRow[], limit: number): FinancialStatementEntry[] {
    const sorted = [...rows].sort((a, b) => {
        if (a.year === b.year) {
            return (b.quarter ?? 0) - (a.quarter ?? 0);
        }
        return b.year - a.year;
    });

    const seen = new Set<string>();
    const result: FinancialStatementEntry[] = [];

    for (const row of sorted) {
        if (seen.has(row.periodKey)) continue;
        seen.add(row.periodKey);
        result.push({
            fiscalDate: row.endDate ?? row.periodKey,
            fiscalYear: row.periodLabel,
            revenue: row.revenue,
            grossProfit: row.grossProfit,
            operatingIncome: row.operatingIncome,
            netIncome: row.netIncome,
            eps: row.eps,
        });
        if (result.length >= limit) break;
    }

    return result;
}

export async function getStockProfileV2(symbol: string): Promise<StockProfileV2Model> {
    const { ticker, chartSymbol } = normalizeChartSymbol(symbol);
    const tickerForSec = normalizeTicker(ticker);

    let finnhubProfile: any | null = null;
    let finnhubQuote: any | null = null;
    let finnhubBasics: any | null = null;
    let finnhubAnnualRows: FinnhubIncomeRow[] = [];
    let finnhubQuarterlyRows: FinnhubIncomeRow[] = [];
    let financialsWarning: string | undefined;
    let finnhubError: string | undefined;
    let financialsSource: "FINNHUB_REPORTED" | "SEC_XBRL" = "FINNHUB_REPORTED";

    if (process.env.FINNHUB_API_KEY) {
        try {
            const [profileRes, quoteRes, basicsRes, annualRes, quarterlyRes] = await Promise.all([
                getFinnhubProfile(ticker),
                getFinnhubQuote(ticker),
                getFinnhubBasicFinancials(ticker),
                getFinancialsReported(ticker, "annual"),
                getFinancialsReported(ticker, "quarterly"),
            ]);

            finnhubProfile = profileRes;
            finnhubQuote = quoteRes;
            finnhubBasics = basicsRes;

            if (annualRes.ok) {
                finnhubAnnualRows = parseIncomeStatementRowsFromReported(annualRes.data, "annual").filter((row) => row.quarter === 0);
            } else {
                financialsWarning = annualRes.hint ?? "Finnhub annual financials unavailable.";
            }

            if (quarterlyRes.ok) {
                finnhubQuarterlyRows = parseIncomeStatementRowsFromReported(quarterlyRes.data, "quarterly").filter(
                    (row) => row.quarter > 0
                );
            } else {
                financialsWarning = financialsWarning ?? quarterlyRes.hint ?? "Finnhub quarterly financials unavailable.";
            }
        } catch (error) {
            finnhubError = error instanceof Error ? error.message : String(error);
            financialsWarning = financialsWarning ?? finnhubError;
        }
    } else {
        finnhubError = "FINNHUB_API_KEY environment variable is required to load fundamentals.";
        financialsWarning = finnhubError;
    }

    let secTitle: string | undefined;
    let cik10: string | undefined;
    let secExchange: string | undefined;
    let submissions: any | undefined;
    let secFacts: any | undefined;
    let secError: string | undefined;

    try {
        const secLookup = await getCikForTicker(tickerForSec);
        cik10 = secLookup.cik10;
        secTitle = secLookup.title;
        secExchange = secLookup.exchange;
        submissions = await getSubmissions(cik10);
    } catch (error) {
        secError = error instanceof Error ? error.message : String(error);
    }

    let annualSeries: FinancialStatementEntry[] = [];
    let quarterlySeries: FinancialStatementEntry[] = [];

    const hasFinnhubAnnual = finnhubAnnualRows.length > 0;
    const hasFinnhubQuarterly = finnhubQuarterlyRows.length > 0;

    if (hasFinnhubAnnual && hasFinnhubQuarterly) {
        annualSeries = mapFinnhubRows(finnhubAnnualRows, MAX_ANNUAL_YEARS);
        quarterlySeries = mapFinnhubRows(finnhubQuarterlyRows, MAX_QUARTERS);
    } else {
        financialsSource = "SEC_XBRL";
        if (!financialsWarning && finnhubError) {
            financialsWarning = finnhubError;
        }
        if (cik10) {
            try {
                secFacts = await getCompanyFacts(cik10);
                const secSeries = buildSecFinancials(secFacts);
                annualSeries = secSeries.annual;
                quarterlySeries = secSeries.quarterly;
                if (!financialsWarning) {
                    financialsWarning = "Finnhub financials unavailable; showing SEC XBRL fallback.";
                }
            } catch (error) {
                secError = secError ?? (error instanceof Error ? error.message : String(error));
            }
        }

        if (annualSeries.length === 0 && hasFinnhubAnnual) {
            financialsSource = "FINNHUB_REPORTED";
            annualSeries = mapFinnhubRows(finnhubAnnualRows, MAX_ANNUAL_YEARS);
        }
        if (quarterlySeries.length === 0 && hasFinnhubQuarterly) {
            financialsSource = "FINNHUB_REPORTED";
            quarterlySeries = mapFinnhubRows(finnhubQuarterlyRows, MAX_QUARTERS);
        }
    }

    if (annualSeries.length === 0 && quarterlySeries.length === 0 && !financialsWarning) {
        financialsWarning = "Financials unavailable from Finnhub and SEC.";
    }

    const filings = cik10 ? mapFilings(submissions, cik10) : { latest10K: undefined, latest10Q: undefined, recent: [] };
    const ratios = mapRatios(finnhubBasics?.metric);

    const profile: StockProfileV2Model = {
        companyProfile: {
            name: finnhubProfile?.name || secTitle || ticker,
            ticker,
            cik: cik10,
            exchange: finnhubProfile?.exchange ?? secExchange,
            sector: finnhubProfile?.gsector ?? finnhubProfile?.sector,
            industry: finnhubProfile?.finnhubIndustry ?? finnhubProfile?.industry,
            website: finnhubProfile?.weburl,
            description: finnhubProfile?.description,
            headquartersCity: finnhubProfile?.city,
            headquartersCountry: finnhubProfile?.country,
            employees: finnhubProfile?.employeeTotal,
            ceo: finnhubProfile?.ceo,
            country: finnhubProfile?.country,
            currency: finnhubProfile?.currency,
            marketCap: finnhubBasics?.metric?.marketCapitalization,
        },
        chartSymbol,
        financialsAnnual: annualSeries,
        financialsQuarterly: quarterlySeries,
        financialsSource,
        financialsWarning,
        ratios,
        quote: {
            price: finnhubQuote?.c,
            change: finnhubQuote?.d,
            changePercent: typeof finnhubQuote?.dp === "number" ? finnhubQuote.dp : undefined,
            asOf: finnhubQuote?.t ? finnhubQuote.t * 1000 : undefined,
            currency: finnhubProfile?.currency,
        },
        earningsLatestQuarter: quarterlySeries.length
            ? {
                  period: quarterlySeries[0].fiscalYear,
                  eps: quarterlySeries[0].eps,
                  revenue: quarterlySeries[0].revenue,
              }
            : undefined,
        earningsLatestAnnual: annualSeries.length
            ? {
                  period: annualSeries[0].fiscalYear,
                  eps: annualSeries[0].eps,
                  revenue: annualSeries[0].revenue,
              }
            : undefined,
        filings,
        sources: {
            finnhubAvailable: !finnhubError,
            secAvailable: !secError,
            finnhubError,
            secError,
        },
    };

    return profile;
}
