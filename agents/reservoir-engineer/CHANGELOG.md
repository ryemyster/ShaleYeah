# Changelog — @shaleyeah/reservoir-engineer

## [Unreleased]

### Added
- `runReservoirEngineerTask` Layer 2 execution loop — LLM-driven multi-step loop with Permission Gate via `runtime.execute()`, HITL throw when no callback provided, and max-steps synthesis (#442)
- `executeWithRetry` — exponential backoff (500ms/1s/2s, up to 3 retries) for retryable tool failures before surfacing error to LLM (#442)
- **Permanent halt guard** — `executeLoop` returns immediately when `execResult.retryable === false` (blocking evals, scope rejections, security gates); does not continue to next LLM step (#442)
- 4 curve-smith tools: `reservoir-engineer.analyze_decline_curve`, `reservoir-engineer.generate_type_curve`, `reservoir-engineer.calculate_eur`, `reservoir-engineer.assess_curve_quality` — all wired to `@shaleyeah/server-curve-smith` over HTTP (port 3004) (#442)
- `callCurveSmithTool` MCP HTTP client — delegates to `@shaleyeah/server-curve-smith` over HTTP transport (#442)
- `createReservoirEngineerRuntime` / `createReservoirEngineerEndpoint` factories (#442)
- `reservoirEngineerManifest` + `reservoirEngineerConfig` — full Arcade-compliant manifest with HITL, evals (schema: blocking, redactSecrets: blocking), memory namespace, and model routing including `deterministic` route for EUR calculation (#442)
- 55 tests: full contract suite (manifest validation, progressive discovery, model routing, HITL policy, evals, health endpoint, permanent halt) + MCP client tests (#442)
