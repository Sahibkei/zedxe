import { cache } from "react";

import { getQuote } from "@/lib/market/providers";
import { getMockStockProfile } from "@/src/features/stock-profile-v2/contract/mock";

const resolveSymbol = (rawSymbol: string | undefined) => {
    const cleaned = (rawSymbol ?? "").trim();
    return cleaned ? cleaned.toUpperCase() : "UNKNOWN";
};

export const getCanonicalSymbol = (rawSymbol: string | undefined) => resolveSymbol(rawSymbol);

export const getStockProfileData = cache(async (rawSymbol: string | undefined) => {
    const symbol = resolveSymbol(rawSymbol);
    let profile = getMockStockProfile(symbol);
    let hasLiveQuote = false;

    try {
        const quote = await getQuote(symbol);
        if (quote && typeof quote.c === "number") {
            profile = {
                ...profile,
                header: {
                    ...profile.header,
                    price: quote.c,
                    change: typeof quote.d === "number" ? quote.d : profile.header.change,
                    changePct: typeof quote.dp === "number" ? quote.dp : profile.header.changePct,
                    status: "Live",
                },
            };
            hasLiveQuote = true;
        }
    } catch {
        // Fall back to mock pricing silently
    }

    if (!hasLiveQuote) {
        profile = {
            ...profile,
            header: {
                ...profile.header,
                price: null,
                change: null,
                changePct: null,
                status: "Unavailable",
            },
        };
    }

    return { symbol, profile, hasLiveQuote };
});
