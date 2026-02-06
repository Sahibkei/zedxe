import "server-only";

import { getQuote } from "@/lib/market/providers";
import { getFinnhubFinancials, getFinnhubMetrics, getFinnhubProfile } from "@/lib/stocks/providers/finnhub";
import type { FinnhubFinancialReport } from "@/lib/stocks/providers/finnhub";
import { canonicalizeSymbol } from "@/src/lib/symbol";
import type { FinancialStatement, MarketDataProvider, QuoteData, StockProfileData } from "./provider";

const formatAnnualLabel = (report: FinnhubFinancialReport) => {
    if (report.year) return `FY${report.year}`;
    if (report.endDate) {
        const parsed = new Date(report.endDate);
        if (!Number.isNaN(parsed.getTime())) return `FY${parsed.getFullYear()}`;
    }
    return report.endDate ?? "FY";
};

const formatQuarterLabel = (report: FinnhubFinancialReport) => {
    if (report.year && report.quarter) return `Q${report.quarter} ${report.year}`;
    if (report.endDate) {
        const parsed = new Date(report.endDate);
        if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    }
    return report.endDate ?? "Q";
};

const groupLabelForRow = (label: string, statement: FinancialStatement["statement"]) => {
    const normalized = label.toLowerCase();
    if (statement === "income") {
        if (normalized.includes("revenue") || normalized.includes("sales")) return "Revenue";
        if (normalized.includes("cost")) return "Cost of Revenue";
        if (normalized.includes("tax")) return "Taxes";
        if (normalized.includes("expense") || normalized.includes("marketing") || normalized.includes("research")) return "Operating Expenses";
        if (normalized.includes("income") || normalized.includes("profit")) return "Profitability";
        return "Other";
    }
    if (statement === "balance") {
        if (normalized.includes("asset") || normalized.includes("cash") || normalized.includes("receivable") || normalized.includes("inventory")) return "Assets";
        if (normalized.includes("liabilit") || normalized.includes("debt")) return "Liabilities";
        if (normalized.includes("equity") || normalized.includes("retained")) return "Equity";
        return "Balance Sheet";
    }
    if (normalized.includes("operating")) return "Operating";
    if (normalized.includes("invest")) return "Investing";
    if (normalized.includes("financ")) return "Financing";
    return "Cash Flow";
};

const buildStatementRows = (
    reports: FinnhubFinancialReport[],
    statement: FinancialStatement["statement"],
    columns: string[],
) => {
    const reportItems = reports.map((report) => {
        const items = statement === "income"
            ? report.report?.ic
            : statement === "balance"
              ? report.report?.bs
              : report.report?.cf;
        return items ?? [];
    });

    const labelOrder: string[] = [];
    const valuesByLabel: Record<string, (number | null)[]> = {};

    const scaleValue = (value: number, unit?: string) => {
        if (!unit) return value;
        const normalized = unit.toLowerCase();
        if (normalized.includes("billion") || normalized.endsWith("b")) return value * 1_000_000_000;
        if (normalized.includes("million") || normalized.endsWith("m")) return value * 1_000_000;
        if (normalized.includes("thousand") || normalized.endsWith("k")) return value * 1_000;
        if (normalized === "usd" && value < 1_000_000_000 && value > 1_000) return value * 1_000_000;
        return value;
    };

    reportItems.forEach((items, reportIndex) => {
        items.forEach((item) => {
            const label = item.label ?? item.concept ?? "Unknown";
            if (!valuesByLabel[label]) {
                valuesByLabel[label] = Array(columns.length).fill(null);
                labelOrder.push(label);
            }
            if (typeof item.value === "number") {
                valuesByLabel[label][reportIndex] = scaleValue(item.value, item.unit);
            }
        });
    });

    return labelOrder.map((label, index) => ({
        key: `${label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${index}`,
        label,
        values: valuesByLabel[label] ?? Array(columns.length).fill(null),
        group: groupLabelForRow(label, statement),
    }));
};

export const finnhubProvider: MarketDataProvider = {
    async getProfile(rawSymbol: string): Promise<StockProfileData> {
        const symbol = canonicalizeSymbol(rawSymbol);
        const [profile, metrics] = await Promise.all([
            getFinnhubProfile(symbol),
            getFinnhubMetrics(symbol),
        ]);

        return {
            symbol,
            name: profile?.name || profile?.ticker || symbol,
            exchange: profile?.exchange,
            sector: profile?.finnhubIndustry,
            website: profile?.weburl,
            description: profile?.description,
            currency: profile?.currency,
            hqCountry: profile?.country,
            marketCap: profile?.marketCapitalization ? profile.marketCapitalization * 1_000_000 : undefined,
            beta: typeof metrics?.metric?.beta === "number" ? metrics.metric.beta : undefined,
            avgVolume:
                typeof metrics?.metric?.["10DayAverageTradingVolume"] === "number"
                    ? metrics.metric["10DayAverageTradingVolume"]
                    : undefined,
            range52wLow:
                typeof metrics?.metric?.["52WeekLow"] === "number" ? metrics.metric["52WeekLow"] : undefined,
            range52wHigh:
                typeof metrics?.metric?.["52WeekHigh"] === "number" ? metrics.metric["52WeekHigh"] : undefined,
            dividendYield: typeof metrics?.metric?.dividendYieldIndicatedAnnual === "number"
                ? metrics.metric.dividendYieldIndicatedAnnual
                : undefined,
            metrics: {
                pe: typeof metrics?.metric?.peNormalizedAnnual === "number" ? metrics.metric.peNormalizedAnnual : undefined,
                pb: typeof metrics?.metric?.pbAnnual === "number" ? metrics.metric.pbAnnual : undefined,
                ps: typeof metrics?.metric?.psAnnual === "number" ? metrics.metric.psAnnual : undefined,
                evToEbitda: typeof metrics?.metric?.evToEbitdaAnnual === "number" ? metrics.metric.evToEbitdaAnnual : undefined,
                debtToEquity: typeof metrics?.metric?.totalDebtToEquityAnnual === "number" ? metrics.metric.totalDebtToEquityAnnual : undefined,
                currentRatio: typeof metrics?.metric?.currentRatioAnnual === "number" ? metrics.metric.currentRatioAnnual : undefined,
                dividendYieldPercent:
                    typeof metrics?.metric?.dividendYieldIndicatedAnnual === "number"
                        ? metrics.metric.dividendYieldIndicatedAnnual
                        : undefined,
            },
        };
    },
    async getFinancialStatement(
        rawSymbol: string,
        statement: FinancialStatement["statement"],
        period: FinancialStatement["period"],
        limit = 8,
    ): Promise<FinancialStatement> {
        const symbol = canonicalizeSymbol(rawSymbol);
        const reports = (await getFinnhubFinancials(symbol, period === "annual" ? "annual" : "quarterly"))?.data ?? [];
        const sorted = [...reports]
            .sort((a, b) => (b.endDate ?? "").localeCompare(a.endDate ?? ""))
            .slice(0, limit);

        const columns = sorted.map((report) =>
            period === "annual" ? formatAnnualLabel(report) : formatQuarterLabel(report),
        );

        const rows = buildStatementRows(sorted, statement, columns);

        return {
            period,
            statement,
            columns,
            rows,
            currency: sorted.find((report) => report.currency)?.currency,
        };
    },
    async getQuote(rawSymbol: string): Promise<QuoteData> {
        const symbol = canonicalizeSymbol(rawSymbol);
        const quote = await getQuote(symbol);
        if (!quote || quote.c === undefined || quote.dp === undefined || quote.d === undefined) {
            throw new Error("Quote data unavailable");
        }
        return {
            symbol,
            price: quote.c,
            change: quote.d,
            changePercent: quote.dp,
            lastTradeAt: new Date().toISOString(),
        };
    },
};
