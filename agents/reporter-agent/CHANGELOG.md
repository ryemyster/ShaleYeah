# Changelog — @shaleyeah/reporter-agent

## [Unreleased]

### Added
- `runReporterAgentTask` Layer 2 execution loop — LLM-driven multi-step loop with Permission Gate via `runtime.execute()`, HITL throw when no callback provided, and max-steps synthesis (#441)
- `executeWithRetry` — exponential backoff (500ms/1s/2s, up to 3 retries) for retryable tool failures before surfacing error to LLM (#441)
- **Permanent halt guard** — `executeLoop` returns immediately when `execResult.retryable === false` (blocking evals, scope rejections, security gates); does not continue to next LLM step (#441)
- 3 reporting tools: `reporter-agent.generate_investment_decision`, `reporter-agent.create_executive_report`, `reporter-agent.synthesize_analysis` — all wired to `@shaleyeah/server-reporter` over HTTP (port 3009) (#441)
- `callReporterTool` MCP HTTP client — delegates to `@shaleyeah/server-reporter` over HTTP transport (#441)
- `createReporterAgentRuntime` / `createReporterAgentEndpoint` factories (#441)
- `reporterAgentManifest` + `reporterAgentConfig` — full Arcade-compliant manifest with HITL, evals (schema: blocking, redactSecrets: blocking), memory namespace, and model routing (#441)
- 54 tests: full contract suite (manifest validation, progressive discovery, model routing, HITL policy, evals, health endpoint, permanent halt) + MCP client tests (#441)
