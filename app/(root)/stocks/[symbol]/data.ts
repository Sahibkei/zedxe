import { cache } from "react";

import { canonicalizeSymbol } from "@/src/lib/symbol";
import { finnhubProvider } from "@/src/server/market-data/finnhub-provider";
import type { QuoteData, StockProfileData } from "@/src/server/market-data/provider";

export const getCanonicalSymbol = (rawSymbol: string | undefined) => canonicalizeSymbol(rawSymbol ?? "");

type StockProfileViewData = {
    symbol: string;
    profile: StockProfileData;
    quote: QuoteData | null;
    error?: string;
};

export const getStockProfileData = cache(async (rawSymbol: string | undefined): Promise<StockProfileViewData> => {
    let symbol = "UNKNOWN";
    try {
        symbol = canonicalizeSymbol(rawSymbol ?? "");
    } catch {
        return {
            symbol,
            profile: { symbol, name: "Data unavailable" },
            quote: null,
            error: "Invalid symbol",
        };
    }

    try {
        const [profile, quote] = await Promise.all([
            finnhubProvider.getProfile(symbol),
            finnhubProvider.getQuote(symbol).catch(() => null),
        ]);
        return { symbol, profile, quote };
    } catch (error) {
        return {
            symbol,
            profile: { symbol, name: "Data unavailable" },
            quote: null,
            error: error instanceof Error ? error.message : "Data unavailable",
        };
    }
});
