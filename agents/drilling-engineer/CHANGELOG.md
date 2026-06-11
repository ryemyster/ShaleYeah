# Changelog — @shaleyeah/drilling-engineer

## [Unreleased]

## [0.1.0] — 2026-06-10

### Added
- Initial Tier 2 agent implementation — `drillingEngineerManifest`, `drillingEngineerConfig`, `runDrillingEngineerTask` (#374)
- `src/agent/drilling-client.ts` — MCP HTTP client with 30s timeout, RetryableToolError/PermanentToolError classification
- `src/agent/index.ts` — 3-tool manifest (`design_drilling_program`, `estimate_well_costs`, `assess_drilling_risks`), LocalAgentRuntime wiring, Layer 2 LLM execution loop
- `tests/mcp-client.test.ts` — 13 tests: HTTP client, Layer 2 runTask, SDK error exports, HITL gate
- `tests/agent.test.ts` — 34 contract tests: manifest validation, discovery, model routing, HITL, evals, scope enforcement, blocking eval halt
- Pairs with `servers/drilling` (default port 3003, `DRILLING_MCP_URL` env var)
