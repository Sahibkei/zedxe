import { NextResponse } from "next/server";
import { fetchJsonWithTimeout } from "@/lib/http/fetchWithTimeout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CACHE_TTL_MS = 15000;
const MAX_SYMBOLS = 60;
const cache = new Map<string, { expiresAt: number; payload: QuoteResponse }>();

const DEFAULT_SYMBOLS = ["NVDA", "AAPL", "AMZN", "PLTR", "GOOGL", "META"] as const;

type Quote = {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
};

type QuoteResponse = {
    updatedAt: string;
    source: "finnhub" | "mock";
    quotes: Quote[];
};

const MOCK_QUOTES: Record<string, { price: number; change: number; changePercent: number }> = {
    NVDA: { price: 121.48, change: 1.42, changePercent: 1.18 },
    AAPL: { price: 228.73, change: -0.91, changePercent: -0.4 },
    AMZN: { price: 188.42, change: 2.07, changePercent: 1.11 },
    PLTR: { price: 26.58, change: -0.18, changePercent: -0.67 },
    GOOGL: { price: 176.32, change: 0.83, changePercent: 0.47 },
    META: { price: 498.15, change: 3.12, changePercent: 0.63 },
};

const buildMockResponse = (symbols: string[]): QuoteResponse => {
    const quotes = symbols.map((symbol, index) => {
        const base = MOCK_QUOTES[symbol] ?? {
            price: 100 + index * 10,
            change: 0.5 + index * 0.12,
            changePercent: 0.5 + index * 0.08,
        };
        return {
            symbol,
            price: base.price,
            change: base.change,
            changePercent: base.changePercent,
        };
    });

    return {
        updatedAt: new Date().toISOString(),
        source: "mock",
        quotes,
    };
};

const toFiniteNumber = (value: unknown, fallback = 0) => {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
};

const parseSymbols = (symbolsParam: string | null): string[] => {
    const symbols = symbolsParam
        ? symbolsParam
              .split(",")
              .map((symbol) => symbol.trim().toUpperCase())
              .filter(Boolean)
        : [...DEFAULT_SYMBOLS];

    return Array.from(new Set(symbols)).slice(0, MAX_SYMBOLS);
};

const fetchFinnhubQuote = async (symbol: string, apiKey: string): Promise<Quote> => {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
    const result = await fetchJsonWithTimeout<{ c?: number; d?: number; dp?: number }>(
        url,
        { cache: "no-store" },
        { timeoutMs: 8000, retries: 1, backoffBaseMs: 250 }
    );

    if (!result.ok) {
        throw new Error(`Finnhub error for ${symbol}: ${result.status ?? result.error}`);
    }
    const data = result.data;

    return {
        symbol,
        price: toFiniteNumber(data.c),
        change: toFiniteNumber(data.d),
        changePercent: toFiniteNumber(data.dp),
    };
};

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get("symbols");
    const symbols = parseSymbols(symbolsParam);

    const cacheKey = symbols.join(",");
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return NextResponse.json(cached.payload);
    }

    const apiKey = process.env.FINNHUB_API_KEY;

    if (!apiKey) {
        const payload = buildMockResponse(symbols);
        cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
        return NextResponse.json(payload);
    }

    try {
        const staleQuoteMap = new Map<string, Quote>((cached?.payload.quotes ?? []).map((quote) => [quote.symbol, quote]));

        const settled = await Promise.allSettled(symbols.map((symbol) => fetchFinnhubQuote(symbol, apiKey)));
        const quotes: Quote[] = symbols
            .map((symbol, index) => {
                const result = settled[index];
                if (!result) return staleQuoteMap.get(symbol);
                if (result.status === "fulfilled") return result.value;

                console.error("Quote fetch failed for symbol", symbol, result.reason);
                return staleQuoteMap.get(symbol);
            })
            .filter((quote): quote is Quote => Boolean(quote));

        if (!quotes.length && cached?.payload) {
            return NextResponse.json(cached.payload);
        }

        const payload: QuoteResponse = {
            updatedAt: new Date().toISOString(),
            source: "finnhub",
            quotes,
        };
        cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
        return NextResponse.json(payload);
    } catch (error) {
        console.error("Quote fetch failed", error);
        if (cached?.payload) {
            return NextResponse.json(cached.payload);
        }
        return NextResponse.json(
            {
                updatedAt: new Date().toISOString(),
                source: "finnhub",
                quotes: [],
            } satisfies QuoteResponse
        );
    }
}
