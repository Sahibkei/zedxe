import type { MarketauxResponse } from "@/types/marketaux";

const MARKET_AUX_BASE_URL = "https://api.marketaux.com/v1/news/all";
const DEFAULT_LIMIT = 10;

const buildPublishedAfterIso = (): string => {
    const millisAgo = 1 * 24 * 60 * 60 * 1000;
    return new Date(Date.now() - millisAgo).toISOString();
};

export const fetchNews = async (page: number): Promise<MarketauxResponse> => {
    const apiToken = process.env.MARKETAUX_API_TOKEN;

    if (!apiToken) {
        console.error("[MarketAux] Missing MARKETAUX_API_TOKEN");
        throw new Error("MARKETAUX_API_TOKEN is not configured.");
    }

    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;

    const params = new URLSearchParams({
        api_token: apiToken,
        countries: "us",
        language: "en",
        filter_entities: "true",
        must_have_entities: "false",
        limit: DEFAULT_LIMIT.toString(),
        page: safePage.toString(),
        published_after: buildPublishedAfterIso(),
    });

    const url = `${MARKET_AUX_BASE_URL}?${params.toString()}`;

    let response: Response;

    try {
        response = await fetch(url, {
            next: { revalidate: 60 },
        });
    } catch (error) {
        console.error("[MarketAux] Network error while fetching news", { url, error });
        throw new Error("Network error while contacting MarketAux");
    }

    if (!response.ok) {
        const bodyText = await response.text();
        console.error("[MarketAux] HTTP error", {
            url,
            status: response.status,
            statusText: response.statusText,
            body: bodyText,
        });

        try {
            const errJson = JSON.parse(bodyText);
            if (errJson?.error || errJson?.message) {
                throw new Error(`MarketAux error: ${errJson.error || errJson.message}`);
            }
        } catch {
            // ignore parse errors
        }

        throw new Error(`MarketAux request failed with status ${response.status}`);
    }

    const json = await response.json();

    if (
        !json ||
        typeof json !== "object" ||
        !Array.isArray(json.data) ||
        !json.meta ||
        typeof json.meta.found !== "number" ||
        typeof json.meta.returned !== "number" ||
        typeof json.meta.limit !== "number" ||
        typeof json.meta.page !== "number"
    ) {
        console.error("[MarketAux] Unexpected response shape", { url, json });
        throw new Error("Unexpected MarketAux response shape");
    }

    return json as MarketauxResponse;
};

export const RESULTS_CAP = 5;
