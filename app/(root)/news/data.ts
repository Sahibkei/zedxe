import type { MarketauxResponse } from "@/types/marketaux";

const MARKET_AUX_BASE_URL = "https://api.marketaux.com/v1/news/all";
const DEFAULT_LIMIT = 10;

const buildPublishedAfterIso = (): string => {
    const millisAgo = 30 * 24 * 60 * 60 * 1000;
    return new Date(Date.now() - millisAgo).toISOString();
};

export const fetchNews = async (page: number): Promise<MarketauxResponse> => {
    const apiToken = process.env.MARKETAUX_API_TOKEN;

    if (!apiToken) {
        console.error("[MarketAux] Missing MARKETAUX_API_TOKEN env variable");
        throw new Error("Missing MarketAux API token. Set MARKETAUX_API_TOKEN in your environment.");
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
        const bodyText = await response.text().catch(() => "<body read error>");
        console.error("[MarketAux] Non-OK HTTP response", {
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
        } catch (parseError) {
            if (parseError instanceof Error) {
                console.error("[MarketAux] Failed to parse error body", { url, parseError });
            }
        }

        throw new Error(`MarketAux request failed with status ${response.status}`);
    }

    const json = await response.json();

    if (!json || !Array.isArray(json.data) || !json.meta) {
        console.error("[MarketAux] Unexpected response shape", { url, json });
        throw new Error("Unexpected MarketAux response shape");
    }

    return json as MarketauxResponse;
};

export const RESULTS_CAP = 5;
