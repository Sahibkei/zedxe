import type { MarketauxResponse } from "@/types/marketaux";

const MARKET_AUX_BASE_URL = "https://api.marketaux.com/v1/news/all";
const DEFAULT_LIMIT = 10;

const getPublishedAfterIso = (daysAgo: number): string => {
    const millisAgo = daysAgo * 24 * 60 * 60 * 1000;
    return new Date(Date.now() - millisAgo).toISOString();
};

export const fetchNews = async (page: number): Promise<MarketauxResponse> => {
    const apiToken = process.env.MARKETAUX_API_TOKEN;

    if (!apiToken) {
        throw new Error("MARKETAUX_API_TOKEN is not configured.");
    }

    const params = new URLSearchParams({
        countries: "us",
        filter_entities: "true",
        limit: DEFAULT_LIMIT.toString(),
        page: page.toString(),
        published_after: getPublishedAfterIso(7),
        api_token: apiToken,
    });

    const response = await fetch(`${MARKET_AUX_BASE_URL}?${params.toString()}`, {
        next: { revalidate: 60 },
    });

    if (!response.ok) {
        throw new Error("Failed to fetch Marketaux news");
    }

    return response.json();
};

export const RESULTS_CAP = 5;
