import { StockProfileV2Model } from "@/lib/stocks/stockProfileV2.types";
import { getCikForTicker, getCompanyFacts, getSubmissions, normalizeTicker } from "@/lib/stocks/providers/sec";
import { buildSecArchiveUrl } from "@/lib/stocks/providers/secUrl";

type FactValue = {
    end: string;
    val: number;
    fy?: number;
    fp?: string;
    form?: string;
};

type CompanyFacts = {
    facts?: {
        [key: string]: {
            [factKey: string]: {
                units?: Record<string, FactValue[]>;
            };
        };
    };
};

type Submissions = {
    filings?: {
        recent?: {
            form?: string[];
            filingDate?: string[];
            reportDate?: string[];
            accessionNumber?: string[];
            primaryDocument?: string[];
        };
    };
};

const ANNUAL_FORMS = ["10-K", "20-F", "40-F"];
const QUARTERLY_FORMS = ["10-Q"];
const RECENT_LIMIT = 10;
const MAX_ANNUAL_YEARS = 5;
const MAX_QUARTERS = 12;

function getFactPoints(facts: CompanyFacts, tag: string, preferredUnits: string[]): FactValue[] {
    const tagEntry = facts.facts?.["us-gaap"]?.[tag];
    const units = tagEntry?.units;

    if (!units) return [];

    const unitKeys = Object.keys(units);
    const chosenUnit = preferredUnits.find((unit) => unitKeys.includes(unit)) ?? unitKeys[0];
    const points = chosenUnit ? units[chosenUnit] ?? [] : [];

    return points
        .filter((item) => typeof item.val === "number" && item.end)
        .map((item) => ({
            ...item,
            fy: typeof item.fy === "string" ? Number(item.fy) : item.fy,
        }))
        .sort((a, b) => (a.end < b.end ? 1 : -1));
}

function buildEndDateMap(values: FactValue[]): Map<string, number> {
    const map = new Map<string, number>();

    values.forEach((item) => {
        if (!map.has(item.end)) {
            map.set(item.end, item.val);
        }
    });

    return map;
}

function sortByEndDescending(values: FactValue[], forms: string[]): FactValue[] {
    return [...values].sort((a, b) => {
        if (a.end === b.end) {
            const aPreferred = a.form ? forms.some((form) => a.form?.startsWith(form)) : false;
            const bPreferred = b.form ? forms.some((form) => b.form?.startsWith(form)) : false;

            if (aPreferred !== bPreferred) return aPreferred ? -1 : 1;
            return 0;
        }

        return a.end < b.end ? 1 : -1;
    });
}

function dedupeByEnd(values: FactValue[]): FactValue[] {
    const deduped: FactValue[] = [];
    const seen = new Set<string>();

    values.forEach((item) => {
        if (seen.has(item.end)) return;
        deduped.push(item);
        seen.add(item.end);
    });

    return deduped;
}

function filterByFpAndForm(values: FactValue[], fps: Set<string>, forms: string[]): FactValue[] {
    const filtered = values.filter(
        (item) => item.fp && fps.has(item.fp) && (!item.form || forms.some((form) => item.form?.startsWith(form)))
    );

    return dedupeByEnd(sortByEndDescending(filtered, forms));
}

function filterRevenueSeries(facts: CompanyFacts, fps: Set<string>, forms: string[]): FactValue[] {
    const revenues = getFactPoints(facts, "Revenues", ["USD"]);
    const revenueBase = revenues.length ? revenues : getFactPoints(facts, "SalesRevenueNet", ["USD"]);

    const filtered = revenueBase.filter(
        (item) => item.fp && fps.has(item.fp) && (!item.form || forms.some((form) => item.form?.startsWith(form)))
    );

    return dedupeByEnd(sortByEndDescending(filtered, forms));
}

function mapFilings(submissions: Submissions | undefined, cik10: string) {
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

export async function getStockProfileV2(symbol: string): Promise<StockProfileV2Model> {
    const normalizedSymbol = symbol?.trim();

    if (!normalizedSymbol) {
        throw new Error("Symbol is required for stock profile lookup");
    }

    const upperSymbol = normalizedSymbol.toUpperCase();
    const chartSymbol = normalizedSymbol.includes(":") ? upperSymbol : upperSymbol;
    const tickerForSec = normalizeTicker(upperSymbol);

    const { cik10, title, exchange } = await getCikForTicker(tickerForSec);

    const [submissions, companyFacts] = await Promise.all([
        getSubmissions(cik10).catch((error) => {
            throw new Error(`Unable to fetch SEC submissions: ${error instanceof Error ? error.message : String(error)}`);
        }),
        getCompanyFacts(cik10).catch((error) => {
            throw new Error(`Unable to fetch SEC company facts: ${error instanceof Error ? error.message : String(error)}`);
        }),
    ]);

    const filings = mapFilings(submissions, cik10);

    const annualFps = new Set(["FY"]);
    const quarterlyFps = new Set(["Q1", "Q2", "Q3", "Q4"]);

    const annualRevenueValues = filterRevenueSeries(companyFacts, annualFps, ANNUAL_FORMS).slice(0, MAX_ANNUAL_YEARS);
    const annualRevenueMap = buildEndDateMap(annualRevenueValues);
    const annualGrossProfitMap = buildEndDateMap(
        filterByFpAndForm(getFactPoints(companyFacts, "GrossProfit", ["USD"]), annualFps, ANNUAL_FORMS)
    );
    const annualOperatingIncomeMap = buildEndDateMap(
        filterByFpAndForm(getFactPoints(companyFacts, "OperatingIncomeLoss", ["USD"]), annualFps, ANNUAL_FORMS)
    );
    const annualNetIncomeMap = buildEndDateMap(
        filterByFpAndForm(getFactPoints(companyFacts, "NetIncomeLoss", ["USD"]), annualFps, ANNUAL_FORMS)
    );
    const annualEpsMap = buildEndDateMap(
        filterByFpAndForm(
            getFactPoints(companyFacts, "EarningsPerShareDiluted", ["USD/shares", "USD / shares", "USD/share", "USD"]),
            annualFps,
            ANNUAL_FORMS
        )
    );

    const annual = annualRevenueValues.map((entry) => ({
        fiscalDate: entry.end,
        fiscalYear: `FY ${entry.fy ?? entry.end.slice(0, 4)}`,
        revenue: annualRevenueMap.get(entry.end),
        grossProfit: annualGrossProfitMap.get(entry.end),
        operatingIncome: annualOperatingIncomeMap.get(entry.end),
        netIncome: annualNetIncomeMap.get(entry.end),
        eps: annualEpsMap.get(entry.end),
    }));

    const quarterlyRevenueValues = filterRevenueSeries(companyFacts, quarterlyFps, QUARTERLY_FORMS).slice(0, MAX_QUARTERS);
    const quarterlyRevenueMap = buildEndDateMap(quarterlyRevenueValues);
    const quarterlyGrossProfitMap = buildEndDateMap(
        filterByFpAndForm(getFactPoints(companyFacts, "GrossProfit", ["USD"]), quarterlyFps, QUARTERLY_FORMS)
    );
    const quarterlyOperatingIncomeMap = buildEndDateMap(
        filterByFpAndForm(getFactPoints(companyFacts, "OperatingIncomeLoss", ["USD"]), quarterlyFps, QUARTERLY_FORMS)
    );
    const quarterlyNetIncomeMap = buildEndDateMap(
        filterByFpAndForm(getFactPoints(companyFacts, "NetIncomeLoss", ["USD"]), quarterlyFps, QUARTERLY_FORMS)
    );
    const quarterlyEpsMap = buildEndDateMap(
        filterByFpAndForm(
            getFactPoints(companyFacts, "EarningsPerShareDiluted", ["USD/shares", "USD / shares", "USD/share", "USD"]),
            quarterlyFps,
            QUARTERLY_FORMS
        )
    );

    const quarterly = quarterlyRevenueValues.map((entry) => ({
        fiscalDate: entry.end,
        fiscalYear: `${entry.fy ?? entry.end.slice(0, 4)} ${entry.fp ?? "Quarter"}`.trim(),
        revenue: quarterlyRevenueMap.get(entry.end),
        grossProfit: quarterlyGrossProfitMap.get(entry.end),
        operatingIncome: quarterlyOperatingIncomeMap.get(entry.end),
        netIncome: quarterlyNetIncomeMap.get(entry.end),
        eps: quarterlyEpsMap.get(entry.end),
    }));

    const profile: StockProfileV2Model = {
        companyProfile: {
            name: title,
            ticker: tickerForSec,
            cik: cik10,
            exchange,
            sector: undefined,
            industry: undefined,
            website: undefined,
            description: undefined,
            headquartersCity: undefined,
            headquartersCountry: undefined,
            employees: undefined,
            ceo: undefined,
            country: undefined,
            currency: "USD",
        },
        chartSymbol,
        financialsAnnual: annual,
        financialsQuarterly: quarterly,
        ratios: {},
        earningsLatestQuarter: quarterly.length > 0
            ? {
                  period: quarterly[0].fiscalYear,
                  eps: quarterly[0].eps,
                  revenue: quarterly[0].revenue,
              }
            : undefined,
        earningsLatestAnnual: annual.length > 0
            ? {
                  period: annual[0].fiscalYear,
                  eps: annual[0].eps,
                  revenue: annual[0].revenue,
              }
            : undefined,
        filings,
    };

    return profile;
}
