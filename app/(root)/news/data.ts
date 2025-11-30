import type { MarketauxResponse } from "@/types/marketaux";

const MARKET_AUX_BASE_URL = "https://api.marketaux.com/v1/news/all";
const DEFAULT_LIMIT = 10;
const FALLBACK_MARKETAUX_API_TOKEN = "7OKwZHYX7nqYTBWgjCzaKyWYC9Fmb1pc9Idyuekk";

const getPublishedAfterIso = (daysAgo: number): string => {
    const millisAgo = daysAgo * 24 * 60 * 60 * 1000;
    return new Date(Date.now() - millisAgo).toISOString();
};

export const fetchNews = async (page: number): Promise<MarketauxResponse> => {
    const apiToken = process.env.MARKETAUX_API_TOKEN || FALLBACK_MARKETAUX_API_TOKEN;

    if (!apiToken) {
        console.error("[MarketAux] Missing MARKETAUX_API_TOKEN and fallback token");
        throw new Error("Missing MarketAux API token");
    }

    const safePage = Number.isFinite(page) && page > 0 ? page : 1;

    const params = new URLSearchParams({
        api_token: apiToken,
        countries: "us",
        language: "en",
        filter_entities: "true",
        must_have_entities: "false",
        limit: DEFAULT_LIMIT.toString(),
        page: safePage.toString(),
        published_after: getPublishedAfterIso(30),
    });

    const url = `${MARKET_AUX_BASE_URL}?${params.toString()}`;

    const response = await fetch(url, {
        next: { revalidate: 60 },
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("[MarketAux] News fetch failed", {
            status: response.status,
            statusText: response.statusText,
            body: errorText,
        });
        throw new Error("Failed to fetch Marketaux news");
    }

    const parsed = (await response.json()) as MarketauxResponse;
    return parsed;
};

export const RESULTS_CAP = 5;
