import { StockProfileV2Model } from "@/lib/stocks/stockProfileV2.types";
import {
    getFinnhubBasicFinancials,
    getFinnhubProfile,
    getFinnhubQuote,
    tryGetFinnhubFinancials,
} from "@/lib/stocks/providers/finnhub";
import { getCikForTicker, getSubmissions, normalizeTicker } from "@/lib/stocks/providers/sec";
import { buildSecArchiveUrl } from "@/lib/stocks/providers/secUrl";

type NormalizedFinancialPoint = {
    end: string;
    fy?: number;
    fp?: string;
    form?: string;
    revenue?: number;
    grossProfit?: number;
    operatingIncome?: number;
    netIncome?: number;
    eps?: number;
};

const RECENT_LIMIT = 10;
const MAX_ANNUAL_YEARS = 5;
const MAX_QUARTERS = 12;

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

function normalizeFinancialsFromFinancialsResponse(raw: any): NormalizedFinancialPoint[] {
    const items: any[] = raw?.financials ?? raw?.data ?? [];

    return items
        .map((item) => {
            const end = item.endDate ?? item.reportDate ?? item.date ?? item.period;
            if (!end) return null;

            const fp = item.period ?? item.fp ?? item.fiscalQuarter;
            const fy = item.fiscalYear ?? item.year ?? (end ? Number(end.slice(0, 4)) : undefined);

            const eps = coalesceNumber(item.epsDiluted, item.epsBasic, item.eps);
            const shares = coalesceNumber(item.weightedAverageShsOutDil, item.weightedAverageShsOut, item.shareIssued);
            const derivedEps = eps ?? (typeof item.netIncome === "number" && typeof shares === "number" && shares !== 0
                ? item.netIncome / shares
                : undefined);

            return {
                end,
                fy,
                fp,
                form: item.form,
                revenue: coalesceNumber(item.revenue, item.totalRevenue, item.sales),
                grossProfit: coalesceNumber(item.grossProfit),
                operatingIncome: coalesceNumber(item.operatingIncome, item.operatingIncomeLoss),
                netIncome: coalesceNumber(item.netIncome, item.netIncomeLoss),
                eps: derivedEps,
            } satisfies NormalizedFinancialPoint;
        })
        .filter(Boolean) as NormalizedFinancialPoint[];
}

function findConceptValue(reportSection: any[] | undefined, concepts: string[]): number | undefined {
    if (!Array.isArray(reportSection)) return undefined;

    for (const candidate of concepts) {
        const entry = reportSection.find(
            (item) => item?.concept === candidate || item?.label === candidate || item?.value?.[candidate] !== undefined
        );

        if (entry && typeof entry.value === "number") {
            return entry.value;
        }

        if (entry && typeof entry.value?.[candidate] === "number") {
            return entry.value[candidate];
        }
    }

    return undefined;
}

function normalizeFinancialsFromReported(raw: any): NormalizedFinancialPoint[] {
    const items: any[] = raw?.data ?? [];

    return items
        .map((item) => {
            const end = item.endDate;
            if (!end) return null;

            const ic = item.report?.ic ?? [];
            const bs = item.report?.bs ?? [];

            const revenue = findConceptValue(ic, [
                "Revenues",
                "SalesRevenueNet",
                "RevenueFromContractWithCustomerExcludingAssessedTax",
            ]);
            const grossProfit = findConceptValue(ic, ["GrossProfit"]);
            const operatingIncome = findConceptValue(ic, ["OperatingIncomeLoss"]);
            const netIncome = findConceptValue(ic, ["NetIncomeLoss", "NetIncomeLossAvailableToCommonStockholdersBasic"]);

            const eps = findConceptValue(ic, ["EarningsPerShareDiluted", "EarningsPerShareBasic"]);
            const shares = findConceptValue(bs, ["WeightedAverageNumberOfDilutedSharesOutstanding", "CommonStockSharesOutstanding"]);
            const derivedEps = eps ?? (netIncome !== undefined && shares ? netIncome / shares : undefined);

            const fp = item.quarter ? `Q${item.quarter}` : item.fp ?? item.form;
            const fy = item.fiscalYear ?? item.year ?? item.calendaryear ?? (end ? Number(end.slice(0, 4)) : undefined);

            return {
                end,
                fy,
                fp,
                form: item.form,
                revenue,
                grossProfit,
                operatingIncome,
                netIncome,
                eps: derivedEps,
            } satisfies NormalizedFinancialPoint;
        })
        .filter(Boolean) as NormalizedFinancialPoint[];
}

function buildSeries(points: NormalizedFinancialPoint[], filter: (p: NormalizedFinancialPoint) => boolean, limit: number) {
    const filtered = points.filter(filter).sort((a, b) => (a.end < b.end ? 1 : -1));
    const seen = new Set<string>();
    const deduped: NormalizedFinancialPoint[] = [];

    for (const point of filtered) {
        if (seen.has(point.end)) continue;
        deduped.push(point);
        seen.add(point.end);
        if (deduped.length >= limit) break;
    }

    return deduped.map((entry) => ({
        fiscalDate: entry.end,
        fiscalYear: entry.fp && entry.fp.startsWith("Q")
            ? `${entry.fy ?? entry.end.slice(0, 4)} ${entry.fp}`
            : `FY ${entry.fy ?? entry.end.slice(0, 4)}`,
        revenue: entry.revenue,
        grossProfit: entry.grossProfit,
        operatingIncome: entry.operatingIncome,
        netIncome: entry.netIncome,
        eps: entry.eps,
    }));
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
                  url:
                      item.accessionNumber && item.primaryDocument
                          ? buildSecArchiveUrl(cik10, item.accessionNumber, item.primaryDocument)
                          : undefined,
              }
            : undefined;

    return {
        latest10Q: decorate(latest10Q),
        latest10K: decorate(latest10K),
        recent: recent.map((item) => ({
            ...item,
            cik: cik10,
            url:
                item.accessionNumber && item.primaryDocument
                    ? buildSecArchiveUrl(cik10, item.accessionNumber, item.primaryDocument)
                    : undefined,
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

function buildFinancialSeries(
    annualPoints: NormalizedFinancialPoint[],
    quarterlyPoints: NormalizedFinancialPoint[]
) {
    const annualSeries = buildSeries(annualPoints, (p) => p.fp === "FY", MAX_ANNUAL_YEARS);
    const quarterlySeries = buildSeries(
        quarterlyPoints,
        (p) => p.fp === "Q1" || p.fp === "Q2" || p.fp === "Q3" || p.fp === "Q4",
        MAX_QUARTERS
    );

    return { annualSeries, quarterlySeries };
}

function normalizeFinancialResponses(
    annualResponse: { source: "financials" | "financials-reported"; raw: any } | null,
    quarterlyResponse: { source: "financials" | "financials-reported"; raw: any } | null
) {
    const withDefaults = (points: NormalizedFinancialPoint[], freq: "annual" | "quarterly") =>
        points.map((p) => {
            if (freq === "annual") {
                return { ...p, fp: p.fp ?? "FY" };
            }

            const endMonth = p.end ? Number(p.end.slice(5, 7)) : NaN;
            const derivedQuarter = Number.isFinite(endMonth) ? `Q${Math.min(4, Math.max(1, Math.ceil(endMonth / 3)))}` : undefined;
            return { ...p, fp: p.fp ?? derivedQuarter };
        });

    const annualPoints = annualResponse
        ? withDefaults(
              annualResponse.source === "financials"
                  ? normalizeFinancialsFromFinancialsResponse(annualResponse.raw)
                  : normalizeFinancialsFromReported(annualResponse.raw),
              "annual"
          )
        : [];

    const quarterlyPoints = quarterlyResponse
        ? withDefaults(
              quarterlyResponse.source === "financials"
                  ? normalizeFinancialsFromFinancialsResponse(quarterlyResponse.raw)
                  : normalizeFinancialsFromReported(quarterlyResponse.raw),
              "quarterly"
          )
        : [];

    return buildFinancialSeries(annualPoints, quarterlyPoints);
}

export async function getStockProfileV2(symbol: string): Promise<StockProfileV2Model> {
    const { ticker, chartSymbol } = normalizeChartSymbol(symbol);
    const tickerForSec = normalizeTicker(ticker);

    let finnhubProfile: any | null = null;
    let finnhubQuote: any | null = null;
    let finnhubBasics: any | null = null;
    let annualFinancials: { source: "financials" | "financials-reported"; raw: any } | null = null;
    let quarterlyFinancials: { source: "financials" | "financials-reported"; raw: any } | null = null;
    let finnhubError: string | undefined;

    if (process.env.FINNHUB_API_KEY) {
        try {
            [finnhubProfile, finnhubQuote, finnhubBasics, annualFinancials, quarterlyFinancials] = await Promise.all([
                getFinnhubProfile(ticker),
                getFinnhubQuote(ticker),
                getFinnhubBasicFinancials(ticker),
                tryGetFinnhubFinancials(ticker, "ic", "annual"),
                tryGetFinnhubFinancials(ticker, "ic", "quarterly"),
            ]);
        } catch (error) {
            finnhubError = error instanceof Error ? error.message : String(error);
        }
    } else {
        finnhubError = "FINNHUB_API_KEY environment variable is required to load fundamentals.";
    }

    let secTitle: string | undefined;
    let cik10: string | undefined;
    let secExchange: string | undefined;
    let submissions: any | undefined;
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

    const filings = cik10 ? mapFilings(submissions, cik10) : { latest10K: undefined, latest10Q: undefined, recent: [] };

    const { annualSeries, quarterlySeries } = normalizeFinancialResponses(annualFinancials, quarterlyFinancials);

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
