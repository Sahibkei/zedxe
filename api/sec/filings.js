import { Redis } from "@upstash/redis";

const MEMORY_TTL_MS = 6 * 60 * 60 * 1000;
const UPSTASH_TTL_SECONDS = 6 * 60 * 60;
const memoryCache = new Map();

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
 * Resolve a CIK for a given symbol using SEC ticker mapping.
 * @param {string} symbol - Ticker symbol.
 * @param {Record<string, unknown> | Array<object>} tickers - SEC ticker map response.
 * @returns {{ cik: string, companyName: string } | null} CIK and company name.
 */
function resolveCik(symbol, tickers) {
    const upper = symbol.toUpperCase();
    const entries = Array.isArray(tickers) ? tickers : Object.values(tickers ?? {});
    const match = entries.find((entry) => entry?.ticker?.toUpperCase() === upper);
    if (!match) return null;
    return {
        cik: String(match.cik_str).padStart(10, "0"),
        companyName: match.title || match.name || "",
    };
}

/**
 * Normalize SEC submissions recent filings into a list of objects.
 * @param {object} recent - SEC filings recent payload.
 * @param {object} options - Normalization options.
 * @param {string} options.cik - CIK string (padded).
 * @param {string} [options.form] - Optional form filter.
 * @param {number} options.limit - Max filings to include.
 * @returns {Array<object>} Normalized filings.
 */
function normalizeRecentFilings(recent, { cik, form, limit }) {
    if (!recent?.form) return [];
    const total = recent.form.length;
    const cikForUrl = cik.replace(/^0+/, "") || "0";
    const filings = [];

    for (let idx = 0; idx < total; idx += 1) {
        const entryForm = recent.form[idx];
        if (!entryForm) continue;
        if (form && entryForm !== form) continue;
        const accession = recent.accessionNumber?.[idx] ?? "";
        const accessionNoDashes = accession.replace(/-/g, "");
        const primaryDoc = recent.primaryDocument?.[idx] ?? "";
        const filed = recent.filingDate?.[idx] ?? "";
        const reportDate = recent.reportDate?.[idx] ?? "";
        const description = recent.primaryDocDescription?.[idx] ?? "";

        filings.push({
            form: entryForm,
            filed,
            reportDate,
            accession,
            accessionNoDashes,
            primaryDoc,
            description,
            secIndexUrl: `https://www.sec.gov/Archives/edgar/data/${cikForUrl}/${accessionNoDashes}/${accession}-index.html`,
            primaryDocUrl: `https://www.sec.gov/Archives/edgar/data/${cikForUrl}/${accessionNoDashes}/${primaryDoc}`,
        });
    }

    filings.sort((a, b) => (b.filed || "").localeCompare(a.filed || ""));
    return filings.slice(0, limit);
}

/**
 * Build the response payload for SEC filings.
 * @param {string} symbol - Ticker symbol.
 * @param {string} cik - CIK string.
 * @param {string} companyName - Company name.
 * @param {object} submissions - SEC submissions payload.
 * @param {string} [form] - Optional form filter.
 * @param {number} limit - Max filings.
 * @returns {object} Normalized payload.
 */
function buildPayload(symbol, cik, companyName, submissions, form, limit) {
    const filings = normalizeRecentFilings(submissions?.filings?.recent, { cik, form, limit });
    return {
        symbol: symbol.toUpperCase(),
        cik,
        companyName: companyName || submissions?.name || "",
        filings,
        meta: {
            fetchedAtISO: new Date().toISOString(),
            source: "SEC submissions",
        },
    };
}

/**
 * Vercel serverless handler for SEC filings proxy.
 * @param {import("http").IncomingMessage} req - Incoming request.
 * @param {import("http").ServerResponse} res - Server response.
 * @returns {Promise<void>}
 */
export default async function handler(req, res) {
    if (req.method !== "GET") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }

    const symbol = typeof req.query?.symbol === "string" ? req.query.symbol.trim() : "";
    if (!symbol) {
        res.status(400).json({ error: "Missing symbol query parameter." });
        return;
    }

    const userAgent = process.env.SEC_USER_AGENT;
    if (!userAgent) {
        res.status(500).json({ error: "SEC_USER_AGENT is required to call the SEC API." });
        return;
    }

    const rawLimit = typeof req.query?.limit === "string" ? Number(req.query.limit) : NaN;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 25;
    const form = typeof req.query?.form === "string" ? req.query.form.trim() : "";
    const formFilter = form || undefined;

    const cacheKey = `sec:filings:${symbol.toUpperCase()}:${formFilter ?? "all"}:${limit}`;
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

        const tickerResponse = await fetchWithTimeout("https://www.sec.gov/files/company_tickers.json", { headers });
        if (!tickerResponse.ok) {
            res.status(tickerResponse.status).json({ error: "Failed to fetch SEC ticker mapping." });
            return;
        }
        const tickers = await tickerResponse.json();
        const match = resolveCik(symbol, tickers);

        if (!match) {
            res.status(404).json({ error: `Ticker not found for symbol ${symbol}.` });
            return;
        }

        const submissionsResponse = await fetchWithTimeout(
            `https://data.sec.gov/submissions/CIK${match.cik}.json`,
            { headers },
        );
        if (!submissionsResponse.ok) {
            res.status(submissionsResponse.status).json({ error: "Failed to fetch SEC submissions." });
            return;
        }

        const submissions = await submissionsResponse.json();
        const payload = buildPayload(symbol, match.cik, match.companyName, submissions, formFilter, limit);

        await setCache(cacheKey, payload);
        res.status(200).json(payload);
    } catch (error) {
        console.error("[sec/filings] error", {
            symbol,
            message: error?.message,
            stack: error?.stack,
        });
        res.status(500).json({ error: "Unexpected error fetching SEC filings." });
    }
}
