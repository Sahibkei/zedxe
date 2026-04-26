import "server-only";

import { envServer } from "../../src/lib/env/server";
import type {
    ProviderStatus,
    StatementColumn,
    StatementGrid,
    StatementRow,
    StatementValueType,
    StockFinancialRow,
    StockProfileV2Model,
} from "./stockProfileV2.types";

type ZapiRegime = "sec_edgar" | "companies_house" | "edinet" | "india_placeholder";
type ZapiStatementType = "income_statement" | "balance_sheet" | "cash_flow";
type ZapiFrequency = "annual" | "quarterly";

type ZapiNormalizedStatementResponse = {
    meta: {
        ticker: string;
        companyName: string;
        statement: ZapiStatementType;
        frequency: ZapiFrequency;
        view: "restated" | "as_reported";
        currency: string;
        fiscalYearEnd: string;
        titleSlug: string;
        sourceRegime: ZapiRegime;
        requestedPeriods: number;
        returnedPeriods: number;
        historyCoverage: "full" | "partial";
        historyNote?: string;
    };
    columns: string[];
    rows: Array<{
        metricCode: string;
        label: string;
        depth: number;
        unit: string;
        rowKind: "section" | "metric";
        values: Array<number | null>;
    }>;
    periods: Record<string, Record<string, number | null>>;
};

type ZapiRequestContext = {
    identifier: string;
    regime: ZapiRegime;
};

type ZapiFinancialsResult = {
    annual?: StockFinancialRow[];
    quarterly?: StockFinancialRow[];
    statements?: NonNullable<StockProfileV2Model["financials"]["statements"]>;
    status: ProviderStatus[];
};

type ZapiFetchParams = {
    identifier: string;
    regime: ZapiRegime;
    statement: ZapiStatementType;
    frequency: ZapiFrequency;
    periods: number;
};

const SUMMARY_METRIC_PRIORITY = {
    revenue: ["revenue_total", "business_revenue"] as const,
    grossProfit: ["gross_profit"] as const,
    operatingIncome: ["operating_income", "total_operating_profit_loss"] as const,
    netIncome: [
        "net_income_available_to_common_stockholders",
        "net_income_after_non_controlling_interests",
        "net_income_after_extraordinary",
        "net_income_before_extraordinary",
        "net_income",
    ] as const,
    eps: ["eps_diluted", "eps_basic"] as const,
    operatingCashFlow: ["operating_cash_flow"] as const,
};

const ZAPI_REQUEST_TIMEOUT_MS = 15_000;

function pickMetric(
    period: Record<string, number | null> | undefined,
    metricCodes: readonly string[]
): number | undefined {
    if (!period) return undefined;

    for (const metricCode of metricCodes) {
        const value = period[metricCode];
        if (typeof value === "number") return value;
    }

    return undefined;
}

function hasRowValues(row: StockFinancialRow): boolean {
    return [
        row.revenue,
        row.grossProfit,
        row.operatingIncome,
        row.netIncome,
        row.eps,
        row.operatingCashFlow,
    ].some((value) => typeof value === "number");
}

function toStatementValueType(unit: string): StatementValueType {
    if (unit === "shares") return "count";
    if (unit.toLowerCase().includes("share")) return "perShare";
    return "currency";
}

function toColumnLabel(label: string): string {
    const annualMatch = label.match(/^(\d{4})$/);
    if (annualMatch) return `FY ${annualMatch[1]}`;

    const quarterMatch = label.match(/^(\d{4})-Q([1-4])$/);
    if (quarterMatch) return `Q${quarterMatch[2]} ${quarterMatch[1]}`;

    return label;
}

function toOrderedColumnEntries(labels: string[]) {
    const dated = labels
        .map((label, index) => ({ label, index }))
        .filter((entry) => entry.label !== "TTM")
        .reverse();
    const ttm = labels
        .map((label, index) => ({ label, index }))
        .filter((entry) => entry.label === "TTM");

    return [...ttm, ...dated];
}

function toStatementColumns(labels: string[], currency?: string): StatementColumn[] {
    return toOrderedColumnEntries(labels).map((entry, orderedIndex) => ({
        key: `zapi-${orderedIndex}`,
        label: toColumnLabel(entry.label),
        type: entry.label === "TTM" ? "ttm" : "annual",
        currency,
    }));
}

function toStatementRows(
    rows: ZapiNormalizedStatementResponse["rows"],
    columns: StatementColumn[],
    sourceLabels: string[]
): StatementRow[] {
    const orderedEntries = toOrderedColumnEntries(sourceLabels);
    const root: StatementRow[] = [];
    const stack: Array<{ depth: number; row: StatementRow }> = [];

    for (const sourceRow of rows) {
        const valuesByColumnKey: Record<string, number | undefined> = {};
        orderedEntries.forEach((entry, orderedIndex) => {
            const value = sourceRow.values[entry.index];
            valuesByColumnKey[columns[orderedIndex]?.key ?? `zapi-${orderedIndex}`] =
                typeof value === "number" ? value : undefined;
        });

        const mappedRow: StatementRow = {
            id: sourceRow.metricCode,
            label: sourceRow.label,
            concept: sourceRow.metricCode,
            valueType: toStatementValueType(sourceRow.unit),
            valuesByColumnKey,
        };

        while (stack.length > 0 && sourceRow.depth <= stack[stack.length - 1].depth) {
            stack.pop();
        }

        if (stack.length === 0) {
            root.push(mappedRow);
        } else {
            const parent = stack[stack.length - 1].row;
            parent.children ||= [];
            parent.children.push(mappedRow);
        }

        stack.push({ depth: sourceRow.depth, row: mappedRow });
    }

    return root;
}

function toStatementGrid(statement: ZapiNormalizedStatementResponse): StatementGrid {
    const columns = toStatementColumns(statement.columns, statement.meta.currency);

    return {
        columns,
        rows: toStatementRows(statement.rows, columns, statement.columns),
        currency: statement.meta.currency,
    };
}

function toSummaryRows(
    incomeStatement: ZapiNormalizedStatementResponse,
    cashFlowStatement?: ZapiNormalizedStatementResponse
): StockFinancialRow[] {
    return incomeStatement.columns
        .filter((column) => column !== "TTM")
        .map((column) => {
            const incomePeriod = incomeStatement.periods[column];
            const cashPeriod = cashFlowStatement?.periods[column];

            return {
                label: toColumnLabel(column),
                revenue: pickMetric(incomePeriod, SUMMARY_METRIC_PRIORITY.revenue),
                grossProfit: pickMetric(incomePeriod, SUMMARY_METRIC_PRIORITY.grossProfit),
                operatingIncome: pickMetric(incomePeriod, SUMMARY_METRIC_PRIORITY.operatingIncome),
                netIncome: pickMetric(incomePeriod, SUMMARY_METRIC_PRIORITY.netIncome),
                eps: pickMetric(incomePeriod, SUMMARY_METRIC_PRIORITY.eps),
                operatingCashFlow: pickMetric(cashPeriod, SUMMARY_METRIC_PRIORITY.operatingCashFlow),
                currency: incomeStatement.meta.currency,
            } satisfies StockFinancialRow;
        })
        .filter(hasRowValues)
        .reverse();
}

function normalizeIdentifier(value: string): string {
    const normalized = value.toUpperCase().trim().replace(/^.*:/, "");
    const dotIndex = normalized.indexOf(".");
    return dotIndex === -1 ? normalized : normalized.slice(0, dotIndex);
}

function includesAny(value: string | undefined, needles: string[]): boolean {
    const haystack = value?.toUpperCase() ?? "";
    return needles.some((needle) => haystack.includes(needle));
}

export function isZapiConfigured(): boolean {
    return Boolean(envServer.ZAPI_BASE_URL && envServer.ZAPI_INTERNAL_API_KEY);
}

export function inferZapiRequestContext(input: {
    symbolRaw: string;
    finnhubSymbol: string;
    secTicker: string;
    company: StockProfileV2Model["company"];
}): ZapiRequestContext {
    const normalizedSymbol = normalizeIdentifier(input.finnhubSymbol || input.symbolRaw || input.secTicker);
    const country = input.company.country?.toUpperCase();
    const exchange = input.company.exchange?.toUpperCase();

    if (
        includesAny(country, ["INDIA"]) ||
        includesAny(exchange, ["NSE", "BSE", "NSI"]) ||
        /\.(NS|BO)$/i.test(input.symbolRaw)
    ) {
        return {
            identifier: normalizedSymbol,
            regime: "india_placeholder",
        };
    }

    if (
        includesAny(country, ["UNITED KINGDOM", "UK"]) ||
        includesAny(exchange, ["LSE", "LONDON"]) ||
        /\.L$/i.test(input.symbolRaw)
    ) {
        return {
            identifier: normalizedSymbol,
            regime: "companies_house",
        };
    }

    if (
        includesAny(country, ["JAPAN"]) ||
        includesAny(exchange, ["TOKYO", "JPX"]) ||
        /\.T$/i.test(input.symbolRaw)
    ) {
        return {
            identifier: normalizedSymbol,
            regime: "edinet",
        };
    }

    return {
        identifier: normalizeIdentifier(input.secTicker || input.finnhubSymbol || input.symbolRaw),
        regime: "sec_edgar",
    };
}

async function fetchZapiStatement({
    identifier,
    regime,
    statement,
    frequency,
    periods,
}: ZapiFetchParams): Promise<ZapiNormalizedStatementResponse> {
    if (!envServer.ZAPI_BASE_URL || !envServer.ZAPI_INTERNAL_API_KEY) {
        throw new Error("Zapi environment is not configured.");
    }

    const url = new URL(`/v1/statements/${encodeURIComponent(identifier)}`, envServer.ZAPI_BASE_URL);
    url.searchParams.set("regime", regime);
    url.searchParams.set("statement", statement);
    url.searchParams.set("frequency", frequency);
    url.searchParams.set("format", "normalized");
    url.searchParams.set("periods", String(periods));
    url.searchParams.set("includeTtm", "false");

    const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
            "x-zapi-api-key": envServer.ZAPI_INTERNAL_API_KEY,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(ZAPI_REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
        let details = `${response.status} ${response.statusText}`;

        try {
            const payload = await response.json();
            if (payload?.message) {
                details = `${response.status} ${payload.message}`;
            }
        } catch {
            // Ignore JSON parse failures and keep the HTTP details.
        }

        throw new Error(details);
    }

    return (await response.json()) as ZapiNormalizedStatementResponse;
}

export async function getZapiFinancials(
    context: ZapiRequestContext,
    periods = 10
): Promise<ZapiFinancialsResult> {
    const requests = [
        { key: "annualIncome", statement: "income_statement", frequency: "annual" },
        { key: "annualBalance", statement: "balance_sheet", frequency: "annual" },
        { key: "annualCash", statement: "cash_flow", frequency: "annual" },
        { key: "quarterlyIncome", statement: "income_statement", frequency: "quarterly" },
        { key: "quarterlyBalance", statement: "balance_sheet", frequency: "quarterly" },
        { key: "quarterlyCash", statement: "cash_flow", frequency: "quarterly" },
    ] as const;

    const settled = await Promise.allSettled(
        requests.map((request) =>
            fetchZapiStatement({
                identifier: context.identifier,
                regime: context.regime,
                statement: request.statement,
                frequency: request.frequency,
                periods,
            })
        )
    );

    const results = new Map<(typeof requests)[number]["key"], ZapiNormalizedStatementResponse>();
    const errors: string[] = [];

    settled.forEach((result, index) => {
        const request = requests[index];
        if (result.status === "fulfilled") {
            results.set(request.key, result.value);
        } else {
            errors.push(`${request.key}: ${result.reason instanceof Error ? result.reason.message : "unknown error"}`);
        }
    });

    const annualIncome = results.get("annualIncome");
    const annualBalance = results.get("annualBalance");
    const annualCash = results.get("annualCash");
    const quarterlyIncome = results.get("quarterlyIncome");
    const quarterlyBalance = results.get("quarterlyBalance");
    const quarterlyCash = results.get("quarterlyCash");

    const hasAnyStatements = Boolean(
        annualIncome || annualBalance || annualCash || quarterlyIncome || quarterlyBalance || quarterlyCash
    );

    const status: ProviderStatus[] = [];
    if (hasAnyStatements) {
        status.push({
            source: "zapi",
            level: "info",
            message: `Financial statements loaded from Zapi (${context.regime}).`,
        });
    }

    if (!hasAnyStatements && errors.length > 0) {
        throw new Error(errors.join(" | "));
    }

    return {
        annual: annualIncome ? toSummaryRows(annualIncome, annualCash) : undefined,
        quarterly: quarterlyIncome ? toSummaryRows(quarterlyIncome, quarterlyCash) : undefined,
        statements: {
            income: annualIncome ? toStatementGrid(annualIncome) : undefined,
            balanceSheet: annualBalance ? toStatementGrid(annualBalance) : undefined,
            cashFlow: annualCash ? toStatementGrid(annualCash) : undefined,
            quarterly: {
                income: quarterlyIncome ? toStatementGrid(quarterlyIncome) : undefined,
                balanceSheet: quarterlyBalance ? toStatementGrid(quarterlyBalance) : undefined,
                cashFlow: quarterlyCash ? toStatementGrid(quarterlyCash) : undefined,
            },
        },
        status,
    };
}
