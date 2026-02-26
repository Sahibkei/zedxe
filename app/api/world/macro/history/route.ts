import { NextResponse } from "next/server";
import { fetchJsonWithTimeout } from "@/lib/http/fetchWithTimeout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type MacroMetricKey = "inflation" | "interest" | "gdp" | "unemployment" | "debt";

type MacroHistoryPoint = {
    year: number;
    value: number;
};

type MacroHistoryResponse = {
    updatedAt: string;
    source: "worldbank";
    metric: MacroMetricKey;
    label: string;
    unit: string;
    countryIso3: string;
    country: string;
    series: MacroHistoryPoint[];
    warning?: string;
};

type WorldBankValueRow = {
    country?: {
        value?: string;
    };
    date?: string;
    value?: number | null;
};

const METRICS: Record<MacroMetricKey, { indicatorId: string; label: string; unit: string }> = {
    inflation: {
        indicatorId: "FP.CPI.TOTL.ZG",
        label: "Inflation Rate",
        unit: "%",
    },
    interest: {
        indicatorId: "FR.INR.RINR",
        label: "Interest Rate",
        unit: "%",
    },
    gdp: {
        indicatorId: "NY.GDP.MKTP.CD",
        label: "GDP",
        unit: "USD",
    },
    unemployment: {
        indicatorId: "SL.UEM.TOTL.ZS",
        label: "Unemployment Rate",
        unit: "%",
    },
    debt: {
        indicatorId: "GC.DOD.TOTL.GD.ZS",
        label: "Government Debt to GDP",
        unit: "%",
    },
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_YEARS = 10;
const MAX_YEARS = 20;

const cache = new Map<string, { expiresAt: number; payload: MacroHistoryResponse }>();

const parseMetric = (input: string | null): MacroMetricKey => {
    if (!input) return "inflation";
    const normalized = input.trim().toLowerCase();
    if (normalized === "interest") return "interest";
    if (normalized === "gdp") return "gdp";
    if (normalized === "unemployment") return "unemployment";
    if (normalized === "debt") return "debt";
    return "inflation";
};

const parseCountry = (input: string | null) => {
    const iso = (input ?? "").trim().toUpperCase();
    return /^[A-Z]{3}$/.test(iso) ? iso : "";
};

const parseYears = (input: string | null) => {
    const parsed = Number.parseInt(input ?? `${DEFAULT_YEARS}`, 10);
    if (!Number.isFinite(parsed)) return DEFAULT_YEARS;
    return Math.max(3, Math.min(MAX_YEARS, parsed));
};

const fetchJson = async <T>(url: string): Promise<T> => {
    const result = await fetchJsonWithTimeout<T>(
        url,
        {
            cache: "no-store",
            headers: {
                Accept: "application/json",
                "User-Agent": "Mozilla/5.0",
            },
        },
        { timeoutMs: 12000, retries: 2, backoffBaseMs: 250 }
    );
    if (!result.ok) {
        throw new Error(`World Bank request failed: ${result.status ?? result.error}`);
    }
    return result.data;
};

const buildEmpty = (
    metric: MacroMetricKey,
    countryIso3: string,
    warning: string,
    country = countryIso3 || "Unknown Country"
): MacroHistoryResponse => ({
    updatedAt: new Date().toISOString(),
    source: "worldbank",
    metric,
    label: METRICS[metric].label,
    unit: METRICS[metric].unit,
    countryIso3,
    country,
    series: [],
    warning,
});

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const metric = parseMetric(searchParams.get("metric"));
    const countryIso3 = parseCountry(searchParams.get("country"));
    const years = parseYears(searchParams.get("years"));

    if (!countryIso3) {
        return NextResponse.json(buildEmpty(metric, "", "Country must be a valid ISO-3 code."), {
            headers: { "Cache-Control": "no-store" },
        });
    }

    const cacheKey = `${metric}:${countryIso3}:${years}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return NextResponse.json(cached.payload, {
            headers: { "Cache-Control": "no-store" },
        });
    }

    try {
        const indicatorId = METRICS[metric].indicatorId;
        const url = `https://api.worldbank.org/v2/country/${countryIso3}/indicator/${indicatorId}?format=json&per_page=80`;
        const data = await fetchJson<[unknown, WorldBankValueRow[]]>(url);
        const rows = data?.[1] ?? [];

        const parsed = rows
            .map((row) => {
                const year = Number.parseInt(`${row.date ?? ""}`, 10);
                const value = row.value;
                if (!Number.isFinite(year) || typeof value !== "number" || !Number.isFinite(value)) {
                    return null;
                }
                return { year, value, country: row.country?.value?.trim() || countryIso3 };
            })
            .filter((row): row is { year: number; value: number; country: string } => row !== null)
            .sort((a, b) => b.year - a.year)
            .slice(0, years)
            .sort((a, b) => a.year - b.year);

        const payload: MacroHistoryResponse = {
            updatedAt: new Date().toISOString(),
            source: "worldbank",
            metric,
            label: METRICS[metric].label,
            unit: METRICS[metric].unit,
            countryIso3,
            country: parsed[parsed.length - 1]?.country ?? countryIso3,
            series: parsed.map((row) => ({ year: row.year, value: row.value })),
            warning: parsed.length ? undefined : "No historical data found for this country and indicator.",
        };

        cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, payload });

        return NextResponse.json(payload, {
            headers: { "Cache-Control": "no-store" },
        });
    } catch (error) {
        console.error("World macro history fetch failed", error);
        return NextResponse.json(
            buildEmpty(metric, countryIso3, "Historical data is temporarily unavailable."),
            {
                headers: { "Cache-Control": "no-store" },
            }
        );
    }
}
