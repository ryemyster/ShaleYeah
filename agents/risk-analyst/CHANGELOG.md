# Changelog — @shaleyeah/risk-analyst

## [Unreleased]

### Added
- `runRiskAnalystTask` Layer 2 execution loop — LLM-driven multi-step loop with Permission Gate via `runtime.execute()`, HITL throw when no callback provided, and max-steps synthesis (#443)
- `executeWithRetry` — exponential backoff (500ms/1s/2s, up to 3 retries) for retryable tool failures before surfacing error to LLM (#443)
- **Permanent halt guard** — `executeLoop` returns immediately when `execResult.retryable === false` (blocking evals, scope rejections, security gates); does not continue to next LLM step (#443)
- 2 risk tools: `risk-analyst.assess_investment_risk`, `risk-analyst.monte_carlo_simulation` — all wired to `@shaleyeah/server-risk-analysis` over HTTP (port 3005) (#443)
- `callRiskAnalysisTool` MCP HTTP client — delegates to `@shaleyeah/server-risk-analysis` over HTTP transport (#443)
- `createRiskAnalystRuntime` / `createRiskAnalystEndpoint` factories (#443)
- `riskAnalystManifest` + `riskAnalystConfig` — full Arcade-compliant manifest with HITL, evals (schema: blocking, redactSecrets: blocking), memory namespace, and model routing (#443)
- 51 tests: full contract suite (manifest validation, progressive discovery, model routing, HITL policy, evals, health endpoint, permanent halt) + MCP client tests (#443)
