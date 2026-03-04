import { NextResponse } from "next/server";
import { fetchJsonWithTimeout } from "@/lib/http/fetchWithTimeout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CACHE_TTL_MS = 30_000;
const MAX_CACHE_ENTRIES = 300;
const DEFAULT_SYMBOL = "^GSPC";

const RANGE_CONFIG: Record<
    string,
    {
        yahooRange: string;
        yahooInterval: string;
    }
> = {
    "1D": { yahooRange: "1d", yahooInterval: "5m" },
    "1M": { yahooRange: "1mo", yahooInterval: "60m" },
    "3M": { yahooRange: "3mo", yahooInterval: "1d" },
    "YTD": { yahooRange: "ytd", yahooInterval: "1d" },
    "1Y": { yahooRange: "1y", yahooInterval: "1d" },
    "5Y": { yahooRange: "5y", yahooInterval: "1wk" },
};

type YahooChartResponse = {
    chart?: {
        result?: Array<{
            meta?: {
                symbol?: string;
                shortName?: string;
                longName?: string;
                currency?: string;
            };
            timestamp?: number[];
            indicators?: {
                quote?: Array<{
                    open?: Array<number | null>;
                    high?: Array<number | null>;
                    low?: Array<number | null>;
                    close?: Array<number | null>;
                    volume?: Array<number | null>;
                }>;
            };
        }>;
        error?: {
            code?: string;
            description?: string;
        };
    };
};

type HistoryPoint = {
    t: number;
    o: number;
    h: number;
    l: number;
    c: number;
    v: number | null;
};

type HistoryResponse = {
    updatedAt: string;
    source: "yahoo";
    symbol: string;
    name: string;
    currency: string | null;
    range: string;
    points: HistoryPoint[];
};

const cache = new Map<string, { expiresAt: number; payload: HistoryResponse }>();

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const parseRange = (raw: string | null) => {
    const normalized = (raw ?? "1Y").toUpperCase();
    return RANGE_CONFIG[normalized] ? normalized : "1Y";
};

const pruneExpiredCacheEntries = (now: number) => {
    for (const [key, entry] of cache) {
        if (entry.expiresAt <= now) {
            cache.delete(key);
        }
    }
};

const getCachedPayload = (cacheKey: string): HistoryResponse | null => {
    const now = Date.now();
    const cached = cache.get(cacheKey);
    if (!cached) return null;
    if (cached.expiresAt <= now) {
        cache.delete(cacheKey);
        return null;
    }

    // Refresh insertion order so oldest entries are evicted first.
    cache.delete(cacheKey);
    cache.set(cacheKey, cached);
    return cached.payload;
};

const setCachedPayload = (cacheKey: string, payload: HistoryResponse) => {
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

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = (searchParams.get("symbol") ?? DEFAULT_SYMBOL).trim().toUpperCase();
    const range = parseRange(searchParams.get("range"));
    const cacheKey = `${symbol}:${range}`;
    const cachedPayload = getCachedPayload(cacheKey);
    if (cachedPayload) {
        return NextResponse.json(cachedPayload);
    }

    const config = RANGE_CONFIG[range];
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
        return NextResponse.json(
            {
                updatedAt: new Date().toISOString(),
                source: "yahoo",
                symbol,
                name: symbol,
                currency: null,
                range,
                points: [],
            } satisfies HistoryResponse
        );
    }

    const payload = result.data;
    if (payload.chart?.error) {
        return NextResponse.json(
            {
                updatedAt: new Date().toISOString(),
                source: "yahoo",
                symbol,
                name: symbol,
                currency: null,
                range,
                points: [],
            } satisfies HistoryResponse
        );
    }

    const node = payload.chart?.result?.[0];
    const meta = node?.meta;
    const timestamps = node?.timestamp ?? [];
    const quote = node?.indicators?.quote?.[0];
    const opens = quote?.open ?? [];
    const highs = quote?.high ?? [];
    const lows = quote?.low ?? [];
    const closes = quote?.close ?? [];
    const volumes = quote?.volume ?? [];

    const pointsCount = Math.min(timestamps.length, opens.length, highs.length, lows.length, closes.length);
    const points: HistoryPoint[] = [];

    for (let index = 0; index < pointsCount; index += 1) {
        const t = timestamps[index];
        const o = opens[index];
        const h = highs[index];
        const l = lows[index];
        const c = closes[index];
        const v = volumes[index];

        if (!isFiniteNumber(t) || !isFiniteNumber(o) || !isFiniteNumber(h) || !isFiniteNumber(l) || !isFiniteNumber(c)) continue;

        points.push({
            t,
            o,
            h,
            l,
            c,
            v: isFiniteNumber(v) ? v : null,
        });
    }

    const response: HistoryResponse = {
        updatedAt: new Date().toISOString(),
        source: "yahoo",
        symbol: meta?.symbol ?? symbol,
        name: meta?.shortName ?? meta?.longName ?? symbol,
        currency: meta?.currency ?? null,
        range,
        points,
    };

    setCachedPayload(cacheKey, response);
    return NextResponse.json(response);
}
