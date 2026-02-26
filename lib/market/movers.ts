export type MarketMover = {
    symbol: string;
    name: string;
    price: number | null;
    change: number | null;
    changePercent: number | null;
    volume: number | null;
    avgVolume3m: number | null;
    marketCap: number | null;
    peRatio: number | null;
};

export type MarketMoversPayload = {
    updatedAt: string;
    source: "yahoo";
    gainers: MarketMover[];
    losers: MarketMover[];
};

type YahooScreenerId = "day_gainers" | "day_losers";

type YahooScreenerQuote = {
    symbol?: string;
    shortName?: string;
    longName?: string;
    regularMarketPrice?: unknown;
    regularMarketChange?: unknown;
    regularMarketChangePercent?: unknown;
    regularMarketVolume?: unknown;
    averageDailyVolume3Month?: unknown;
    marketCap?: unknown;
    trailingPE?: unknown;
    quoteType?: unknown;
    region?: unknown;
    market?: unknown;
};

type YahooScreenerResponse = {
    finance?: {
        result?: Array<{
            quotes?: YahooScreenerQuote[];
        }>;
    };
};

const YAHOO_SCREENER_URL = "https://query2.finance.yahoo.com/v1/finance/screener/predefined/saved";

const toNumber = (value: unknown): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
        const parsed = Number(value.replaceAll(",", ""));
        return Number.isFinite(parsed) ? parsed : null;
    }

    if (value && typeof value === "object" && "raw" in value) {
        const raw = (value as { raw?: unknown }).raw;
        return toNumber(raw);
    }

    return null;
};

const normalizeQuote = (quote: YahooScreenerQuote): MarketMover | null => {
    const symbol = quote.symbol?.trim().toUpperCase();
    if (!symbol) return null;

    const quoteType = typeof quote.quoteType === "string" ? quote.quoteType.toUpperCase() : "";
    const region = typeof quote.region === "string" ? quote.region.toUpperCase() : "";
    const market = typeof quote.market === "string" ? quote.market.toLowerCase() : "";

    if (quoteType !== "EQUITY") return null;
    if (region && region !== "US") return null;
    if (market && !market.includes("us")) return null;

    const name = quote.longName?.trim() || quote.shortName?.trim() || symbol;

    return {
        symbol,
        name,
        price: toNumber(quote.regularMarketPrice),
        change: toNumber(quote.regularMarketChange),
        changePercent: toNumber(quote.regularMarketChangePercent),
        volume: toNumber(quote.regularMarketVolume),
        avgVolume3m: toNumber(quote.averageDailyVolume3Month),
        marketCap: toNumber(quote.marketCap),
        peRatio: toNumber(quote.trailingPE),
    };
};

const byChangePercent = (a: MarketMover, b: MarketMover, direction: "asc" | "desc") => {
    const aValue = typeof a.changePercent === "number" ? a.changePercent : direction === "desc" ? -Infinity : Infinity;
    const bValue = typeof b.changePercent === "number" ? b.changePercent : direction === "desc" ? -Infinity : Infinity;
    return direction === "desc" ? bValue - aValue : aValue - bValue;
};

const dedupeBySymbol = (rows: MarketMover[]): MarketMover[] => {
    const seen = new Set<string>();
    return rows.filter((row) => {
        if (seen.has(row.symbol)) return false;
        seen.add(row.symbol);
        return true;
    });
};

const fetchYahooScreener = async (screenId: YahooScreenerId, count: number): Promise<MarketMover[]> => {
    const url = new URL(YAHOO_SCREENER_URL);
    url.searchParams.set("formatted", "true");
    url.searchParams.set("scrIds", screenId);
    url.searchParams.set("count", String(count));
    url.searchParams.set("start", "0");
    url.searchParams.set("lang", "en-US");
    url.searchParams.set("region", "US");

    const response = await fetch(url.toString(), {
        cache: "no-store",
        headers: {
            Accept: "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; ZedXe/1.0)",
        },
    });

    if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`Yahoo screener ${screenId} failed (${response.status}): ${body.slice(0, 160)}`);
    }

    const payload = (await response.json()) as YahooScreenerResponse;
    const quotes = payload.finance?.result?.[0]?.quotes ?? [];
    const normalized = dedupeBySymbol(quotes.map(normalizeQuote).filter((row): row is MarketMover => Boolean(row)));

    normalized.sort((a, b) => byChangePercent(a, b, screenId === "day_gainers" ? "desc" : "asc"));
    return normalized.slice(0, count);
};

export const getUsTopMovers = async (params?: { count?: number }): Promise<MarketMoversPayload> => {
    const requestedCount = params?.count ?? 100;
    const count = Math.max(10, Math.min(250, Math.floor(requestedCount)));

    const [gainers, losers] = await Promise.all([
        fetchYahooScreener("day_gainers", count),
        fetchYahooScreener("day_losers", count),
    ]);

    return {
        updatedAt: new Date().toISOString(),
        source: "yahoo",
        gainers,
        losers,
    };
};
