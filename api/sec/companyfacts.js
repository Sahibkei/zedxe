import { Redis } from "@upstash/redis";

const MEMORY_TTL_MS = 60 * 60 * 1000;
const UPSTASH_TTL_SECONDS = 60 * 60 * 24;
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

const FORM_PRIORITY = ["10-K", "20-F", "40-F"];
const PREFERRED_UNITS = ["USD"];
const EPS_UNITS = ["USD/shares", "USD/share"];

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
 * Coerce a value to a number or null.
 * @param {unknown} value - Raw value.
 * @returns {number|null} Parsed number or null.
 */
function toNumber(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") return value;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Choose the first available fact entry by tag and preferred units.
 * @param {Record<string, { units?: Record<string, Array<object>> }>} factMap - SEC fact map.
 * @param {string[]} tags - Preferred tag list.
 * @param {string[]} preferredUnits - Preferred unit list.
 * @returns {{ unitKey: string, entries: Array<object> } | null} Selection.
 */
function chooseFact(factMap, tags, preferredUnits) {
    for (const tag of tags) {
        const fact = factMap?.[tag];
        if (!fact?.units) continue;
        const unitKey = preferredUnits.find((unit) => fact.units?.[unit]);
        if (unitKey) {
            return { unitKey, entries: fact.units[unitKey] };
        }
        const [fallbackUnit] = Object.keys(fact.units);
        if (fallbackUnit) {
            return { unitKey: fallbackUnit, entries: fact.units[fallbackUnit] };
        }
    }
    return null;
}

/**
 * Normalize SEC fact entries to FY values by latest filed date and preferred form.
 * @param {Array<object>} entries - SEC fact entries.
 * @returns {Map<string, { value: number|null, rank?: number, filed?: string }>} Map of year to value.
 */
function normalizeEntries(entries) {
    const normalized = new Map();
    if (!Array.isArray(entries)) return normalized;

    for (const entry of entries) {
        if (!entry || entry.fp !== "FY" || !entry.fy) continue;
        const year = String(entry.fy);
        const rank = FORM_PRIORITY.includes(entry.form) ? FORM_PRIORITY.indexOf(entry.form) : FORM_PRIORITY.length;
        const filed = entry.filed ?? "";
        const existing = normalized.get(year);

        if (!existing || rank < existing.rank || (rank === existing.rank && filed > existing.filed)) {
            normalized.set(year, { value: toNumber(entry.val), rank, filed });
        }
    }

    return normalized;
}

/**
 * Build a metric from SEC facts for the provided tags.
 * @param {Record<string, { units?: Record<string, Array<object>> }>} factMap - SEC fact map.
 * @param {{ metric: string, tags: string[], unit: string, preferredUnits?: string[] }} options - Metric options.
 * @returns {{ metric: string, unit: string, valuesByYear: Map<string, { value: number|null }> }} Metric data.
 */
function buildMetric(factMap, { metric, tags, unit, preferredUnits }) {
    const selection = chooseFact(factMap, tags, preferredUnits ?? PREFERRED_UNITS);
    if (!selection) {
        return { metric, unit, valuesByYear: new Map() };
    }
    return { metric, unit, valuesByYear: normalizeEntries(selection.entries) };
}

/**
 * Extract and sort all years from metric maps.
 * @param {Array<Map<string, { value: number|null }>>} maps - Metric year maps.
 * @returns {string[]} Years sorted descending.
 */
function extractYears(maps) {
    const yearSet = new Set();
    maps.forEach((map) => {
        for (const year of map.keys()) yearSet.add(year);
    });
    return Array.from(yearSet).sort((a, b) => Number(b) - Number(a));
}

/**
 * Align metric values to the complete year list.
 * @param {{ metric: string, unit: string, valuesByYear: Map<string, { value: number|null }> }} metricData - Metric data.
 * @param {string[]} years - Year list.
 * @returns {{ metric: string, unit: string, values: Array<number|null> }} Aligned metric.
 */
function alignMetric(metricData, years) {
    return {
        metric: metricData.metric,
        unit: metricData.unit,
        values: years.map((year) => metricData.valuesByYear.get(year)?.value ?? null),
    };
}

/**
 * Sum long-term and current debt values by year.
 * @param {{ valuesByYear: Map<string, { value: number|null }> }} longTerm - Long-term debt.
 * @param {{ valuesByYear: Map<string, { value: number|null }> }} current - Current debt.
 * @param {string[]} years - Year list.
 * @returns {{ metric: string, unit: string, valuesByYear: Map<string, { value: number|null }> }} Total debt metric.
 */
function sumDebt(longTerm, current, years) {
    const valuesByYear = new Map();
    years.forEach((year) => {
        const longValue = longTerm.valuesByYear.get(year)?.value ?? null;
        const currentValue = current.valuesByYear.get(year)?.value ?? null;
        if (longValue === null || currentValue === null) {
            valuesByYear.set(year, { value: null });
        } else {
            valuesByYear.set(year, { value: longValue + currentValue });
        }
    });
    return { metric: "Total Debt", unit: "USD", valuesByYear };
}

/**
 * Build the normalized response payload for the frontend.
 * @param {string} symbol - Ticker symbol.
 * @param {object} data - SEC companyfacts payload.
 * @returns {object} Normalized response.
 */
function buildPayload(symbol, data) {
    const factMap = data?.facts?.["us-gaap"] ?? {};

    const incomeMetrics = [
        buildMetric(factMap, {
            metric: "Revenue",
            tags: ["RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet", "Revenues"],
            unit: "USD",
        }),
        buildMetric(factMap, { metric: "Cost Of Revenue", tags: ["CostOfRevenue"], unit: "USD" }),
        buildMetric(factMap, { metric: "Gross Profit", tags: ["GrossProfit"], unit: "USD" }),
        buildMetric(factMap, {
            metric: "Research And Development",
            tags: ["ResearchAndDevelopmentExpense"],
            unit: "USD",
        }),
        buildMetric(factMap, {
            metric: "Selling General & Admin",
            tags: ["SellingGeneralAndAdministrativeExpense"],
            unit: "USD",
        }),
        buildMetric(factMap, { metric: "Operating Expenses", tags: ["OperatingExpenses"], unit: "USD" }),
        buildMetric(factMap, {
            metric: "Depreciation And Amortization",
            tags: ["DepreciationDepletionAndAmortization", "DepreciationAndAmortization"],
            unit: "USD",
        }),
        buildMetric(factMap, { metric: "Operating Income", tags: ["OperatingIncomeLoss"], unit: "USD" }),
        buildMetric(factMap, { metric: "Net Income", tags: ["NetIncomeLoss"], unit: "USD" }),
        buildMetric(factMap, {
            metric: "EPS (Basic)",
            tags: ["EarningsPerShareBasic"],
            unit: "USD/share",
            preferredUnits: EPS_UNITS,
        }),
    ];

    const balanceMetrics = [
        buildMetric(factMap, { metric: "Total Assets", tags: ["Assets"], unit: "USD" }),
        buildMetric(factMap, { metric: "Total Liabilities", tags: ["Liabilities"], unit: "USD" }),
        buildMetric(factMap, {
            metric: "Total Equity",
            tags: ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"],
            unit: "USD",
        }),
        buildMetric(factMap, {
            metric: "Cash And Equivalents",
            tags: ["CashAndCashEquivalentsAtCarryingValue"],
            unit: "USD",
        }),
    ];

    const cashflowMetrics = [
        buildMetric(factMap, {
            metric: "Operating Cash Flow",
            tags: ["NetCashProvidedByUsedInOperatingActivities"],
            unit: "USD",
        }),
        buildMetric(factMap, {
            metric: "Investing Cash Flow",
            tags: ["NetCashProvidedByUsedInInvestingActivities"],
            unit: "USD",
        }),
        buildMetric(factMap, {
            metric: "Financing Cash Flow",
            tags: ["NetCashProvidedByUsedInFinancingActivities"],
            unit: "USD",
        }),
        buildMetric(factMap, {
            metric: "Capital Expenditure",
            tags: ["PaymentsToAcquirePropertyPlantAndEquipment", "CapitalExpenditures"],
            unit: "USD",
        }),
    ];

    const debtMetric = buildMetric(factMap, { metric: "Total Debt", tags: ["Debt"], unit: "USD" });
    const longDebt = buildMetric(factMap, { metric: "Long Term Debt", tags: ["LongTermDebtNoncurrent"], unit: "USD" });
    const currentDebt = buildMetric(factMap, { metric: "Current Debt", tags: ["DebtCurrent"], unit: "USD" });

    const allMetricMaps = [
        ...incomeMetrics,
        ...balanceMetrics,
        ...cashflowMetrics,
        debtMetric,
        longDebt,
        currentDebt,
    ].map((metric) => metric.valuesByYear);

    const years = extractYears(allMetricMaps);

    let totalDebt = debtMetric;
    if (totalDebt.valuesByYear.size === 0 && (longDebt.valuesByYear.size || currentDebt.valuesByYear.size)) {
        totalDebt = sumDebt(longDebt, currentDebt, years);
    }

    balanceMetrics.push(totalDebt);

    const operatingCash = cashflowMetrics.find((metric) => metric.metric === "Operating Cash Flow");
    const capex = cashflowMetrics.find((metric) => metric.metric === "Capital Expenditure");
    const fcfValuesByYear = new Map();
    years.forEach((year) => {
        const op = operatingCash?.valuesByYear.get(year)?.value ?? null;
        const cap = capex?.valuesByYear.get(year)?.value ?? null;
        if (op === null || cap === null) {
            fcfValuesByYear.set(year, { value: null });
        } else {
            fcfValuesByYear.set(year, { value: op - Math.abs(cap) });
        }
    });
    cashflowMetrics.push({ metric: "Free Cash Flow", unit: "USD", valuesByYear: fcfValuesByYear });

    return {
        symbol: symbol.toUpperCase(),
        cik: data?.cik ?? "",
        companyName: data?.entityName ?? "",
        years,
        income: incomeMetrics.map((metric) => alignMetric(metric, years)),
        balance: balanceMetrics.map((metric) => alignMetric(metric, years)),
        cashflow: cashflowMetrics.map((metric) => alignMetric(metric, years)),
        meta: {
            source: "SEC companyfacts",
            fetchedAtISO: new Date().toISOString(),
        },
    };
}

/**
 * Vercel serverless handler for SEC companyfacts proxy.
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

    const cacheKey = `sec:companyfacts:${symbol.toUpperCase()}`;
    let cached = null;
    try {
        cached = await getCache(cacheKey);
    } catch (error) {
        console.warn("cache read failed", error);
    }
    if (cached) {
        res.status(200).json(cached);
        return;
    }

    try {
        const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        const headers = {
            "User-Agent": userAgent,
            Accept: "application/json",
        };

        const tickerResponse = await fetchWithTimeout("https://www.sec.gov/files/company_tickers.json", { headers });
        if (!tickerResponse.ok) {
            res.status(tickerResponse.status).json({ error: "Failed to fetch SEC ticker mapping.", requestId });
            return;
        }
        const tickers = await tickerResponse.json();
        const match = Object.values(tickers).find(
            (entry) => entry?.ticker?.toUpperCase() === symbol.toUpperCase(),
        );

        if (!match) {
            res.status(404).json({ error: `Ticker not found for symbol ${symbol}.`, requestId });
            return;
        }

        const cik = String(match.cik_str).padStart(10, "0");
        const factsResponse = await fetchWithTimeout(
            `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
            { headers },
        );
        if (!factsResponse.ok) {
            res.status(factsResponse.status).json({ error: "Failed to fetch SEC company facts.", requestId });
            return;
        }

        const factsJson = await factsResponse.json();
        const payload = buildPayload(symbol, factsJson);
        payload.cik = cik;

        try {
            await setCache(cacheKey, payload);
        } catch (error) {
            console.warn("cache write failed", error);
        }
        res.status(200).json(payload);
    } catch (error) {
        const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        console.error("[sec/companyfacts] error", {
            symbol,
            message: error?.message,
            stack: error?.stack,
        });
        res.status(500).json({
            error: "Unexpected error fetching SEC company facts.",
            requestId,
        });
    }
}
