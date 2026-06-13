# Changelog — @shaleyeah/infrastructure-planner

## [Unreleased]

### Fixed

- **`executeLoop` halts on permanent failures + executeWithRetry + injectable callLLM** (#427) — Added `executeWithRetry` with 3-attempt exponential backoff, permanent halt guard (`!execResult.retryable`), model routing via `reasoningModel`, and `callLLM?` injectable option. Matching the geologist Level 2 reference. 2 new contract tests.

### Added

- **Step B: Tier 2 agent implementation** (#375) — Full infrastructure-planner agent replacing the stub:
  - `src/agent/infrastructure-client.ts` — MCP HTTP client with Timeout Boundary, Recovery Guide, and Error Classification Arcade patterns
  - `src/agent/index.ts` — `infrastructurePlannerManifest` (4 tools), `infrastructurePlannerConfig` (port 3012), `createInfrastructurePlannerRuntime()`, `createInfrastructurePlannerEndpoint()`, `runInfrastructurePlannerTask()` (Layer 2 LLM execution loop)
  - `tests/mcp-client.test.ts` — 12 tests for Layer 1 client and Layer 2 runTask loop
  - `tests/agent.test.ts` — 31 contract tests: manifest/config validation, progressive discovery, model routing, HITL, evals, health endpoint, scope enforcement, blocking eval halt, invalid manifest rejection

## [0.1.0] — 2026-06-04

### Added

- Initial package stub created during monorepo conversion (#385)
