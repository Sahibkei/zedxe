import { StockProfileV2Model } from "@/lib/stocks/stockProfileV2.types";
import { getCikForTicker, getCompanyFacts, getSubmissions, normalizeTicker } from "@/lib/stocks/providers/sec";
import { buildSecArchiveUrl } from "@/lib/stocks/providers/secUrl";

type FactValue = {
    end: string;
    val: number;
    fy?: string;
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

function getFactValues(
    facts: CompanyFacts,
    tag: string,
    preferredUnits: string[],
    forms?: string[]
): FactValue[] {
    const tagEntry = facts.facts?.["us-gaap"]?.[tag];
    const units = tagEntry?.units;

    if (!units) return [];

    const unitKeys = Object.keys(units);
    const chosenUnit = preferredUnits.find((unit) => unitKeys.includes(unit)) ?? unitKeys.find((key) => key.includes("USD")) ?? unitKeys[0];
    const values = chosenUnit ? units[chosenUnit] ?? [] : [];

    const filtered = forms?.length ? values.filter((item) => !item.form || forms.includes(item.form)) : values;

    return filtered
        .filter((item) => typeof item.val === "number" && item.end)
        .sort((a, b) => (a.end < b.end ? 1 : -1));
}

function buildEndDateMap(values: FactValue[]): Map<string, number> {
    const map = new Map<string, number>();

    values
        .filter((item) => typeof item.val === "number" && item.end)
        .sort((a, b) => (a.end < b.end ? 1 : -1))
        .forEach((item) => {
            if (!map.has(item.end)) {
                map.set(item.end, item.val);
            }
        });

    return map;
}

function selectRevenueValues(
    facts: CompanyFacts,
    forms: string[],
    filterFn: (item: FactValue) => boolean
): FactValue[] {
    const revenues = getFactValues(facts, "Revenues", ["USD"], forms);
    const revenueBase = revenues.length ? revenues : getFactValues(facts, "SalesRevenueNet", ["USD"], forms);

    const filtered = revenueBase.filter(filterFn);

    const uniqueByEnd: FactValue[] = [];
    const seenEnds = new Set<string>();

    filtered.forEach((item) => {
        if (!item.end || seenEnds.has(item.end)) return;
        uniqueByEnd.push(item);
        seenEnds.add(item.end);
    });

    return uniqueByEnd.sort((a, b) => (a.end < b.end ? 1 : -1));
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

    const annualRevenueValues = selectRevenueValues(companyFacts, ANNUAL_FORMS, (item) => item.fp === "FY");
    const annualRevenueMap = buildEndDateMap(annualRevenueValues);
    const annualGrossProfitMap = buildEndDateMap(
        getFactValues(companyFacts, "GrossProfit", ["USD"], ANNUAL_FORMS).filter((item) => item.fp === "FY")
    );
    const annualOperatingIncomeMap = buildEndDateMap(
        getFactValues(companyFacts, "OperatingIncomeLoss", ["USD"], ANNUAL_FORMS).filter((item) => item.fp === "FY")
    );
    const annualNetIncomeMap = buildEndDateMap(
        getFactValues(companyFacts, "NetIncomeLoss", ["USD"], ANNUAL_FORMS).filter((item) => item.fp === "FY")
    );
    const annualEpsMap = buildEndDateMap(
        getFactValues(companyFacts, "EarningsPerShareDiluted", ["USD/shares", "USD / shares", "USD/share", "USD"], ANNUAL_FORMS)
            .filter((item) => item.fp === "FY")
    );

    const annual = annualRevenueValues.slice(0, MAX_ANNUAL_YEARS).map((entry) => ({
        fiscalDate: entry.end,
        fiscalYear: entry.end ? `FY ${entry.end.slice(0, 4)}` : "FY",
        revenue: annualRevenueMap.get(entry.end),
        grossProfit: annualGrossProfitMap.get(entry.end),
        operatingIncome: annualOperatingIncomeMap.get(entry.end),
        netIncome: annualNetIncomeMap.get(entry.end),
        eps: annualEpsMap.get(entry.end),
    }));

    const quarterlyRevenueValues = selectRevenueValues(
        companyFacts,
        QUARTERLY_FORMS,
        (item) => typeof item.fp === "string" && item.fp.startsWith("Q")
    );
    const quarterlyRevenueMap = buildEndDateMap(quarterlyRevenueValues);
    const quarterlyGrossProfitMap = buildEndDateMap(
        getFactValues(companyFacts, "GrossProfit", ["USD"], QUARTERLY_FORMS).filter(
            (item) => typeof item.fp === "string" && item.fp.startsWith("Q")
        )
    );
    const quarterlyOperatingIncomeMap = buildEndDateMap(
        getFactValues(companyFacts, "OperatingIncomeLoss", ["USD"], QUARTERLY_FORMS).filter(
            (item) => typeof item.fp === "string" && item.fp.startsWith("Q")
        )
    );
    const quarterlyNetIncomeMap = buildEndDateMap(
        getFactValues(companyFacts, "NetIncomeLoss", ["USD"], QUARTERLY_FORMS).filter(
            (item) => typeof item.fp === "string" && item.fp.startsWith("Q")
        )
    );
    const quarterlyEpsMap = buildEndDateMap(
        getFactValues(
            companyFacts,
            "EarningsPerShareDiluted",
            ["USD/shares", "USD / shares", "USD/share", "USD"],
            QUARTERLY_FORMS
        )
            .filter((item) => typeof item.fp === "string" && item.fp.startsWith("Q"))
    );

    const quarterly = quarterlyRevenueValues.slice(0, MAX_QUARTERS).map((entry) => ({
        fiscalDate: entry.end,
        fiscalYear: `${entry.end?.slice(0, 4) ?? entry.fy ?? ""} ${entry.fp ?? "Quarter"}`.trim(),
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
