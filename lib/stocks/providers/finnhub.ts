const FINNHUB_BASE = "https://finnhub.io/api/v1";

type FinnhubParams = Record<string, string | number | undefined>;

async function finnhubFetch(path: string, params: FinnhubParams) {
    const apiKey = process.env.FINNHUB_API_KEY;

    if (!apiKey) {
        throw new Error("FINNHUB_API_KEY environment variable is required to fetch Finnhub data");
    }

    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            searchParams.set(key, String(value));
        }
    });
    searchParams.set("token", apiKey);

    const url = `${FINNHUB_BASE}${path}?${searchParams.toString()}`;

    const response = await fetch(url, {
        signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
        const bodySnippet = await response.text().catch(() => "<unavailable>");
        throw new Error(`Finnhub request failed (${response.status}) for ${path}: ${bodySnippet.slice(0, 200)}`);
    }

    return response.json();
}

export async function getFinnhubProfile(ticker: string) {
    return finnhubFetch("/stock/profile2", { symbol: ticker });
}

export async function getFinnhubQuote(ticker: string) {
    return finnhubFetch("/quote", { symbol: ticker });
}

export async function getFinnhubBasicFinancials(ticker: string) {
    return finnhubFetch("/stock/metric", { symbol: ticker, metric: "all" });
}

export async function tryGetFinnhubFinancials(
    ticker: string,
    statement: "ic" | "bs" | "cf",
    freq: "annual" | "quarterly"
): Promise<{ source: "financials" | "financials-reported"; raw: any } | null> {
    try {
        const data = await finnhubFetch("/stock/financials", { symbol: ticker, statement, freq });
        return { source: "financials", raw: data };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // fall back to financials-reported if primary endpoint is unavailable (e.g., plan limits)
        try {
            const data = await finnhubFetch("/stock/financials-reported", { symbol: ticker, freq });
            return { source: "financials-reported", raw: data };
        } catch (fallbackError) {
            throw new Error(
                `Unable to fetch Finnhub financials (${statement}/${freq}). Primary error: ${message}. Fallback error: ${
                    fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
                }`
            );
        }
    }
}
