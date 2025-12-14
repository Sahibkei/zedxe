# Stock Profile V2 Specification

## A. Context & Goals
- Deliver a richer stock profile with 5+ years of annual financial statements and TradingView-powered charting.
- Include a detailed business profile with fundamentals, ratios, and qualitative context.
- Surface latest quarterly and annual earnings summaries to keep recency in focus.
- Provide access to key filings and presentation materials (e.g., latest 10-Q and earnings deck) for deeper diligence.
- Keep the contract stable so UI redesign work can proceed without waiting on data decisions.

## B. IA / Page Layout (wireframe-level)
1. **Header summary**: Symbol, company name, price, change, change %, market cap, currency, primary exchange, data freshness badge.
2. **TradingView chart section**: Main price chart with range selector, overlays, and a compact stats strip (volume, 52w range, average volume, beta placeholder).
3. **Tabs / Sections**:
   - **Company Profile**: Business overview, sector/industry, employees, headquarters, website, description, CEO.
   - **Financial Statements**: Annual (>=5 years) Income Statement / Balance Sheet / Cash Flow; optional quarterly (>=8 quarters) toggle.
   - **Ratios**: Grouped by valuation, profitability, leverage, and liquidity with last 5 fiscal years where available.
   - **Earnings**: Latest quarterly summary (EPS actual vs. estimate, revenue, surprise) and latest annual summary with YoY deltas.
   - **Filings & Docs**: Latest 10-Q link/embed, latest 10-K if available, and earnings presentation deck link/preview (with thumbnail fallback).
4. **Action bar (fixed)**: Watchlist toggle and alert entry; reuses existing alert/watchlist flows.

## C. Component Inventory
- **HeaderSummary**: Displays quote, change, key stats, and metadata; shows data quality warnings when fields missing or stale.
- **TradingViewChartPanel**: Embeds TradingView chart plus stats strip; handles symbol changes without remounting.
- **CompanyProfilePanel**: Renders business overview details with external links (website, headquarters map link placeholder).
- **FinancialStatementsPanel**: Switchable annual/quarterly views for IS/BS/CF with per-period metadata (fiscal year/quarter, currency, source).
- **RatiosPanel**: Presents grouped ratio cards with trend indicators and missing-data badges.
- **EarningsPanel**: Shows latest quarterly + latest annual summaries with EPS/revenue figures, surprises, and YoY changes.
- **FilingsPanel**: Links/previews to latest 10-Q, latest 10-K (optional), and presentation deck; handles unavailable assets gracefully.
- **MetaFooter**: Displays data sources, last updated timestamp, and quality flags.

## D. Data Contract Matrix
- **HeaderSummary**
  - Required: `symbol` (string), `companyName` (string), `price` (number), `currency` (string), `exchange` (string), `asOf` (ISO datetime).
  - Optional: `change` (number), `changePercent` (number), `marketCap` (number), `volume` (number), `beta` (number), `fiftyTwoWeekHigh/Low` (numbers).
  - Source: Primary quote provider (e.g., Finnhub/TradingView); fallback to cached snapshot.
  - Caching: 60s for intraday; longer (15m) for reference stats.
  - Empty/Error: Show placeholder with data quality badge; disable price-dependent actions when missing.

- **TradingViewChartPanel**
  - Required: `symbol`, `currency`, `exchange`.
  - Optional: `rangeDefaults`, `studies`.
  - Source: TradingView embed config.
  - Caching: N/A (client embed).
  - Empty/Error: Show embed error state; link to open TradingView directly.

- **CompanyProfilePanel**
  - Required: `companyName`, `sector`, `industry`, `description` (allow empty string), `employees` (number | null), `website`, `headquarters` (city/state/country), `ceo` (string | null).
  - Source: Company profile API (e.g., Finnhub profile2) with fallback to last cached snapshot.
  - Caching: 24h.
  - Empty/Error: Label unknown fields; keep section visible.

- **FinancialStatementsPanel**
  - Required: Annual IS/BS/CF arrays for last 5 fiscal years; each entry includes `fiscalYear`, `currency`, `periodEnd`, `source`, and numeric fields (nullable when not reported).
  - Optional: Quarterly IS/BS/CF (last 8 quarters minimum when available).
  - Source: Statements API (e.g., financials/financials-reported) or internal cache.
  - Caching: 24h with per-symbol cache key.
  - Empty/Error: Show “Data unavailable” with retry affordance; allow CSV download only when populated.

- **RatiosPanel**
  - Required: Grouped ratio arrays (valuation, profitability, leverage, liquidity) keyed by fiscalYear.
  - Source: Ratios API or computed from statements; fallback to prior year values with badge.
  - Caching: 24h.
  - Empty/Error: Show missing badge per metric; keep layout stable.

- **EarningsPanel**
  - Required: `latestQuarter` and `latestAnnual` summaries with `period`, `fiscalYear`, `epsActual`, `epsEstimate`, `revenue`, `surprisePercent` (nullable if not guided), `currency`.
  - Source: Earnings calendar/actuals API; fallback to statement-derived EPS when necessary.
  - Caching: 6h for latest quarter; 24h for annual.
  - Empty/Error: Show “No recent earnings” and keep historical toggle disabled.

- **FilingsPanel**
  - Required: `latest10Q` (url, filingDate); Optional: `latest10K`.
  - Presentation deck optional with thumbnail.
  - Source: SEC/filings feed; deck from investor relations or cached upload.
  - Caching: 24h.
  - Empty/Error: Show link to EDGAR search and placeholder deck card.

- **MetaFooter**
  - Required: `lastUpdated`, `dataQuality` flags (per component), `sources` list.
  - Caching: mirrors slowest component (24h).

## E. Acceptance Criteria
- Contract covers all IA components with explicit required/optional fields and types.
- Annual statements guarantee >=5 years coverage; quarterly marked optional with clear nullability.
- Ratios grouped and typed; earnings includes latest quarter and latest annual summaries.
- Filings include at least latest 10-Q link; deck contract defined even if data missing.
- Spec documents current-state implementation and highlights gaps for V2.

## F. Open Questions / Decisions Needed
- Preferred filings source (SEC directly vs. upstream provider) and caching approach.
- Strategy for obtaining/hosting earnings presentation decks when not available via API.
- Whether to compute ratios internally vs. rely on upstream API data.
- Currency normalization rules when statements/ratios use differing currencies.
- Handling of ADRs/foreign listings where TradingView symbol differs from API symbol.

## G. Out of Scope
- Visual redesign or layout changes in this step.
- New API integrations or key management changes.
- Altering existing routes or production behavior.
- Historical earnings charting or KPI visualizations (future step).

## Current State
- Route: `app/(root)/stocks/[symbol]/page.tsx` embeds multiple TradingView widgets (symbol info, advanced chart, baseline chart, technical analysis, company profile, financials) and renders an action bar for watchlist/alerts.
- Data fetches: server-side `getSymbolSnapshot(symbol)` from `lib/actions/finnhub.actions` provides company name, current price, change %, and market cap; watchlist status via `isSymbolInWatchlist`; alerts via `getAlertsByUser`.
- No in-house financial statements, ratios, earnings, or filings data; these are currently provided only through TradingView embeds without structured contracts.
- Actions: watchlist and alert creation/editing handled client-side via `StockActionBar` leveraging `WatchlistButton` and `AlertModal` components.
