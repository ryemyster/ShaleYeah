# Changelog — @shaleyeah/research-analyst

## [Unreleased]

### Fixed

- **`executeLoop` halts on permanent failures + injectable callLLM** (#429) — Added permanent halt guard (`!execResult.retryable`), `callLLM?` injectable option, throw guard for missing `standard-analysis` model route, and threaded `callLLMFn` through both LLM call sites. Matching the geologist Level 2 reference. 2 new contract tests.

### Added
- Full Tier 2 agent implementation for research/research-analyst pair (#369)
- `researchAnalystManifest` and `researchAnalystConfig` — manifest + runtime config wired to `servers/research` at port 3008
- `runResearchAnalystTask` — Layer 2 LLM execution loop with Permission Gate (Arcade #46), HITL, Timeout Boundary (#28), Error Classification (#40)
- `callResearchTool` — MCP HTTP client with retry + error classification
- `createResearchAnalystRuntime` / `createResearchAnalystEndpoint` — factory exports
- Tools: `research-analyst.conduct_market_research`, `research-analyst.analyze_competition`
- Contract tests: `tests/mcp-client.test.ts`, `tests/agent.test.ts`

## [0.1.0] — 2026-06-04

### Added
- Initial stub package from monorepo conversion (#385)
