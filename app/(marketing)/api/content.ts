export type ApiCoverageItem = {
    region: string;
    regime: string;
    status: "Live" | "Limited" | "Pending";
    access: string;
    note: string;
};

export type ApiPlanItem = {
    id: "free" | "plus" | "pro";
    name: string;
    price: string;
    requestsPerHour: string;
    access: string;
    regions: string;
    note: string;
    historyDepth?: string;
    sourceCoverage?: string;
    idealFor?: string;
};

export type ApiEndpointItem = {
    method: "GET";
    path: string;
    description: string;
    auth: string;
};

export type ApiHighlightItem = {
    icon: "server" | "lock" | "globe" | "orbit";
    title: string;
    body: string;
};

export const apiCoverage: ApiCoverageItem[] = [
    {
        region: "United States",
        regime: "sec_edgar",
        status: "Live",
        access: "Free, Plus, and Pro",
        note: "Official SEC statements are the production baseline, including restated and as-reported views.",
    },
    {
        region: "United Kingdom",
        regime: "companies_house",
        status: "Limited",
        access: "Pro when parser coverage is ready",
        note: "Companies House auth is live, but full filing-level parser coverage is still being completed.",
    },
    {
        region: "India",
        regime: "india_placeholder",
        status: "Limited",
        access: "Pro as broader parser coverage comes online",
        note: "Official annual coverage is live. Quarterly and TTM depth still depends on broader parser work.",
    },
    {
        region: "Japan",
        regime: "edinet",
        status: "Pending",
        access: "Pro once the EDINET key is available",
        note: "Official EDINET parsing is pending the production key, so Japan is not yet fully available on the live site flow.",
    },
];

export const apiPlans: ApiPlanItem[] = [
    {
        id: "free",
        name: "Free",
        price: "EUR 0",
        requestsPerHour: "100",
        access: "Signed-in starter plan",
        regions: "US only",
        note: "Best for getting started with the API while keeping abuse risk low through tighter rate limiting.",
        historyDepth: "Last 5 years of US historical data",
        sourceCoverage: "Official SEC only",
        idealFor: "Testing, simple automations, light US-only usage",
    },
    {
        id: "plus",
        name: "Plus",
        price: "EUR 7 / mo",
        requestsPerHour: "500",
        access: "Paid US plan",
        regions: "US only",
        note: "Adds a higher US-only rate limit and includes the API access path for the upcoming Excel plugin.",
        historyDepth: "US history with higher working limits",
        sourceCoverage: "Official SEC only",
        idealFor: "Recurring US data users and future Excel plugin workflows",
    },
    {
        id: "pro",
        name: "Pro",
        price: "EUR 10 / mo",
        requestsPerHour: "2,000",
        access: "Full API plan",
        regions: "Full API access",
        note: "Designed for serious product use with broader region access and a materially higher rate limit.",
        historyDepth: "Broader working history where filings are available",
        sourceCoverage: "US plus non-US regimes as each source is live",
        idealFor: "Apps shipping broader statement coverage at production volume",
    },
];

export const apiPricingRows = [
    {
        label: "Authentication",
        values: {
            Free: "Site account",
            Plus: "Site account plus paid access",
            Pro: "Site account plus paid access",
        },
    },
    {
        label: "Requests per hour",
        values: {
            Free: "100",
            Plus: "500",
            Pro: "2,000",
        },
    },
    {
        label: "Monthly price",
        values: {
            Free: "EUR 0",
            Plus: "EUR 7",
            Pro: "EUR 10",
        },
    },
    {
        label: "US coverage",
        values: {
            Free: "Included",
            Plus: "Included",
            Pro: "Included",
        },
    },
    {
        label: "Historical depth",
        values: {
            Free: "Last 5 years",
            Plus: "Higher working US depth",
            Pro: "Highest available by regime and source",
        },
    },
    {
        label: "UK / India / Japan",
        values: {
            Free: "No",
            Plus: "No",
            Pro: "Included as each regime reaches production readiness",
        },
    },
    {
        label: "Excel plugin",
        values: {
            Free: "No",
            Plus: "Coming soon",
            Pro: "Coming soon",
        },
    },
    {
        label: "Rate-limit posture",
        values: {
            Free: "Strict anti-abuse guardrail",
            Plus: "Higher but still protected",
            Pro: "Highest standard product limit",
        },
    },
];

export const apiPricingNotes = [
    "Rate limits are intentional guardrails so a single user cannot spam the API and destabilize the app.",
    "Requested periods can exceed returned periods when upstream filing history is incomplete.",
    "US is the most mature official path today because it is backed by SEC company facts and filing metadata.",
    "UK is live but still parser-limited for some filing-level detail.",
    "India currently has official annual coverage, while quarterly and TTM depth still depend on broader parser work.",
    "Japan remains pending until the production EDINET key is available.",
    "The Excel plugin is planned for Plus and Pro, but it is not available yet.",
];

export const apiHighlights: ApiHighlightItem[] = [
    {
        icon: "server",
        title: "Statement-first API",
        body: "Fetch canonical income statement, balance sheet, and cash flow data through a single contract across regimes.",
    },
    {
        icon: "lock",
        title: "Site-owned signup and billing",
        body: "The main ZedXe site owns plans, signup, and future token management while the API stays focused on data delivery.",
    },
    {
        icon: "globe",
        title: "Region-aware coverage",
        body: "US is official today. UK and India are partially live. Japan stays pending until the EDINET production key is available.",
    },
    {
        icon: "orbit",
        title: "Built for product integration",
        body: "Terminal tables, charts, account dashboards, and billing-aware upgrade flows can all read from the same Zapi response model.",
    },
];

export const apiEndpoints: ApiEndpointItem[] = [
    {
        method: "GET",
        path: "/v1/statements/:identifier",
        description: "Canonical financial statement endpoint for annual, quarterly, normalized, and matrix output.",
        auth: "Bearer JWT for Free, Plus, and Pro users, plus service-key access for internal backend traffic.",
    },
    {
        method: "GET",
        path: "/v1/regimes",
        description: "Current adapter and regime status so the site can explain what is live, limited, or pending.",
        auth: "Public discovery access",
    },
    {
        method: "GET",
        path: "/v1/auth/status",
        description: "Plan-aware auth inspection endpoint for dashboards, quota display, and upgrade messaging.",
        auth: "Bearer JWT or service key",
    },
];

export const statementQueryParameters = [
    {
        name: "regime",
        value: "sec_edgar | companies_house | edinet | india_placeholder",
        note: "Selects the filing regime and is gated by the active user plan.",
    },
    {
        name: "statement",
        value: "income_statement | balance_sheet | cash_flow",
        note: "Chooses the canonical statement family.",
    },
    {
        name: "frequency",
        value: "annual | quarterly",
        note: "Quarterly requests can optionally append TTM where the economics are valid.",
    },
    {
        name: "view",
        value: "restated | as_reported",
        note: "Restated is the default. As-reported preserves the original filing view when revisions exist.",
    },
    {
        name: "format",
        value: "normalized | matrix",
        note: "Normalized is best for product logic. Matrix is best for statement table rendering.",
    },
    {
        name: "periods",
        value: "1-20",
        note: "The request can ask for more periods than are returned when upstream history is incomplete.",
    },
    {
        name: "includeTtm",
        value: "true | false",
        note: "Adds TTM for eligible quarterly duration statements. Annual requests do not emit TTM proxies.",
    },
    {
        name: "debug",
        value: "true | false",
        note: "When true, the normalized response includes canonical fact traces under debug.facts.",
    },
];

export const normalizedExample = `{
  "meta": {
    "ticker": "AAPL",
    "companyName": "Apple Inc.",
    "statement": "income_statement",
    "frequency": "annual",
    "view": "restated",
    "currency": "USD",
    "fiscalYearEnd": "Sep 30",
    "titleSlug": "AAPL_income-statement_Annual_Restated",
    "sourceRegime": "sec_edgar",
    "requestedPeriods": 3,
    "returnedPeriods": 3,
    "historyCoverage": "full",
    "qualityFlags": []
  },
  "columns": ["2023", "2024", "2025"],
  "rows": [
    {
      "metricCode": "gross_profit",
      "label": "Gross Profit",
      "depth": 0,
      "unit": "USD",
      "rowKind": "metric",
      "values": [169148000000, 180683000000, 195036000000],
      "qualityFlags": []
    }
  ],
  "periods": {
    "2025": {
      "revenue_total": 416161000000,
      "eps_diluted": 7.46
    }
  }
}`;

export const matrixExample = `{
  "meta": {
    "ticker": "AAPL",
    "statement": "income_statement",
    "frequency": "annual",
    "view": "restated",
    "currency": "USD",
    "fiscalYearEnd": "Sep 30",
    "titleSlug": "AAPL_income-statement_Annual_Restated",
    "requestedPeriods": 3,
    "returnedPeriods": 3,
    "historyCoverage": "full",
    "displayScale": "thousands_when_large",
    "negativeStyle": "parentheses"
  },
  "columns": ["2023", "2024", "2025"],
  "rows": [
    {
      "metric_code": "revenue_total",
      "label": "Total Revenue",
      "depth": 1,
      "row_kind": "metric",
      "unit": "USD",
      "values": [383285000000, 391035000000, 416161000000],
      "display_values": ["383,285,000", "391,035,000", "416,161,000"]
    }
  ],
  "footer": "Fiscal year ends in Sep 30 | USD"
}`;

export const curlExample = `curl "https://api.zedxe.com/v1/statements/AAPL?regime=sec_edgar&statement=income_statement&frequency=annual&format=normalized&periods=5" \\
  -H "Authorization: Bearer YOUR_SITE_TOKEN"`;

export const serverExample = `const response = await fetch(
  "https://api.zedxe.com/v1/statements/AAPL?regime=sec_edgar&statement=income_statement&frequency=annual&format=normalized",
  {
    headers: {
      Authorization: \`Bearer \${siteToken}\`
    },
    cache: "no-store"
  }
);

const payload = await response.json();
const plan = response.headers.get("x-zapi-plan");
const remaining = response.headers.get("x-ratelimit-remaining");`;

export const responseHeaders = [
    {
        name: "x-zapi-plan",
        note: "Resolved plan id for the current request.",
    },
    {
        name: "x-ratelimit-limit",
        note: "Current hourly cap for the active plan.",
    },
    {
        name: "x-ratelimit-remaining",
        note: "Requests remaining in the current rolling hour bucket.",
    },
    {
        name: "x-ratelimit-reset",
        note: "ISO timestamp for the next quota reset.",
    },
];
