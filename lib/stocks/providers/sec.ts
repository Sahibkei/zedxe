import { cache } from "react";

const SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const SEC_SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK";
const SEC_COMPANY_FACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK";

interface TickerEntry {
    cik_str: number;
    ticker: string;
    title: string;
    exchange?: string;
}

interface TickerMapResult {
    [key: string]: TickerEntry;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
let cachedTickerMap: { data: TickerMapResult; fetchedAt: number } | null = null;

export function normalizeTicker(symbol: string): string {
    const trimmed = symbol?.trim();

    if (!trimmed) {
        throw new Error("Ticker is required for SEC lookup");
    }

    const upper = trimmed.toUpperCase();
    return upper.includes(":") ? upper.split(":")[1] ?? upper : upper;
}

export async function fetchSecJson<T>(url: string): Promise<T> {
    const userAgent = process.env.SEC_USER_AGENT;

    if (!userAgent) {
        throw new Error("SEC_USER_AGENT environment variable is required to fetch SEC data");
    }

    const response = await fetch(url, {
        signal: AbortSignal.timeout(30000),
        headers: {
            "User-Agent": userAgent,
            "Accept-Encoding": "gzip, deflate, br",
            Accept: "application/json",
        },
    });

    if (!response.ok) {
        throw new Error(`SEC request failed (${response.status}) for ${url}`);
    }

    return response.json() as Promise<T>;
}

export const getTickerMap = cache(async (): Promise<TickerMapResult> => {
    const now = Date.now();
    if (cachedTickerMap && now - cachedTickerMap.fetchedAt < ONE_DAY_MS) {
        return cachedTickerMap.data;
    }

    const raw = await fetchSecJson<TickerMapResult>(SEC_TICKERS_URL);
    const normalized: TickerMapResult = {};

    Object.values(raw).forEach((entry) => {
        if (entry?.ticker) {
            normalized[entry.ticker.toUpperCase()] = entry;
        }
    });

    cachedTickerMap = { data: normalized, fetchedAt: now };
    return normalized;
});

export async function getCikForTicker(ticker: string): Promise<{ cik10: string; title: string; exchange?: string }>
{
    const map = await getTickerMap();
    const lookupKey = ticker?.trim().toUpperCase();
    const entry = map[lookupKey];

    if (!entry) {
        throw new Error(`SEC CIK not found for ticker ${ticker}`);
    }

    const cik10 = String(entry.cik_str).padStart(10, "0");
    return { cik10, title: entry.title, exchange: entry.exchange };
}

export async function getSubmissions(cik10: string) {
    return fetchSecJson<any>(`${SEC_SUBMISSIONS_URL}${cik10}.json`);
}

export async function getCompanyFacts(cik10: string) {
    return fetchSecJson<any>(`${SEC_COMPANY_FACTS_URL}${cik10}.json`);
}

