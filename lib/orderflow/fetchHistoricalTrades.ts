import { NormalizedTrade } from "@/hooks/useOrderflowStream";

const BINANCE_REST_URL = "https://api.binance.com/api/v3/aggTrades";
const MAX_REQUESTS = 6;
const PAGE_LIMIT = 1000;

const parseAggTrade = (entry: any): NormalizedTrade | null => {
    try {
        const price = Number(entry?.p);
        const quantity = Number(entry?.q);
        const timestamp = Number(entry?.T);
        const isBuyerMaker = Boolean(entry?.m);

        if (!Number.isFinite(price) || !Number.isFinite(quantity) || !Number.isFinite(timestamp)) {
            return null;
        }

        return {
            timestamp,
            price,
            quantity,
            side: isBuyerMaker ? "sell" : "buy",
        };
    } catch (error) {
        console.error("[fetchHistoricalTrades] Failed to parse aggTrade", error);
        return null;
    }
};

export const fetchHistoricalTrades = async (
    symbol: string,
    windowSeconds: number,
): Promise<NormalizedTrade[]> => {
    const startTime = Date.now() - windowSeconds * 1000;
    const upperSymbol = symbol.toUpperCase();

    let trades: NormalizedTrade[] = [];
    let nextStartTime = startTime;

    for (let attempt = 0; attempt < MAX_REQUESTS; attempt += 1) {
        const url = new URL(BINANCE_REST_URL);
        url.searchParams.set("symbol", upperSymbol);
        url.searchParams.set("startTime", `${nextStartTime}`);
        url.searchParams.set("limit", `${PAGE_LIMIT}`);

        let response: Response;
        try {
            response = await fetch(url.toString());
        } catch (error) {
            console.error("[fetchHistoricalTrades] Network error", error);
            break;
        }

        if (!response.ok) {
            console.error("[fetchHistoricalTrades] HTTP error", response.status, response.statusText);
            break;
        }

        const payload = await response.json();
        if (!Array.isArray(payload) || payload.length === 0) {
            break;
        }

        const parsed = payload
            .map((entry) => parseAggTrade(entry))
            .filter((trade): trade is NormalizedTrade => Boolean(trade));

        trades = trades.concat(parsed);

        const lastTimestamp = payload[payload.length - 1]?.T as number | undefined;
        if (!lastTimestamp || payload.length < PAGE_LIMIT) {
            break;
        }

        const nextCandidate = lastTimestamp + 1;
        if (nextCandidate <= nextStartTime) {
            break;
        }
        nextStartTime = nextCandidate;
    }

    const filtered = trades.filter((trade) => trade.timestamp >= startTime);
    return filtered.sort((a, b) => a.timestamp - b.timestamp);
};
