# Changelog — @shaleyeah/development-planner

## [Unreleased]

### Fixed

- **`executeLoop` permanent halt guard + injectable `callLLM`** (#425) — `else` branch now returns immediately when `execResult.retryable === false` (blocking evals, scope rejections), matching geologist Level 2 reference. Also wires `options.callLLM` injectable through to `executeLoop` so tests can drive the model without a real API key. Adds 2 contract tests verifying loop halt on permanent failure.

## [0.1.0] — 2026-06-10

### Added
- Implemented Tier 2 development-planner agent (Issue #373)
- `developmentPlannerManifest` — AgentManifest with 3 tools: `create_development_plan`, `estimate_project_timeline`, `monitor_development_progress`
- `developmentPlannerConfig` — AgentRuntimeConfig with port 3011, `DEVELOPMENT_MCP_URL` env var, autonomy="reviewed"
- `callDevelopmentTool` — MCP HTTP client with 30s timeout, RetryableToolError/PermanentToolError classification
- `runDevelopmentPlannerTask` — Layer 2 LLM-driven execution loop (MAX_STEPS=8, executeWithRetry with 3 retries at 500ms/1000ms/2000ms)
- `createDevelopmentPlannerRuntime` / `createDevelopmentPlannerEndpoint` — factory functions
- `tests/mcp-client.test.ts` — 12 tests: client exports, URL/transport, HITL gate, runTask API key validation
- `tests/agent.test.ts` — 42 tests: manifest validation, progressive discovery, model routing, HITL policy, evals, health endpoint
