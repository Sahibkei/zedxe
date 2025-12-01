import type { MarketauxArticle, MarketauxMeta, MarketauxResponse } from "@/types/marketaux";

const MARKET_AUX_BASE_URL = "https://api.marketaux.com/v1/news/all";
export const DEFAULT_LIMIT = 10;
const PUBLISHED_AFTER_DAYS = 14;

const buildPublishedAfterIso = (): string => {
    const millisAgo = PUBLISHED_AFTER_DAYS * 24 * 60 * 60 * 1000;
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
        countries: "us",
        language: "en",
        filter_entities: "true",
        limit: DEFAULT_LIMIT.toString(),
        page: safePage.toString(),
        published_after: buildPublishedAfterIso(),
        api_token: apiToken,
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
        const bodyText = await response.text().catch(() => "");

        let parsedError: unknown;
        try {
            parsedError = bodyText ? JSON.parse(bodyText) : null;
        } catch {
            parsedError = null;
        }

        const errorMessage =
            (parsedError && typeof parsedError === "object" && "error" in parsedError
                ? typeof (parsedError as { error?: unknown }).error === "string"
                    ? (parsedError as { error?: string }).error
                    : typeof (parsedError as { error?: { message?: unknown } }).error?.message === "string"
                    ? (parsedError as { error?: { message?: string } }).error?.message
                    : undefined
                : undefined) ||
            (parsedError && typeof parsedError === "object" && "message" in parsedError
                ? typeof (parsedError as { message?: unknown }).message === "string"
                    ? (parsedError as { message?: string }).message
                    : undefined
                : undefined);

        console.error("[MarketAux] HTTP error", {
            url,
            status: response.status,
            statusText: response.statusText,
            body: bodyText,
            error: errorMessage,
        });

        const detailedMessage = errorMessage
            ? `MarketAux request failed with status ${response.status}: ${errorMessage}`
            : `MarketAux request failed with status ${response.status}`;

        throw new Error(detailedMessage);
    }

    let json: unknown;

    try {
        json = await response.json();
    } catch (error) {
        console.error("[MarketAux] Failed to parse JSON", { url, error });
        throw new Error("Unable to parse MarketAux response JSON.");
    }

    const parsed = json as {
        data?: unknown;
        results?: unknown;
        meta?: MarketauxMeta;
    };

    const rawData = Array.isArray(parsed?.data)
        ? (parsed.data as MarketauxArticle[])
        : Array.isArray(parsed?.results)
        ? (parsed.results as MarketauxArticle[])
        : null;

    if (!rawData) {
        console.warn("[MarketAux] Response missing data array", { url, json });
    }

    const data = Array.isArray(rawData) ? rawData : [];

    const meta: MarketauxMeta = {
        found: parsed?.meta?.found ?? data.length,
        returned: parsed?.meta?.returned ?? data.length,
        limit: parsed?.meta?.limit ?? DEFAULT_LIMIT,
        page: parsed?.meta?.page ?? safePage,
    };

    return { data, meta } as MarketauxResponse;
};

export const RESULTS_CAP = 5;
