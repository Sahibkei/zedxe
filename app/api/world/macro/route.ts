import { NextResponse } from "next/server";
import { fetchJsonWithTimeout } from "@/lib/http/fetchWithTimeout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type MacroMetricKey = "inflation" | "interest" | "gdp" | "unemployment" | "debt";

type CountryPoint = {
    iso3: string;
    country: string;
    value: number;
    year: number;
};

type MacroResponse = {
    updatedAt: string;
    source: "worldbank";
    metric: MacroMetricKey;
    label: string;
    unit: string;
    countries: CountryPoint[];
    stats: {
        coverage: number;
        min: number;
        max: number;
        median: number;
    } | null;
    warning?: string;
};

type WorldBankMeta = {
    page: number;
    pages: number;
    per_page: string;
    total: number;
};

type WorldBankCountryRow = {
    id?: string;
    iso2Code?: string;
    name?: string;
    region?: {
        value?: string;
    };
};

type WorldBankValueRow = {
    countryiso3code?: string;
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
const COUNTRY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PER_PAGE = 1000;
const MRV = 6;

const macroCache = new Map<MacroMetricKey, { expiresAt: number; payload: MacroResponse }>();
let countriesCache: { expiresAt: number; validIso3: Set<string> } | null = null;

const parseMetric = (input: string | null): MacroMetricKey => {
    if (!input) return "inflation";
    const normalized = input.trim().toLowerCase();
    if (normalized === "interest") return "interest";
    if (normalized === "gdp") return "gdp";
    if (normalized === "unemployment") return "unemployment";
    if (normalized === "debt") return "debt";
    return "inflation";
};

const percentile = (values: number[], p: number) => {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const idx = (sorted.length - 1) * p;
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    if (lower === upper) return sorted[lower];
    const weight = idx - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
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

const fetchValidCountries = async () => {
    if (countriesCache && countriesCache.expiresAt > Date.now()) {
        return countriesCache.validIso3;
    }

    const url = `https://api.worldbank.org/v2/country/all?format=json&per_page=400`;
    const data = await fetchJson<[WorldBankMeta, WorldBankCountryRow[]]>(url);
    const rows = data?.[1] ?? [];

    const validIso3 = new Set<string>(
        rows
            .filter((row) => row?.region?.value && row.region.value !== "Aggregates")
            .map((row) => row.id?.toUpperCase() ?? "")
            .filter((iso3) => /^[A-Z]{3}$/.test(iso3))
    );

    countriesCache = {
        expiresAt: Date.now() + COUNTRY_CACHE_TTL_MS,
        validIso3,
    };

    return validIso3;
};

const fetchIndicatorSeries = async (indicatorId: string) => {
    const firstUrl = `https://api.worldbank.org/v2/country/all/indicator/${indicatorId}?format=json&mrv=${MRV}&per_page=${PER_PAGE}&page=1`;
    const first = await fetchJson<[WorldBankMeta, WorldBankValueRow[]]>(firstUrl);
    const meta = first?.[0];
    const pages = Number(meta?.pages ?? 1);
    const allRows: WorldBankValueRow[] = [...(first?.[1] ?? [])];

    for (let page = 2; page <= pages; page += 1) {
        const url = `https://api.worldbank.org/v2/country/all/indicator/${indicatorId}?format=json&mrv=${MRV}&per_page=${PER_PAGE}&page=${page}`;
        const chunk = await fetchJson<[WorldBankMeta, WorldBankValueRow[]]>(url);
        allRows.push(...(chunk?.[1] ?? []));
    }

    return allRows;
};

const toMacroResponse = (metric: MacroMetricKey, rows: WorldBankValueRow[], validIso3: Set<string>): MacroResponse => {
    const config = METRICS[metric];
    const byCountry = new Map<string, CountryPoint>();

    for (const row of rows) {
        const iso3 = row.countryiso3code?.toUpperCase() ?? "";
        if (!validIso3.has(iso3)) continue;
        if (typeof row.value !== "number" || !Number.isFinite(row.value)) continue;

        const year = Number.parseInt(`${row.date ?? ""}`, 10);
        if (!Number.isFinite(year)) continue;

        const current = byCountry.get(iso3);
        if (!current || year > current.year) {
            byCountry.set(iso3, {
                iso3,
                country: row.country?.value?.trim() || iso3,
                value: row.value,
                year,
            });
        }
    }

    const countries = Array.from(byCountry.values());
    const values = countries.map((point) => point.value);
    const stats =
        values.length > 0
            ? {
                  coverage: values.length,
                  min: Math.min(...values),
                  max: Math.max(...values),
                  median: percentile(values, 0.5),
              }
            : null;

    return {
        updatedAt: new Date().toISOString(),
        source: "worldbank",
        metric,
        label: config.label,
        unit: config.unit,
        countries,
        stats,
    };
};

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const metric = parseMetric(searchParams.get("metric"));

    const cached = macroCache.get(metric);
    if (cached && cached.expiresAt > Date.now()) {
        return NextResponse.json(cached.payload, {
            headers: { "Cache-Control": "no-store" },
        });
    }

    try {
        const indicatorId = METRICS[metric].indicatorId;
        const [validIso3, rows] = await Promise.all([fetchValidCountries(), fetchIndicatorSeries(indicatorId)]);
        const payload = toMacroResponse(metric, rows, validIso3);

        macroCache.set(metric, {
            expiresAt: Date.now() + CACHE_TTL_MS,
            payload,
        });

        return NextResponse.json(payload, {
            headers: { "Cache-Control": "no-store" },
        });
    } catch (error) {
        console.error("World macro fetch failed", error);
        return NextResponse.json(
            {
                updatedAt: new Date().toISOString(),
                source: "worldbank",
                metric,
                label: METRICS[metric].label,
                unit: METRICS[metric].unit,
                countries: [],
                stats: null,
                warning: "Macro indicator data is temporarily unavailable.",
            } satisfies MacroResponse,
            {
                headers: { "Cache-Control": "no-store" },
            }
        );
    }
}

