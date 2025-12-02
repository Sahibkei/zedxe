import type { MarketauxArticle } from "@/types/marketaux";

const MARKET_AUX_BASE_URL = "https://api.marketaux.com/v1/news/all";
export const DEFAULT_LIMIT = 10;
const PUBLISHED_AFTER_DAYS = 14;

export type NewsMeta = {
    page: number;
    totalPages: number;
    found: number;
    limit: number;
};

export type NewsResult = {
    articles: MarketauxArticle[];
    meta: NewsMeta;
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

export async function fetchNews(page: number): Promise<NewsResult> {
    const fallback: NewsResult = {
        articles: [],
        meta: { page: 1, totalPages: 1, found: 0, limit: DEFAULT_LIMIT },
    };

    try {
        const apiToken = process.env.MARKETAUX_API_TOKEN;

        if (!apiToken) {
            console.error("[MarketAux] Failed to fetch news", { reason: "Missing MARKETAUX_API_TOKEN" });
            return fallback;
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
        const response = await fetch(url, { next: { revalidate: 60 } });

        if (!response.ok) {
            console.error("[MarketAux] Failed to fetch news", { status: response.status, statusText: response.statusText });
            return fallback;
        }

        const json = await response.json().catch(() => ({}));
        const meta = json && typeof json === "object" ? (json as { meta?: { [key: string]: unknown } }).meta : undefined;
        const articles = (json as { data?: unknown; results?: unknown }).data ?? (json as { results?: unknown }).results ?? [];
        const limit = typeof meta?.limit === "number" ? meta.limit : DEFAULT_LIMIT;
        const found = typeof meta?.found === "number" ? meta.found : (Array.isArray(articles) ? articles.length : 0);
        const totalPages = Math.max(1, Math.ceil(found / limit));

        return {
            articles: Array.isArray(articles) ? (articles as MarketauxArticle[]) : [],
            meta: {
                page: typeof meta?.page === "number" && meta.page > 0 ? Math.floor(meta.page) : safePage,
                totalPages,
                found,
                limit,
            },
        } satisfies NewsResult;
    } catch (error) {
        console.error("[MarketAux] Failed to fetch news", error);
        return fallback;
    }
}
