const FINNHUB_BASE = "https://finnhub.io/api/v1";

type FinnhubParams = Record<string, string | number | undefined>;

export type FinnhubIncomeRow = {
    periodKey: string;
    periodLabel: string;
    year: number;
    quarter: number;
    revenue?: number;
    grossProfit?: number;
    operatingIncome?: number;
    netIncome?: number;
    eps?: number;
    endDate?: string;
};

async function finnhubFetch(path: string, params: FinnhubParams) {
    const apiKey = process.env.FINNHUB_API_KEY;

    if (!apiKey) {
        throw new Error("FINNHUB_API_KEY environment variable is required to fetch Finnhub data");
    }

    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            searchParams.set(key, String(value));
        }
    });
    searchParams.set("token", apiKey);

    const url = `${FINNHUB_BASE}${path}?${searchParams.toString()}`;

    const response = await fetch(url, {
        signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
        const bodySnippet = await response.text().catch(() => "<unavailable>");
        throw new Error(`Finnhub request failed (${response.status}) for ${path}: ${bodySnippet.slice(0, 200)}`);
    }

    return response.json();
}

export async function getFinnhubProfile(ticker: string) {
    return finnhubFetch("/stock/profile2", { symbol: ticker });
}

export async function getFinnhubQuote(ticker: string) {
    return finnhubFetch("/quote", { symbol: ticker });
}

export async function getFinnhubBasicFinancials(ticker: string) {
    return finnhubFetch("/stock/metric", { symbol: ticker, metric: "all" });
}

export async function getFinancialsReported(
    ticker: string,
    freq: "annual" | "quarterly"
): Promise<
    | { ok: true; data: any[] }
    | { ok: false; reason: "restricted_or_empty"; status?: number; hint?: string; data?: any }
> {
    const apiKey = process.env.FINNHUB_API_KEY;

    if (!apiKey) {
        throw new Error("FINNHUB_API_KEY environment variable is required to fetch Finnhub data");
    }

    const searchParams = new URLSearchParams({ symbol: ticker, freq, token: apiKey });
    const url = `${FINNHUB_BASE}/stock/financials-reported?${searchParams.toString()}`;

    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    const status = response.status;

    let json: any = null;
    try {
        json = await response.json();
    } catch (error) {
        // ignore json parsing errors here; we'll handle below
    }

    if (status === 401 || status === 402 || status === 403) {
        return { ok: false, reason: "restricted_or_empty", status, hint: "Finnhub plan may not include financials-reported.", data: json };
    }

    if (!response.ok) {
        const bodySnippet = typeof json === "string" ? json : JSON.stringify(json ?? {}).slice(0, 200);
        throw new Error(`Finnhub request failed (${status}) for /stock/financials-reported: ${bodySnippet}`);
    }

    const data = json?.data as any[] | undefined;
    if (!data || data.length === 0) {
        return { ok: false, reason: "restricted_or_empty", status, hint: "Finnhub plan may not include financials-reported.", data };
    }

    return { ok: true, data };
}

export async function tryGetFinnhubFinancials(
    ticker: string,
    statement: "ic" | "bs" | "cf",
    freq: "annual" | "quarterly"
): Promise<{ source: "financials" | "financials-reported"; raw: any } | null> {
    try {
        const data = await finnhubFetch("/stock/financials", { symbol: ticker, statement, freq });
        return { source: "financials", raw: data };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // fall back to financials-reported if primary endpoint is unavailable (e.g., plan limits)
        try {
            const data = await finnhubFetch("/stock/financials-reported", { symbol: ticker, freq });
            return { source: "financials-reported", raw: data };
        } catch (fallbackError) {
            throw new Error(
                `Unable to fetch Finnhub financials (${statement}/${freq}). Primary error: ${message}. Fallback error: ${
                    fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
                }`
            );
        }
    }
}

function normalizeKey(value?: string) {
    return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function pickNumber(value: any): number | undefined {
    if (typeof value === "number" && !Number.isNaN(value)) return value;
    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    if (value && typeof value === "object") {
        const nested = value.value ?? value.val ?? value.v ?? value.amount;
        return pickNumber(nested);
    }
    return undefined;
}

function findConcept(
    lines: any[] | undefined,
    concepts: string[],
    labels: string[],
    unitAllowlist?: string[]
): number | undefined {
    if (!Array.isArray(lines)) return undefined;

    const conceptKeys = concepts.map(normalizeKey);
    const labelKeys = labels.map(normalizeKey);

    for (const line of lines) {
        const conceptKey = normalizeKey(line?.concept);
        const labelKey = normalizeKey(line?.label);

        const matchesConcept = conceptKey && conceptKeys.includes(conceptKey);
        const matchesLabel = labelKey && labelKeys.includes(labelKey);

        if (!matchesConcept && !matchesLabel) continue;
        if (unitAllowlist && line?.unit && !unitAllowlist.includes(line.unit)) continue;

        const directNumber = pickNumber(line?.value ?? line?.val ?? line?.v ?? line?.amount);
        if (directNumber !== undefined) return directNumber;

        if (line?.value && typeof line.value === "object") {
            for (const candidate of Object.values(line.value)) {
                const parsed = pickNumber(candidate);
                if (parsed !== undefined) return parsed;
            }
        }
    }

    return undefined;
}

export function parseIncomeStatementRowsFromReported(data: any[], freq: "annual" | "quarterly"): FinnhubIncomeRow[] {
    if (!Array.isArray(data)) return [];

    const preferredRevenueUnits = ["USD"];
    const preferredEpsUnits = ["USD/shares", "USD / shares"];

    return data
        .map((item) => {
            const year = typeof item?.year === "number" ? item.year : Number(item?.year);
            const quarter = typeof item?.quarter === "number" ? item.quarter : Number(item?.quarter ?? 0);
            if (!Number.isFinite(year)) return null;

            const periodKey = quarter && quarter > 0 ? `${year}Q${quarter}` : `${year}FY`;
            const periodLabel = quarter && quarter > 0 ? `${year} Q${quarter}` : `FY ${year}`;
            const icLines = item?.report?.ic ?? [];

            const revenue = findConcept(
                icLines,
                [
                    "us-gaap_Revenues",
                    "Revenues",
                    "SalesRevenueNet",
                    "RevenueFromContractWithCustomerExcludingAssessedTax",
                ],
                ["Total revenue", "Net sales", "Revenue"],
                preferredRevenueUnits
            );

            const grossProfit = findConcept(icLines, ["us-gaap_GrossProfit", "GrossProfit"], ["Gross profit"], preferredRevenueUnits);

            const operatingIncome = findConcept(
                icLines,
                ["us-gaap_OperatingIncomeLoss", "OperatingIncomeLoss"],
                ["Operating income", "Income from operations"],
                preferredRevenueUnits
            );

            const netIncome = findConcept(
                icLines,
                ["us-gaap_NetIncomeLoss", "NetIncomeLoss", "NetIncomeLossAvailableToCommonStockholdersBasic"],
                ["Net income", "Net income (loss)"],
                preferredRevenueUnits
            );

            const eps = findConcept(
                icLines,
                [
                    "us-gaap_EarningsPerShareDiluted",
                    "EarningsPerShareDiluted",
                    "us-gaap_EarningsPerShareBasic",
                    "EarningsPerShareBasic",
                ],
                ["Earnings per share", "EPS diluted", "EPS basic"],
                preferredEpsUnits
            );

            return {
                periodKey,
                periodLabel,
                year,
                quarter: Number.isFinite(quarter) ? quarter : 0,
                revenue,
                grossProfit,
                operatingIncome,
                netIncome,
                eps,
                endDate: item?.endDate ?? item?.period,
            } satisfies FinnhubIncomeRow;
        })
        .filter(Boolean) as FinnhubIncomeRow[];
}
