# Changelog — @shaleyeah/server-market

## [Unreleased]

### Changed

- Preserve dated, unit-checked EIA observations or explicit unavailability;
  retain partial success, zero/negative prices and observation/retrieval separation.
  Cache entries are private to current credentials and survive unrelated older
  in-flight requests without being overwritten or cleared. Private volatile key
  handles replace credential digests; clearing invalidates in-flight work even
  when the key stays the same. (#708)
- Read competitor observations and explicit reviewed assumptions from an owned
  private host source file. Strict advisory model output cannot write factual
  metric fields or grant commercial authority; changed/denied sources invalidate
  prior interpretation. (#708)
- Delete name-length production/cost/share estimates, fixed-price and narrative
  fallbacks, unsupported forecasts/volatility/confidence, and tests requiring
  those fabricated values. Keep the two public tool names and shared `callLLM`
  wiring. Package-local offline behavioral tests enforce 90% line coverage. (#708)
- Explicit advisory exports create new private files and reject existing paths
  and symlinks. Update source, setup, integration and support documentation. (#708)

## [0.1.0] — 2026-06-04

### Added
- Initial package extraction from monorepo conversion (#385)
- Migrated from `src/servers/market.ts`
