import { NextResponse } from "next/server";
import { fetchJsonWithTimeout } from "@/lib/http/fetchWithTimeout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_SYMBOLS = ["^GSPC", "^NDX", "^DJI"] as const;
const MAX_SYMBOLS = 8;
const CACHE_TTL_MS = 30_000;
const MAX_CACHE_ENTRIES = 240;

const RANGE_CONFIG: Record<
    string,
    {
        yahooRange: string;
        yahooInterval: string;
    }
> = {
    "1D": { yahooRange: "1d", yahooInterval: "5m" },
    "1M": { yahooRange: "1mo", yahooInterval: "1d" },
    "3M": { yahooRange: "3mo", yahooInterval: "1d" },
    "YTD": { yahooRange: "ytd", yahooInterval: "1d" },
    "1Y": { yahooRange: "1y", yahooInterval: "1d" },
    "5Y": { yahooRange: "5y", yahooInterval: "1wk" },
};

type YahooChartResponse = {
    chart?: {
        result?: Array<{
            timestamp?: number[];
            meta?: {
                symbol?: string;
                shortName?: string;
                longName?: string;
            };
            indicators?: {
                quote?: Array<{
                    close?: Array<number | null>;
                }>;
            };
        }>;
        error?: {
            code?: string;
            description?: string;
        };
    };
};

type PerformancePoint = {
    t: number;
    close: number;
};

type PerformanceSeries = {
    symbol: string;
    name: string;
    points: PerformancePoint[];
};

type PerformanceResponse = {
    updatedAt: string;
    range: string;
    source: "yahoo";
    series: PerformanceSeries[];
};

const cache = new Map<string, { expiresAt: number; payload: PerformanceResponse }>();

const parseSymbols = (symbolsParam: string | null) => {
    const normalizedSymbols = symbolsParam
        ? symbolsParam
              .split(",")
              .map((symbol) => symbol.trim().toUpperCase())
              .filter(Boolean)
        : [];

    const rawSymbols = normalizedSymbols.length ? normalizedSymbols : [...DEFAULT_SYMBOLS];
    return Array.from(new Set(rawSymbols)).slice(0, MAX_SYMBOLS);
};

const pruneExpiredCacheEntries = (now: number) => {
    for (const [key, entry] of cache) {
        if (entry.expiresAt <= now) {
            cache.delete(key);
        }
    }
};

const getCachedPayload = (cacheKey: string): PerformanceResponse | null => {
    const now = Date.now();
    const cached = cache.get(cacheKey);
    if (!cached) return null;
    if (cached.expiresAt <= now) {
        cache.delete(cacheKey);
        return null;
    }

    // Refresh insertion order so older keys are evicted first.
    cache.delete(cacheKey);
    cache.set(cacheKey, cached);
    return cached.payload;
};

const setCachedPayload = (cacheKey: string, payload: PerformanceResponse) => {
    const now = Date.now();
    pruneExpiredCacheEntries(now);
    cache.delete(cacheKey);
    cache.set(cacheKey, { expiresAt: now + CACHE_TTL_MS, payload });

    while (cache.size > MAX_CACHE_ENTRIES) {
        const oldestKey = cache.keys().next().value as string | undefined;
        if (!oldestKey) break;
        cache.delete(oldestKey);
    }
};

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const parseRange = (rangeParam: string | null) => {
    const normalized = (rangeParam ?? "1Y").toUpperCase();
    return RANGE_CONFIG[normalized] ? normalized : "1Y";
};

const fetchSeries = async (
    symbol: string,
    range: string
): Promise<PerformanceSeries | null> => {
    const config = RANGE_CONFIG[range] ?? RANGE_CONFIG["1Y"];
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        symbol
    )}?range=${config.yahooRange}&interval=${config.yahooInterval}`;

    const result = await fetchJsonWithTimeout<YahooChartResponse>(
        url,
        {
            cache: "no-store",
            headers: {
                Accept: "application/json",
                "User-Agent": "Mozilla/5.0",
            },
        },
        { timeoutMs: 9000, retries: 1, backoffBaseMs: 250 }
    );

    if (!result.ok) {
        return null;
    }

    const payload = result.data;
    if (payload.chart?.error) return null;

    const node = payload.chart?.result?.[0];
    const timestamps = node?.timestamp ?? [];
    const closes = node?.indicators?.quote?.[0]?.close ?? [];

    if (!timestamps.length || !closes.length) return null;

    const pointsCount = Math.min(timestamps.length, closes.length);
    const points: PerformancePoint[] = [];

    for (let index = 0; index < pointsCount; index += 1) {
        const t = timestamps[index];
        const close = closes[index];
        if (!isFiniteNumber(t) || !isFiniteNumber(close)) continue;
        points.push({ t, close });
    }

    if (points.length < 2) return null;

    return {
        symbol: node?.meta?.symbol ?? symbol,
        name: node?.meta?.shortName ?? node?.meta?.longName ?? symbol,
        points,
    };
};

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const range = parseRange(searchParams.get("range"));
    const symbols = parseSymbols(searchParams.get("symbols"));
    const cacheKey = `${range}:${symbols.join(",")}`;
    const cachedPayload = getCachedPayload(cacheKey);
    if (cachedPayload) {
        return NextResponse.json(cachedPayload);
    }

    const settled = await Promise.allSettled(symbols.map((symbol) => fetchSeries(symbol, range)));
    const series = settled
        .map((result) => (result.status === "fulfilled" ? result.value : null))
        .filter((item): item is PerformanceSeries => Boolean(item));

    const payload: PerformanceResponse = {
        updatedAt: new Date().toISOString(),
        range,
        source: "yahoo",
        series,
    };

    setCachedPayload(cacheKey, payload);
    return NextResponse.json(payload);
}
