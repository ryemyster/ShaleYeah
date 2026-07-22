# Changelog — @shaleyeah/investment-chair

## [Unreleased]

### Changed

- **Investment Chair ADK migration and adapter retirement** (#539) — Converted this package into a package-local ADK/Python project, added Python MCP wrappers and eval/pytest coverage for all current Decision tools, documented the Stand-alone + Skills architecture mode and investment governance HITL deferral boundary, and removed the legacy TypeScript agent surface. `servers/decision` remains the TypeScript/pnpm MCP backend.

### Added

- `runInvestmentChairTask` Layer 2 execution loop — LLM-driven multi-step loop with Permission Gate via `runtime.execute()`, HITL throw when no callback provided, and max-steps synthesis (#439)
- `executeWithRetry` — exponential backoff (500ms/1s/2s, up to 3 retries) for retryable tool failures before surfacing error to LLM (#439)
- **Permanent halt guard** — `executeLoop` returns immediately when `execResult.retryable === false` (blocking evals, scope rejections, security gates); does not continue to next LLM step (#439)
- 3 decision tools: `investment-chair.make_investment_decision`, `investment-chair.calculate_bid_strategy`, `investment-chair.analyze_portfolio_fit` — all wired to `@shaleyeah/server-decision` over HTTP (port 3013) (#439)
- `callDecisionTool` MCP HTTP client — delegates to `@shaleyeah/server-decision` over HTTP transport (#439)
- `createInvestmentChairRuntime` / `createInvestmentChairEndpoint` factories (#439)
- `investmentChairManifest` + `investmentChairConfig` — full Arcade-compliant manifest with HITL, evals (schema: blocking, redactSecrets: blocking), memory namespace, and model routing (#439)
- 55 tests: full contract suite (manifest validation, progressive discovery, model routing, HITL policy, evals, health endpoint, permanent halt) + MCP client tests (#439)
