import { StockProfileV2Model } from "@/lib/stocks/stockProfileV2.types";
import {
    buildSecArchiveUrl,
    getCikForTicker,
    getCompanyFacts,
    getSubmissions,
    normalizeTicker,
} from "@/lib/stocks/providers/sec";

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
const MAX_QUARTERS = 8;

function pickUnit(units?: Record<string, FactValue[]>, preferred: string[] = ["USD"]): FactValue[] | undefined {
    if (!units) return undefined;
    const unitKeys = Object.keys(units);

    if (unitKeys.length === 0) return undefined;

    const chosenKey = preferred.find((key) => unitKeys.includes(key)) ?? unitKeys.find((key) => key.includes("USD")) ?? unitKeys[0];
    return chosenKey ? units[chosenKey] : undefined;
}

function getFactValues(facts: CompanyFacts, tag: string, preferredUnits?: string[], forms?: string[]): FactValue[] {
    const tagEntry = facts.facts?.["us-gaap"]?.[tag];
    const values = pickUnit(tagEntry?.units, preferredUnits) || [];

    const filtered = forms?.length
        ? values.filter((item) => !item.form || forms.includes(item.form))
        : values;

    return filtered
        .filter((item) => typeof item.val === "number" && item.end)
        .sort((a, b) => (a.end < b.end ? 1 : -1));
}

function findValueForPeriod(values: FactValue[], fy?: string, fp?: string) {
    return values.find((item) => item.fy === fy && (fp ? item.fp === fp : true));
}

function toStatementEntries(
    facts: CompanyFacts,
    forms: string[],
    limit: number,
    labelFormatter: (fy?: string, fp?: string) => string
) {
    const revenueValues = getFactValues(facts, "Revenues", ["USD"], forms) ?? [];
    const fallbackRevenue = revenueValues.length ? revenueValues : getFactValues(facts, "SalesRevenueNet", ["USD"], forms);
    const base = fallbackRevenue ?? [];

    const yearsOrPeriods: { fy?: string; fp?: string; end: string }[] = [];
    base.forEach((entry) => {
        if (!yearsOrPeriods.some((item) => item.fy === entry.fy && item.fp === entry.fp)) {
            yearsOrPeriods.push({ fy: entry.fy, fp: entry.fp, end: entry.end });
        }
    });

    yearsOrPeriods.sort((a, b) => (a.end < b.end ? 1 : -1));

    const selected = yearsOrPeriods.slice(0, limit);

    const grossProfitValues = getFactValues(facts, "GrossProfit", ["USD"], forms) ?? [];
    const operatingIncomeValues = getFactValues(facts, "OperatingIncomeLoss", ["USD"], forms) ?? [];
    const netIncomeValues = getFactValues(facts, "NetIncomeLoss", ["USD"], forms) ?? [];
    const epsValues =
        getFactValues(facts, "EarningsPerShareDiluted", ["USD/shares", "USD/share", "USD"], forms) ?? [];

    return selected.map((period) => {
        const revenue = findValueForPeriod(base, period.fy, period.fp);
        const grossProfit = findValueForPeriod(grossProfitValues, period.fy, period.fp);
        const operatingIncome = findValueForPeriod(operatingIncomeValues, period.fy, period.fp);
        const netIncome = findValueForPeriod(netIncomeValues, period.fy, period.fp);
        const eps = findValueForPeriod(epsValues, period.fy, period.fp);

        return {
            fiscalDate: period.end,
            fiscalYear: labelFormatter(period.fy, period.fp),
            revenue: revenue?.val,
            grossProfit: grossProfit?.val,
            operatingIncome: operatingIncome?.val,
            netIncome: netIncome?.val,
            eps: eps?.val,
        };
    });
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
    const chartSymbol = normalizedSymbol.includes(":") ? upperSymbol : `NASDAQ:${upperSymbol}`;
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

    const annual = toStatementEntries(
        companyFacts,
        ANNUAL_FORMS,
        MAX_ANNUAL_YEARS,
        (fy) => (fy ? `FY ${fy}` : "FY")
    );

    const quarterLabel = (fy?: string, fp?: string) => {
        const quarter = fp;
        return [fy, quarter].filter(Boolean).join(" ") || "Quarter";
    };

    const quarterly = toStatementEntries(companyFacts, QUARTERLY_FORMS, MAX_QUARTERS, quarterLabel);

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
