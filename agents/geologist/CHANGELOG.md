# Changelog — @shaleyeah/geologist

## [Unreleased]

### Changed
- **Layer 1 (MCP wiring):** Removed direct `@shaleyeah/server-geowiz` TypeScript imports; all 8 handlers now delegate to the geowiz Tier 1 server over HTTP via `@modelcontextprotocol/sdk` (`callGeowizTool`). Validates production deployment topology where server and agent run on separate hosts (#363).
- **Layer 2 (execution loop):** `runGeologistTask(goal, options)` now routes all tool calls through `LocalAgentRuntime.execute()` — the HITL gate, scope checks, and audit logging fire on every step (Arcade pattern #46: Permission Gate). Previously called `callGeowizTool` directly, bypassing governance (#363).
- `runGeologistTask` accepts `runtime?: LocalAgentRuntime` (caller-managed lifecycle) and `onApprovalRequired?: (challenge) => Promise<HumanApproval>` (HITL callback). Throws with a clear message when `approval_required` and no callback is provided.
- `geowiz-client.ts` (`callGeowizTool`) now classifies errors: network failures → `RetryableToolError`; all others → `PermanentToolError`. The `retryable` flag propagates to `AgentExecutionResult` so the loop can give the LLM a correct retryability hint.
- Replaced `"@shaleyeah/server-geowiz": "workspace:*"` dep with `"@modelcontextprotocol/sdk": "^1.29.0"` in `package.json`.
- Updated `agent.test.ts` to guard `execute()`-based tests with a live-server reachability check.

### Added
- `src/agent/geowiz-client.ts` — thin one-shot MCP client with `Promise.race()` timeout (Arcade #28: Timeout Boundary) and error classification (Arcade #40).
- `tests/mcp-client.test.ts` — TDD tests for `callGeowizTool` (Layer 1), `runGeologistTask` (Layer 2), SDK error exports, and HITL gate behavior (12 tests).
- Deferred stubs with GitHub issue references: `#395` (Context Injection / pgvector memory) and `#396` (Async Job / seismic polling).

## [0.1.0] — 2026-06-04

### Added
- Initial package extraction from monorepo conversion (#385)
- Migrated from `src/agents/geologist.ts`
- Standalone AgentRuntime with isolated config, context, and MCP tools (#363)
