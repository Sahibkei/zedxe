# Stock Profile V2 Contract

This module defines the TypeScript contract for the redesigned Stock Profile V2 experience. It is intentionally data-first so UI teams can build against stable shapes before wiring live data.

## Files
- `contract/types.ts` — Source of truth for the StockProfileV2 payload and all component-level subtypes.
- `contract/mock.ts` — Deterministic mock payload generator to unblock UI prototyping without external calls.

## How to use
- Import `StockProfileV2` (or narrower interfaces) when typing loaders, server actions, or client hooks.
- Use `makeMockStockProfileV2(symbol)` inside storybook mocks, fixtures, or development routes to render the upcoming UI skeleton.
- Keep nullability consistent: fields marked optional or `| null` represent truly missing data from upstream providers.

## Extending the contract
- Add new fields in `types.ts` with clear nullability and source notes; prefer explicit categories over catch-all dictionaries.
- When adding a field, update `StockProfileV2` so downstream consumers break loudly if they miss the change.
- Extend the mock in `mock.ts` with realistic placeholder values to preserve parity with the contract.

## Expected data sources (placeholders)
- Quotes/metadata: existing Finnhub snapshot or equivalent intraday provider.
- Company profile: Finnhub profile2 or similar business profile endpoint.
- Financials/ratios/earnings: financials-reported/ratios APIs or internally computed metrics.
- Filings & decks: SEC EDGAR feed plus investor relations assets for presentation decks.

## Consumption guidance for upcoming UI
- Each UI section (header, chart, company profile, statements, ratios, earnings, filings) should read directly from the contract shape without reaching into provider-specific responses.
- Cache strategy and freshness badges should rely on the `meta` block and per-section `dataQuality` flags.
- Keep components defensive: display placeholders for optional/nullable fields while preserving layout stability.
