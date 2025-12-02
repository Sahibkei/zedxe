import type { MarketauxArticle, MarketauxMeta, MarketauxResponse } from "@/types/marketaux";

const MARKET_AUX_BASE_URL = "https://api.marketaux.com/v1/news/all";
const MARKET_AUX_ARTICLE_URL = "https://api.marketaux.com/v1/news/uuid";
export const DEFAULT_LIMIT = 10;
const PUBLISHED_AFTER_DAYS = 14;

const extractErrorMessage = (bodyText: string): string | undefined => {
    const trimmed = bodyText.trim();
    if (!trimmed) return undefined;

    try {
        const parsed = JSON.parse(trimmed) as { error?: unknown; message?: unknown } | null;

        if (parsed && typeof parsed === "object") {
            if (typeof parsed.error === "string") return parsed.error;

            if (
                parsed.error &&
                typeof parsed.error === "object" &&
                typeof (parsed.error as { message?: unknown }).message === "string"
            ) {
                return (parsed.error as { message?: string }).message;
            }

            if (typeof parsed.message === "string") return parsed.message;
        }
    } catch {
        // Ignore JSON parse errors and fall back to raw text.
    }

    return trimmed;
};

const buildPublishedAfterDate = (): string | null => {
    const millisAgo = PUBLISHED_AFTER_DAYS * 24 * 60 * 60 * 1000;
    const computedDate = new Date(Date.now() - millisAgo);

    if (Number.isNaN(computedDate.getTime())) {
        console.warn("[MarketAux] Unable to compute published_after date");
        return null;
    }

    return computedDate.toISOString().slice(0, 10);
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
        api_token: apiToken,
    });

    const publishedAfter = buildPublishedAfterDate();
    if (publishedAfter) {
        params.set("published_after", publishedAfter);
    }

    const url = `${MARKET_AUX_BASE_URL}?${params.toString()}`;
    const redactedUrl = url.replace(apiToken, "[REDACTED]");

    let response: Response;

    try {
        response = await fetch(url, {
            next: { revalidate: 60 },
        });
    } catch (error) {
        console.error("[MarketAux] Network error while fetching news", { url: redactedUrl, error });
        throw new Error("Network error while contacting MarketAux");
    }

    if (!response.ok) {
        const bodyText = await response.text().catch(() => "");

        const errorMessage = extractErrorMessage(bodyText);

        console.error("[MarketAux] HTTP error", {
            url: redactedUrl,
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
        console.error("[MarketAux] Failed to parse JSON", { url: redactedUrl, error });
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
        console.warn("[MarketAux] Response missing data array", { url: redactedUrl, json });
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

export const fetchArticleByUuid = async (uuid: string): Promise<MarketauxArticle | null> => {
    const apiToken = process.env.MARKETAUX_API_TOKEN;

    if (!apiToken) {
        console.error("[MarketAux] Missing MARKETAUX_API_TOKEN");
        throw new Error("MARKETAUX_API_TOKEN is not configured.");
    }

    const trimmedUuid = uuid?.trim();

    if (!trimmedUuid) {
        throw new Error("A valid article UUID is required.");
    }

    const url = `${MARKET_AUX_ARTICLE_URL}/${encodeURIComponent(trimmedUuid)}?api_token=${apiToken}`;
    const redactedUrl = url.replace(apiToken, "[REDACTED]");

    let response: Response;

    try {
        response = await fetch(url, {
            next: { revalidate: 300 },
        });
    } catch (error) {
        console.error("[MarketAux] Network error while fetching article", { url: redactedUrl, error });
        throw new Error("Network error while contacting MarketAux");
    }

    if (!response.ok) {
        const bodyText = await response.text().catch(() => "");
        const errorMessage = extractErrorMessage(bodyText);

        console.error("[MarketAux] HTTP error while fetching article", {
            url: redactedUrl,
            status: response.status,
            statusText: response.statusText,
            body: bodyText,
            error: errorMessage,
        });

        const detailedMessage = errorMessage
            ? `MarketAux article request failed with status ${response.status}: ${errorMessage}`
            : `MarketAux article request failed with status ${response.status}`;

        throw new Error(detailedMessage);
    }

    let json: unknown;

    try {
        json = await response.json();
    } catch (error) {
        console.error("[MarketAux] Failed to parse article JSON", { url: redactedUrl, error });
        throw new Error("Unable to parse MarketAux article response JSON.");
    }

    const parsed = json as { data?: unknown };

    const article = Array.isArray(parsed?.data)
        ? (parsed.data as MarketauxArticle[])[0]
        : (parsed?.data as MarketauxArticle | undefined | null);

    if (!article) {
        console.warn("[MarketAux] Article not found in response", { url: redactedUrl, json });
        return null;
    }

    return article;
};

export const RESULTS_CAP = 5;
