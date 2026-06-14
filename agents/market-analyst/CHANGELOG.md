# Changelog — @shaleyeah/market-analyst

## [Unreleased]

### Added
- `runMarketAnalystTask` Layer 2 execution loop — LLM-driven multi-step loop with Permission Gate via `runtime.execute()`, HITL throw when no callback provided, and max-steps synthesis (#440)
- `executeWithRetry` — exponential backoff (500ms/1s/2s, up to 3 retries) for retryable tool failures before surfacing error to LLM (#440)
- **Permanent halt guard** — `executeLoop` returns immediately when `execResult.retryable === false` (blocking evals, scope rejections, security gates); does not continue to next LLM step (#440)
- 2 market tools: `market-analyst.analyze_market_conditions`, `market-analyst.competitive_analysis` — all wired to `@shaleyeah/server-market` over HTTP (port 3007) (#440)
- `callMarketTool` MCP HTTP client — delegates to `@shaleyeah/server-market` over HTTP transport (#440)
- `createMarketAnalystRuntime` / `createMarketAnalystEndpoint` factories (#440)
- `marketAnalystManifest` + `marketAnalystConfig` — full Arcade-compliant manifest with HITL, evals (schema: blocking, redactSecrets: blocking), memory namespace, and model routing (#440)
- 51 tests: full contract suite (manifest validation, progressive discovery, model routing, HITL policy, evals, health endpoint, permanent halt) + MCP client tests (#440)
