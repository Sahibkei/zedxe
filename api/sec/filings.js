import { Redis } from "@upstash/redis";

const MEMORY_TTL_MS = 60 * 60 * 1000;
const UPSTASH_TTL_SECONDS = 60 * 60 * 24;
const memoryCache = new Map();

const SEC_BASE_URL = "https://data.sec.gov";
const SEC_FILES_FALLBACK = "https://www.sec.gov";
const DEFAULT_FORMS = ["10-K", "10-Q"];

/**
 * Get a cached value from the in-memory cache if not expired.
 * @param {string} key - Cache key.
 * @returns {object|null} Cached value or null.
 */
function getMemoryCache(key) {
    const entry = memoryCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        memoryCache.delete(key);
        return null;
    }
    return entry.value;
}

/**
 * Store a value in the in-memory cache with TTL.
 * @param {string} key - Cache key.
 * @param {object} value - Value to store.
 * @param {number} ttlMs - TTL in milliseconds.
 * @returns {void}
 */
function setMemoryCache(key, value, ttlMs) {
    memoryCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

const hasUpstash = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
const redis = hasUpstash ? Redis.fromEnv() : null;

/**
 * Fetch a cached response from Upstash or memory.
 * @param {string} key - Cache key.
 * @returns {Promise<object|null>} Cached response.
 */
async function getCache(key) {
    if (redis) {
        return (await redis.get(key)) ?? null;
    }
    return getMemoryCache(key);
}

/**
 * Store a response in cache (Upstash or memory).
 * @param {string} key - Cache key.
 * @param {object} value - Value to cache.
 * @returns {Promise<void>}
 */
async function setCache(key, value) {
    if (redis) {
        await redis.set(key, value, { ex: UPSTASH_TTL_SECONDS });
        return;
    }
    setMemoryCache(key, value, MEMORY_TTL_MS);
}

let tickerMapCache = null;
let tickerMapFetchedAt = 0;
let tickerMapPromise = null;
const TICKER_MAP_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Fetch with timeout using AbortController.
 * @param {string} url - URL to fetch.
 * @param {RequestInit} options - Fetch options.
 * @param {number} timeoutMs - Timeout in milliseconds.
 * @returns {Promise<Response>} Fetch response.
 */
async function fetchWithTimeout(url, options, timeoutMs = 10000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Fetch JSON from SEC with validation.
 * @param {string} url - Full URL to fetch.
 * @param {Record<string, string>} headers - Request headers.
 * @returns {Promise<object>} Parsed JSON.
 */
async function fetchSecJson(url, headers) {
    const response = await fetchWithTimeout(url, { headers });
    if (!response.ok) {
        const snippet = await response.text().catch(() => "");
        throw new Error(`SEC fetch failed: ${response.status} ${response.statusText} - ${snippet.slice(0, 120)}`);
    }
    return response.json();
}

/**
 * Retrieve and cache a ticker-to-CIK map with TTL and in-flight deduplication.
 * @param {Record<string, string>} headers - Request headers.
 * @returns {Promise<Map<string, string>>} Ticker map.
 */
async function getTickerToCikMap(headers) {
    const now = Date.now();
    if (tickerMapCache && now - tickerMapFetchedAt < TICKER_MAP_TTL_MS) {
        return tickerMapCache;
    }

    if (tickerMapPromise) {
        return tickerMapPromise;
    }

    tickerMapPromise = (async () => {
        let data;
        try {
            data = await fetchSecJson(`${SEC_BASE_URL}/files/company_tickers.json`, headers);
        } catch (error) {
            data = await fetchSecJson(`${SEC_FILES_FALLBACK}/files/company_tickers.json`, headers);
        }

        const map = new Map();
        Object.values(data || {}).forEach((entry) => {
            if (!entry?.ticker) return;
            const cik = String(entry.cik_str ?? "").padStart(10, "0");
            map.set(entry.ticker.toUpperCase(), cik);
        });

        tickerMapCache = map;
        tickerMapFetchedAt = Date.now();
        return map;
    })();

    try {
        return await tickerMapPromise;
    } finally {
        tickerMapPromise = null;
    }
}

/**
 * Build SEC filings payload for the response.
 * @param {object} submissions - SEC submissions data.
 * @param {string} ticker - Ticker symbol.
 * @param {string} cik - CIK string.
 * @param {string} formFilter - Optional form filter.
 * @returns {object} Filings payload.
 */
function buildFilingsPayload(submissions, ticker, cik, formFilter) {
    const recent = submissions?.filings?.recent ?? {};
    const forms = recent.form || [];
    const accessionNumbers = recent.accessionNumber || [];
    const filingDates = recent.filingDate || [];
    const periodDates = recent.reportDate || [];
    const primaryDocs = recent.primaryDocument || [];

    const filings = forms.map((form, idx) => {
        const accession = accessionNumbers[idx];
        const doc = primaryDocs[idx];
        const cikNoPad = String(submissions?.cik || cik).replace(/^0+/, "");
        const link = accession && doc
            ? `https://www.sec.gov/Archives/edgar/data/${cikNoPad}/${accession.replace(/-/g, "")}/${doc}`
            : undefined;
        return {
            formType: form,
            filedAt: filingDates[idx],
            periodEnd: periodDates[idx],
            accessionNumber: accession,
            primaryDocument: doc,
            link,
            description: submissions?.name,
            companyName: submissions?.name,
        };
    });

    const filtered = formFilter
        ? filings.filter((filing) => filing.formType === formFilter)
        : filings.filter((filing) => DEFAULT_FORMS.includes(filing.formType));

    return {
        filings: filtered.slice(0, 12),
        ticker: submissions?.ticker ?? ticker,
        cik,
    };
}

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    if (req.method !== "GET") {
        res.status(405).json({ error: "Method not allowed." });
        return;
    }

    const symbol = String(req.query.symbol || "").trim().toUpperCase();
    const formFilter = String(req.query.form || "").trim().toUpperCase();

    if (!symbol) {
        res.status(400).json({ error: "symbol is required." });
        return;
    }

    const userAgent = process.env.SEC_USER_AGENT;
    if (!userAgent) {
        res.status(500).json({ error: "SEC_USER_AGENT is required to call the SEC API." });
        return;
    }

    const cacheKey = `sec:filings:${symbol}:${formFilter || "all"}`;
    const cached = await getCache(cacheKey);
    if (cached) {
        res.status(200).json(cached);
        return;
    }

    try {
        const headers = {
            "User-Agent": userAgent,
            Accept: "application/json",
        };
        const map = await getTickerToCikMap(headers);
        const cik = map.get(symbol);

        if (!cik) {
            res.status(404).json({ error: `No CIK found for ticker ${symbol}.` });
            return;
        }

        const submissions = await fetchSecJson(`${SEC_BASE_URL}/submissions/CIK${cik}.json`, headers);
        const payload = buildFilingsPayload(submissions, symbol, cik, formFilter);

        res.status(200).json(payload);

        try {
            await setCache(cacheKey, payload);
        } catch (error) {
            console.warn("cache write failed", error);
        }
    } catch (error) {
        console.error("[sec/filings] error", error);
        res.status(500).json({ error: "Unexpected error fetching SEC filings." });
    }
}
