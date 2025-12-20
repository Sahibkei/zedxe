import { NextResponse } from "next/server";

const CACHE_TTL_MS = 15000;
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

const fetchFinnhubQuote = async (symbol: string, apiKey: string): Promise<Quote> => {
    const response = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`
    );

    if (!response.ok) {
        throw new Error(`Finnhub error: ${response.status}`);
    }

    const data = (await response.json()) as { c: number; d: number; dp: number };

    return {
        symbol,
        price: data.c ?? 0,
        change: data.d ?? 0,
        changePercent: data.dp ?? 0,
    };
};

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get("symbols");
    const symbols = symbolsParam
        ? symbolsParam.split(",").map((symbol) => symbol.trim().toUpperCase()).filter(Boolean)
        : [...DEFAULT_SYMBOLS];

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
        const quotes = await Promise.all(symbols.map((symbol) => fetchFinnhubQuote(symbol, apiKey)));
        const payload: QuoteResponse = {
            updatedAt: new Date().toISOString(),
            source: "finnhub",
            quotes,
        };
        cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
        return NextResponse.json(payload);
    } catch (error) {
        console.error("Quote fetch failed", error);
        const payload = buildMockResponse(symbols);
        cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
        return NextResponse.json(payload);
    }
}
