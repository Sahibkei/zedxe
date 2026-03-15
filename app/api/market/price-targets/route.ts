import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_SYMBOL = "AAPL";
const STOCK_ANALYSIS_BASE_URL = "https://stockanalysis.com/stocks";
const CACHE_TTL_MS = 15 * 60_000;
const MAX_CACHE_ENTRIES = 180;
const RESPONSE_CACHE_CONTROL = "public, s-maxage=900, stale-while-revalidate=3600";

type TargetSummary = {
    low: number;
    average: number;
    median: number;
    high: number;
    count: number;
    updated: string | null;
    currentPrice: number | null;
    upsidePct: number | null;
};

type ChartPoint = {
    t: number;
    close: number | null;
};

type RatingPoint = {
    t: number;
    date: string;
    firm: string;
    analyst: string;
    action: string;
    rating: string;
    priceTarget: number;
    previousTarget: number | null;
};

type PriceTargetsResponse = {
    updatedAt: string;
    symbol: string;
    status: "ok" | "no_data";
    sources: Array<{
        name: string;
        url: string;
        public: true;
    }>;
    summary: TargetSummary | null;
    chart: ChartPoint[];
    ratings: RatingPoint[];
};

type StockAnalysisTargets = {
    low?: number;
    average?: number;
    median?: number;
    high?: number;
    count?: number;
    updated?: string;
    chart?: Array<{
        c?: number | null;
        t?: string;
    }>;
};

const cache = new Map<string, { expiresAt: number; payload: PriceTargetsResponse }>();

const parseSymbol = (raw: string | null) => (raw ?? DEFAULT_SYMBOL).trim().toUpperCase() || DEFAULT_SYMBOL;

const buildSourceUrl = (symbol: string) => `${STOCK_ANALYSIS_BASE_URL}/${encodeURIComponent(symbol.toLowerCase())}/forecast/`;
const buildRatingsUrl = (symbol: string) => `${STOCK_ANALYSIS_BASE_URL}/${encodeURIComponent(symbol.toLowerCase())}/ratings/`;

const parseIsoDate = (value?: string | null) => {
    if (!value) return null;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const extractBalancedLiteral = (source: string, token: string, openChar: "{" | "[", closeChar: "}" | "]") => {
    const tokenIndex = source.indexOf(token);
    if (tokenIndex < 0) return null;

    const startIndex = source.indexOf(openChar, tokenIndex + token.length);
    if (startIndex < 0) return null;

    let depth = 0;
    let inString = false;
    let isEscaped = false;

    for (let index = startIndex; index < source.length; index += 1) {
        const char = source[index];

        if (inString) {
            if (isEscaped) {
                isEscaped = false;
                continue;
            }
            if (char === "\\") {
                isEscaped = true;
                continue;
            }
            if (char === "\"") inString = false;
            continue;
        }

        if (char === "\"") {
            inString = true;
            continue;
        }

        if (char === openChar) {
            depth += 1;
            continue;
        }

        if (char === closeChar) {
            depth -= 1;
            if (depth === 0) return source.slice(startIndex, index + 1);
        }
    }

    return null;
};

const parseJsLiteral = <T>(literal: string | null): T | null => {
    if (!literal) return null;

    try {
        const normalized = literal
            .replace(/\bvoid 0\b/g, "null")
            .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, '$1"$2"$3');
        return JSON.parse(normalized) as T;
    } catch {
        return null;
    }
};

const decodeHtml = (value: string) =>
    value
        .replace(/&#8594;/g, "->")
        .replace(/&amp;/g, "&")
        .replace(/&nbsp;/g, " ")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, "\"")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

const parsePriceTargetCell = (value: string) => {
    const matches = [...value.matchAll(/\$([\d,.]+)/g)].map((match) => Number(match[1].replace(/,/g, ""))).filter(Number.isFinite);
    if (!matches.length) return { priceTarget: null, previousTarget: null };
    return {
        priceTarget: matches[matches.length - 1] ?? null,
        previousTarget: matches.length > 1 ? matches[0] ?? null : null,
    };
};

const parseRatingsTable = (html: string): RatingPoint[] => {
    const bodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
    if (!bodyMatch) return [];

    return [...bodyMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
        .map((rowMatch) => {
            const row = rowMatch[1];
            const analystMatch = row.match(/analyst-name[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
            const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => decodeHtml(cell[1]));
            if (!analystMatch || cells.length < 6) return null;

            const analyst = decodeHtml(analystMatch[1]);
            const firm = cells[1] ?? "Unknown firm";
            const rating = cells[cells.length - 5] ?? "--";
            const action = cells[cells.length - 4] ?? "Update";
            const date = cells[cells.length - 1] ?? "";
            const timestamp = parseIsoDate(date);
            const priceCell = cells[cells.length - 3] ?? "";
            const { priceTarget, previousTarget } = parsePriceTargetCell(priceCell);

            if (timestamp == null || priceTarget == null) return null;

            return {
                t: timestamp,
                date: new Date(timestamp).toISOString(),
                firm,
                analyst,
                action,
                rating,
                priceTarget,
                previousTarget,
            } satisfies RatingPoint;
        })
        .filter((rating): rating is RatingPoint => Boolean(rating));
};

const buildEmptyPayload = (symbol: string): PriceTargetsResponse => ({
    updatedAt: new Date().toISOString(),
    symbol,
    status: "no_data",
    sources: [
        {
            name: "StockAnalysis Forecast",
            url: buildSourceUrl(symbol),
            public: true,
        },
        {
            name: "StockAnalysis Ratings History",
            url: buildRatingsUrl(symbol),
            public: true,
        },
    ],
    summary: null,
    chart: [],
    ratings: [],
});

const pruneExpiredCacheEntries = (now: number) => {
    for (const [key, entry] of cache) {
        if (entry.expiresAt <= now) cache.delete(key);
    }
};

const getCachedPayload = (cacheKey: string) => {
    const now = Date.now();
    const cached = cache.get(cacheKey);
    if (!cached) return null;
    if (cached.expiresAt <= now) {
        cache.delete(cacheKey);
        return null;
    }

    cache.delete(cacheKey);
    cache.set(cacheKey, cached);
    return cached.payload;
};

const setCachedPayload = (cacheKey: string, payload: PriceTargetsResponse) => {
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

const jsonResponse = (payload: PriceTargetsResponse) =>
    NextResponse.json(payload, {
        headers: {
            "Cache-Control": RESPONSE_CACHE_CONTROL,
        },
    });

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = parseSymbol(searchParams.get("symbol"));
    const cachedPayload = getCachedPayload(symbol);
    if (cachedPayload) {
        return jsonResponse(cachedPayload);
    }
    const sourceUrl = buildSourceUrl(symbol);
    const ratingsUrl = buildRatingsUrl(symbol);

    try {
        const headers = {
            Accept: "text/html,application/xhtml+xml",
            "User-Agent": "Mozilla/5.0",
        };
        const [forecastResponse, ratingsResponse] = await Promise.all([
            fetch(sourceUrl, {
                cache: "force-cache",
                next: { revalidate: 900 },
                headers,
                signal: AbortSignal.timeout(10_000),
            }),
            fetch(ratingsUrl, {
                cache: "force-cache",
                next: { revalidate: 900 },
                headers,
                signal: AbortSignal.timeout(10_000),
            }),
        ]);

        if (!forecastResponse.ok) {
            const emptyPayload = buildEmptyPayload(symbol);
            setCachedPayload(symbol, emptyPayload);
            return jsonResponse(emptyPayload);
        }

        const forecastHtml = await forecastResponse.text();
        const ratingsHtml = ratingsResponse.ok ? await ratingsResponse.text() : "";
        const targets = parseJsLiteral<StockAnalysisTargets>(extractBalancedLiteral(forecastHtml, "targets:", "{", "}"));

        if (!targets?.count || !Array.isArray(targets.chart) || !targets.chart.length) {
            const emptyPayload = buildEmptyPayload(symbol);
            setCachedPayload(symbol, emptyPayload);
            return jsonResponse(emptyPayload);
        }

        const chart = targets.chart
            .map((point) => {
                const timestamp = parseIsoDate(point.t);
                return timestamp == null
                    ? null
                    : {
                          t: timestamp,
                          close: typeof point.c === "number" && Number.isFinite(point.c) ? point.c : null,
                      };
            })
            .filter((point): point is ChartPoint => Boolean(point));

        const latestClose = [...chart].reverse().find((point) => typeof point.close === "number")?.close ?? null;

        const normalizedRatings = parseRatingsTable(ratingsHtml).sort((left, right) => right.t - left.t);

        const summary =
            typeof targets.low === "number" &&
            typeof targets.average === "number" &&
            typeof targets.median === "number" &&
            typeof targets.high === "number" &&
            typeof targets.count === "number"
                ? {
                      low: targets.low,
                      average: targets.average,
                      median: targets.median,
                      high: targets.high,
                      count: targets.count,
                      updated: targets.updated ?? null,
                      currentPrice: latestClose,
                      upsidePct:
                          latestClose != null && latestClose > 0
                              ? ((targets.average / latestClose) - 1) * 100
                              : null,
                  }
                : null;

        if (!summary) {
            const emptyPayload = buildEmptyPayload(symbol);
            setCachedPayload(symbol, emptyPayload);
            return jsonResponse(emptyPayload);
        }

        const payload = {
            updatedAt: new Date().toISOString(),
            symbol,
            status: "ok",
            sources: [
                {
                    name: "StockAnalysis Forecast",
                    url: sourceUrl,
                    public: true,
                },
                {
                    name: "StockAnalysis Ratings History",
                    url: ratingsUrl,
                    public: true,
                },
            ],
            summary,
            chart,
            ratings: normalizedRatings,
        } satisfies PriceTargetsResponse;

        setCachedPayload(symbol, payload);
        return jsonResponse(payload);
    } catch {
        const emptyPayload = buildEmptyPayload(symbol);
        setCachedPayload(symbol, emptyPayload);
        return jsonResponse(emptyPayload);
    }
}
