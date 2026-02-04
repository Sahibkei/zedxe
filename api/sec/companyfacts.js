import { Redis } from "@upstash/redis";

const MEMORY_TTL_MS = 60 * 60 * 1000;
const UPSTASH_TTL_SECONDS = 60 * 60 * 24;
const memoryCache = new Map();

function getMemoryCache(key) {
    const entry = memoryCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        memoryCache.delete(key);
        return null;
    }
    return entry.value;
}

function setMemoryCache(key, value, ttlMs) {
    memoryCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

const hasUpstash = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
const redis = hasUpstash ? Redis.fromEnv() : null;

async function getCache(key) {
    if (redis) {
        return (await redis.get(key)) ?? null;
    }
    return getMemoryCache(key);
}

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

function toNumber(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") return value;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

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

function buildMetric(factMap, { metric, tags, unit, preferredUnits }) {
    const selection = chooseFact(factMap, tags, preferredUnits ?? PREFERRED_UNITS);
    if (!selection) {
        return { metric, unit, valuesByYear: new Map() };
    }
    return { metric, unit, valuesByYear: normalizeEntries(selection.entries) };
}

function extractYears(maps) {
    const yearSet = new Set();
    maps.forEach((map) => {
        for (const year of map.keys()) yearSet.add(year);
    });
    return Array.from(yearSet).sort((a, b) => Number(b) - Number(a));
}

function alignMetric(metricData, years) {
    return {
        metric: metricData.metric,
        unit: metricData.unit,
        values: years.map((year) => metricData.valuesByYear.get(year)?.value ?? null),
    };
}

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

        const tickerResponse = await fetch("https://www.sec.gov/files/company_tickers.json", { headers });
        if (!tickerResponse.ok) {
            res.status(tickerResponse.status).json({ error: "Failed to fetch SEC ticker mapping." });
            return;
        }
        const tickers = await tickerResponse.json();
        const match = Object.values(tickers).find(
            (entry) => entry?.ticker?.toUpperCase() === symbol.toUpperCase(),
        );

        if (!match) {
            res.status(404).json({ error: `Ticker not found for symbol ${symbol}.` });
            return;
        }

        const cik = String(match.cik_str).padStart(10, "0");
        const factsResponse = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, { headers });
        if (!factsResponse.ok) {
            res.status(factsResponse.status).json({ error: "Failed to fetch SEC company facts." });
            return;
        }

        const factsJson = await factsResponse.json();
        const payload = buildPayload(symbol, factsJson);
        payload.cik = cik;

        await setCache(cacheKey, payload);
        res.status(200).json(payload);
    } catch (error) {
        res.status(500).json({ error: "Unexpected error fetching SEC company facts." });
    }
}
