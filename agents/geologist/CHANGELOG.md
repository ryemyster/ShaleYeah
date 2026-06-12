# Changelog — @shaleyeah/geologist

## [Unreleased]

### Added
- **`geologist.save_finding` write tool** (#407) — closes the Learn loop. Persists key findings to `./data/geowiz/findings/<id>.json` via the geowiz server. Declared as `type: "command"`, `requiresHumanApproval: true`, scope `write:geology`. Wired through `executeWithRetry` + `LocalAgentRuntime.execute()` — HITL gate fires on every persist call. This completes the fifth agent component (Memory) in the Goal/Perception/Reasoning/Action/Memory framework.
- **`executeWithRetry()` exponential backoff** (#406) — wraps every tool call in the `executeLoop`. Retries up to `MAX_TOOL_RETRIES=3` times on `RetryableToolError` with delays of 500ms, 1000ms, 2000ms. `PermanentToolError` and non-retryable failures surface immediately. All tool calls in the loop now go through this wrapper instead of calling `runtime.execute()` directly.

### Changed
- **Scope enforcement activated** (#403) — `runGeologistTask` passes `grantedScopes` from the caller down to `runtime.execute()`. `LocalAgentRuntime.execute()` (SDK) now checks `tool.requiredScopes ⊆ grantedScopes` when `grantedScopes` is provided; returns `status: "failed"` with a clear error naming the missing scopes. Backward-compatible: omitting `grantedScopes` skips enforcement.
- **Blocking eval halt** (#404) — `LocalAgentRuntime.execute()` (SDK) now checks for `blocking: true && status: "fail"` after `evaluate()`. When found, returns `status: "failed", retryable: false` with the blocking eval name and message — previously the call returned `status: "completed"` even if a blocking eval failed. `executeLoop` now returns immediately on any permanent (non-retryable) failure instead of pushing the error to history and continuing — safety gates (blocking evals, scope rejections) now actually halt the task. Adds tests for `redactSecrets` blocking on `sk-` output and advisory schema completing with warn.
- **Model routing wired to `callLLM`** (#402) — `executeLoop` now resolves `config.modelRouting["standard-analysis"].model` and passes it to every `callLLM()` invocation. Previously the loop called `callLLM` without a model parameter, falling back to the SDK's hardcoded default. BYOE operators can now fully override the reasoning model without touching agent code.
- **`geologistConfig.modelRouting` ships with real dev defaults** (#402) — replaced `"configured-by-operator"` placeholder strings with actual Anthropic model IDs (`claude-haiku-4-5-20251001`, `claude-sonnet-4-6`, `claude-opus-4-8`). `deterministic` uses `provider: "rule-based"` as before. Operators override at deploy time via config injection.
- **Manifest `requiredScopes` updated** — added `write:geology` to satisfy the Zod schema refine (manifest scopes must be a superset of all tool scopes).
- **Docs fully updated** — `ARCHITECTURE.md`, `HOW_IT_WORKS.md`, `DEPLOYMENT.md`, `INTEGRATION.md` all updated to reflect the five-component agent framework, new tool inventory (9 tools), model routing table, retry behavior, scope requirements, and findings storage path.

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
