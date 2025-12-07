# Portfolio Performance & Chart Model – Current Implementation

## 1) High-level data flow (DB → services → frontend → chart)
- **Portfolio page**: `app/(root)/portfolio/page.tsx` loads user portfolios, initial summary, and an initial performance series via server actions.
- **Client container**: `components/portfolio/PortfolioPageClient.tsx` owns state for the selected portfolio, summary, and performance range/series. It invokes server actions (`getPortfolioPerformanceAction`, `getPortfolioSummaryAction`, `getUserPortfoliosAction`) to refresh data when the user switches portfolios or ranges.
- **Chart presentation**: `components/portfolio/PortfolioPerformanceChart.tsx` renders the line chart with Recharts. It expects `PortfolioPerformancePoint[]` data and shows a placeholder when the series has fewer than 2 points.
- **Server actions**: `lib/portfolio/actions.ts` authenticate the user and call service functions. `getPortfolioPerformanceAction` delegates to `getPortfolioPerformanceSeries`, returning `{ success, points }` for the client.
- **Services**: `lib/portfolio/portfolio-service.ts` provides portfolio queries and analytics:
  - `getPortfolioPerformanceSeries` builds the time series.
  - `getPortfolioSummary`, `getPortfolioRatios`, and helpers (`fetchDailyCloses`, `findLastKnownClose`, etc.) supply holdings, valuations, prices, and FX.
- **Data sources**: MongoDB `Portfolio` and `Transaction` collections supply metadata and trades. Finnhub daily candle API provides historical closes. FX rates come from `lib/finnhub/fx` via `getFxRate`.

## 2) Key types and their roles
- **PortfolioPerformancePoint** (`lib/portfolio/portfolio-service.ts`)
  - `{ date: string; value: number }` where `date` is `YYYY-MM-DD` UTC and `value` is the portfolio’s mark-to-market value in base currency for that day.
  - Currently only `value` is produced; placeholders like invested capital or unrealized PnL are not part of this shape.
- **PortfolioPerformanceRange**: union `'1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'YTD' | 'MAX'`; used by actions, service, and chart controls.
- **PerformancePoint** (`lib/portfolio/metrics.ts`): `{ date: string; value: number }` reused for benchmark alignment and ratio calculations.
- **PortfolioSummary/PositionSummary/PortfolioTotals** (`lib/portfolio/portfolio-service.ts`): provide snapshot holdings and totals for the overview cards, not directly used by the chart but reused for fallback series.

## 3) Range semantics
- `getRangeStartDate(range, today)` computes the start date relative to the current UTC day:
  - 1D: today - 1 day; 1W: -6 days; 1M: -29 days; 3M: -89 days; 6M: -179 days; 1Y: -364 days.
  - YTD: first day of the current UTC year.
  - MAX: no offset; start is handled later.
- Dates are normalized to UTC midnight (`startOfDay`) and formatted as `YYYY-MM-DD`.
- `buildDateStrings(start, end)` produces a **continuous daily array** from the (clamped) start to today, inclusive. There is exactly one point per calendar day.
- For non-MAX ranges, the start date is **clamped** to the earliest active trade date so the series does not predate holdings. For MAX, the earliest active trade date is used directly.

## 4) Holdings derivation
- All transactions for the portfolio are loaded in trade-date order and aggregated **only into current net holdings**:
  - BUY adds to quantity; SELL subtracts.
  - Per symbol, the service tracks `netQuantity`, `tradeCurrency`, and `earliestTradeDate` (UTC start-of-day of first trade).
  - Holdings with `netQuantity > 0` are retained; closed symbols are dropped entirely.
- No per-day quantity timeline exists: **historical valuation uses today’s net holdings across all past dates**.

## 5) Price loading and shaping
- `fetchDailyCloses` calls Finnhub `/stock/candle` with `resolution=D` over the full date window and maps `t`/`c` arrays to `{ [dateStr]: close }` keyed by normalized UTC date.
- `fetchPricesForSymbols` builds `symbolPrices[symbol][date] = close` for each active symbol. Missing data yields empty maps but symbols are still processed.
- `getPortfolioSummary` separately fetches live `getSnapshotsForSymbols` for overview cards; the performance series relies solely on daily candles.

## 6) Daily valuation algorithm (getPortfolioPerformanceSeries)
1. Identify active holdings as above; if none, return an empty series.
2. Compute the date range (clamped to earliest trade) and prepare `dateStrings` for every day to today.
3. Collect distinct trade currencies (plus base) and load FX via `getFxRatesForCurrencies`; unknown or missing rates default to `1` (base assumed).
4. Load daily close maps per symbol across the date window.
5. For each date:
   - For each holding, pick the close from `symbolPrices[symbol][date]` or **forward-fill** via `findLastKnownClose` scanning backward through `dateStrings` with no lookback limit.
   - Apply FX: if holding trade currency equals base, use `1`; otherwise `fxRates[currency] ?? 1`.
   - Accumulate `portfolioValue += netQuantity * close * fxRate`.
   - Emit `{ date, value: portfolioValue }`.
6. If **all** computed values are zero and `allowFallbackFlatSeries` (default true) is enabled, fetch `getPortfolioSummary` and return a **flat series** at `totals.currentValue` for every date to give the chart two or more points.

## 7) FX handling (current behavior)
- FX rates are fetched once per range via `getFxRatesForCurrencies`; base currency is forced to rate `1`.
- For holdings with non-base trade currency, the service uses the fetched rate if available; otherwise defaults to `1` (effectively treating the price as base currency).
- No historical FX curves: one static rate applies to every date.

## 8) Placeholders / technical debt
- `PortfolioPerformancePoint` only carries `value`; invested capital and unrealized PnL are not computed (assumed `0` elsewhere).
- Holdings are **end-of-period net** quantities applied to all past dates, so historical composition changes are not reflected.
- Forward-fill uses unlimited lookback; symbols with sparse data can carry stale closes far back in time.
- The zero-value filter does not drop points; instead a flat series fallback may be returned, potentially masking missing prices/FX.
- FX defaults to `1` when unavailable, potentially overstating valuations.

## 9) Frontend rendering and empty-state rules
- The chart uses `PortfolioPerformanceChart` with `LineChart` keyed on `value`.
- The “Not enough data to render a chart yet” message shows when `chartData.length < 2` (after mapping values to numbers).
- Because the backend can emit a flat series (all dates at current value), the frontend typically receives >= 2 points, bypassing the empty-state unless holdings/prices are missing and no fallback is used.

