# Changelog — @shaleyeah/legal-analyst

## [Unreleased]

### Fixed

- **`executeLoop` halts on permanent failures + injectable callLLM** (#428) — Added permanent halt guard (`!execResult.retryable`), `callLLM?` injectable option, throw guard for missing `standard-analysis` model route, and threaded `callLLMFn` through both LLM call sites. Matching the geologist Level 2 reference. 2 new contract tests.

## [0.1.0] — 2026-06-10

### Added
- Tier 2 legal analyst agent with `runLegalAnalystTask` Layer 2 execution loop (#370)
- `legalAnalystManifest` — 3 tools: `analyze_legal_framework`, `review_contract`, `assess_compliance`
- `legalAnalystConfig` — runtime config with HITL gate, evals, model routing, legal MCP server at port 3006
- `callLegalTool` — MCP HTTP client with 30s timeout, retryable/permanent error classification (Arcade #28, #39, #40)
- `createLegalAnalystRuntime` / `createLegalAnalystEndpoint` factory functions
- `agents/legal-analyst/tests/mcp-client.test.ts` — 12 tests (Layer 1 + Layer 2 wiring)
- `agents/legal-analyst/tests/agent.test.ts` — 41 contract tests (manifest, HITL, discovery, evals, health)
