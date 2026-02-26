import { NextResponse } from "next/server";
import { fetchJsonWithTimeout } from "@/lib/http/fetchWithTimeout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CACHE_TTL_MS = 20_000;
const MAX_SYMBOLS = 20;
const DEFAULT_SYMBOLS = [
    "^GSPC",
    "^NDX",
    "^DJI",
    "^RUT",
    "^STOXX50E",
    "^FTSE",
    "^GDAXI",
    "^N225",
    "^HSI",
    "^NSEI",
    "^BVSP",
] as const;

type IndexQuote = {
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    exchange: string | null;
    currency: string | null;
};

type IndicesResponse = {
    updatedAt: string;
    source: "yahoo";
    quotes: IndexQuote[];
};

type YahooChartResponse = {
    chart?: {
        result?: Array<{
            meta?: {
                symbol?: string;
                shortName?: string;
                longName?: string;
                regularMarketPrice?: number;
                chartPreviousClose?: number;
                previousClose?: number;
                fullExchangeName?: string;
                exchangeName?: string;
                currency?: string;
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

const cache = new Map<string, { expiresAt: number; payload: IndicesResponse }>();

const parseSymbols = (symbolsParam: string | null) => {
    const symbols = symbolsParam
        ? symbolsParam
              .split(",")
              .map((value) => value.trim().toUpperCase())
              .filter(Boolean)
        : [...DEFAULT_SYMBOLS];

    return Array.from(new Set(symbols)).slice(0, MAX_SYMBOLS);
};

const toFinite = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

const getLastFinite = (values: Array<number | null> | undefined) => {
    if (!Array.isArray(values)) return null;
    for (let index = values.length - 1; index >= 0; index -= 1) {
        const value = values[index];
        if (typeof value === "number" && Number.isFinite(value)) return value;
    }
    return null;
};

const fetchIndexQuote = async (symbol: string): Promise<IndexQuote> => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=5d&interval=1d`;
    const result = await fetchJsonWithTimeout<YahooChartResponse>(
        url,
        {
            cache: "no-store",
            headers: {
                Accept: "application/json",
                "User-Agent": "Mozilla/5.0",
            },
        },
        { timeoutMs: 8000, retries: 1, backoffBaseMs: 250 }
    );

    if (!result.ok) {
        throw new Error(`Yahoo chart request failed for ${symbol}: ${result.status ?? result.error}`);
    }

    const payload = result.data;
    const chartError = payload.chart?.error;
    if (chartError) {
        throw new Error(`Yahoo chart error for ${symbol}: ${chartError.description ?? chartError.code ?? "unknown"}`);
    }

    const node = payload.chart?.result?.[0];
    const meta = node?.meta;
    const lastClose = getLastFinite(node?.indicators?.quote?.[0]?.close);
    const marketPrice = toFinite(meta?.regularMarketPrice);
    const price = lastClose ?? marketPrice;
    const previousClose = toFinite(meta?.chartPreviousClose) ?? toFinite(meta?.previousClose);

    if (price === null || previousClose === null || previousClose === 0) {
        throw new Error(`Missing price data for ${symbol}`);
    }

    const change = price - previousClose;
    const changePercent = (change / previousClose) * 100;

    return {
        symbol: meta?.symbol ?? symbol,
        name: meta?.shortName ?? meta?.longName ?? symbol,
        price,
        change,
        changePercent,
        exchange: meta?.fullExchangeName ?? meta?.exchangeName ?? null,
        currency: meta?.currency ?? null,
    };
};

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbols = parseSymbols(searchParams.get("symbols"));
    const cacheKey = symbols.join(",");
    const cached = cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
        return NextResponse.json(cached.payload);
    }

    const settled = await Promise.allSettled(symbols.map((symbol) => fetchIndexQuote(symbol)));
    const quotes = settled
        .map((result) => (result.status === "fulfilled" ? result.value : null))
        .filter((quote): quote is IndexQuote => Boolean(quote));

    if (!quotes.length) {
        if (cached?.payload) {
            return NextResponse.json(cached.payload);
        }
        return NextResponse.json(
            {
                updatedAt: new Date().toISOString(),
                source: "yahoo",
                quotes: [],
            } satisfies IndicesResponse
        );
    }

    const payload: IndicesResponse = {
        updatedAt: new Date().toISOString(),
        source: "yahoo",
        quotes,
    };

    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
    return NextResponse.json(payload);
}

