# Stock Profile Page v2 Blueprint

## Goals
- Provide a structured Stock Profile page that is easy to connect to real providers.
- Keep styling minimal while defining clear data contracts and layout order.

## Section Order
1. **Header** – Company identity and key metadata.
2. **Chart** – TradingView advanced chart container keyed by the symbol.
3. **Tabs**
   - **Financials**
   - **Ratios**
   - **Earnings**
   - **Filings**

## Required Fields per Section
### Header
- Company name
- Ticker
- Exchange
- Sector / Industry
- Optional: website link, description snippet (Phase 2)

### Chart
- TradingView symbol string (e.g., `NASDAQ:AAPL`).
- Placeholder for chart configuration (Phase 2: multiple presets if needed).

### Financials Tab
- Annual financials (minimum 5 fiscal years): revenue, gross profit, operating income, net income, EPS, free cash flow where available.
- Quarterly financials: same fields as annual but labeled by fiscal period (e.g., `2024 Q1`).

### Ratios Tab
- Core valuation and solvency ratios: P/E, P/B, P/S, EV/EBITDA, Debt/Equity, Current Ratio, Dividend Yield.
- Grouped presentation (valuation vs. balance-sheet strength).

### Earnings Tab
- Latest quarterly earnings: period, reported EPS, consensus EPS, surprise (absolute and %), revenue.
- Latest annual summary: fiscal year, EPS, revenue, YoY % where available.

### Filings Tab
- Latest 10-Q: form type, filing date, period end, SEC URL.
- Latest 10-K: same fields as above.
- Recent filings list (at least 5 if available) with type, date, and link.

### Presentation (Optional)
- Latest investor deck link with title and published date.
- Phase 2 visual card if time allows.

## MVP Now vs. Phase 2 Later
- **MVP Now**
  - Typed view model covering all sections above.
  - Mocked data returned from a server-side aggregator.
  - Page renders header, chart container, and tab skeletons using the typed model.
  - Basic empty/error states that do not crash the page.
- **Phase 2 Later**
  - Enhanced visual presentation (charts/cards), richer formatting.
  - Real provider wiring (Finnhub, SEC, OpenBB, etc.).
  - Better loaders, pagination for filings, and downloadable resources.

## API / Source Mapping Placeholders
- **Company profile**: Finnhub `/stock/profile2` or OpenBB Fundamentals.
- **Chart symbol**: TradingView-compatible ticker derived from profile or symbol lookup.
- **Financials**: Finnhub `/stock/financials-reported`, OpenBB `equity.fundamental`, or SEC XBRL parsing.
- **Ratios**: Finnhub `/stock/metric`, OpenBB `equity.fundamental.ratios`.
- **Earnings**: Finnhub `/stock/earnings` or `/calendar/earnings`, OpenBB earnings endpoints.
- **Filings**: SEC EDGAR search + document links, Finnhub `/stock/filings`.
- **Presentation**: Manual upload / OpenBB IR deck scraper (if available).

## Notes
- Keep the layout lightweight and incremental; avoid heavy styling until Phase 2.
- Favor resilience: if a section lacks data, show a simple "No data" message instead of failing.
