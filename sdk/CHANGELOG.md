# Changelog — @shaleyeah/sdk

All notable changes to this package.

## [Unreleased]

### Fixed

- **`LocalAgentRuntime.execute()` audits scope failures** (#403) — Scope rejections now call `this.audit()` before returning the `failed` result, so missing-scope events appear in the audit trail alongside HITL and eval failures.

### Added
- **Mutual Exclusivity — Arcade #9** (#453) — new `sdk/src/mutual-exclusivity.ts` exports `checkMutualExclusivity(args, groups)` (returns error string or null) and `buildMutualExclusivityError(group, provided)` (returns `{error_type: "permanent", error, hint}`). `AgentToolManifestSchema` gains optional `mutuallyExclusive: string[][]` field for declaring XOR param groups in tool manifests. 10 unit tests in `sdk/tests/mutual-exclusivity.test.ts`.
- **Fallback Tool — Arcade #44** (#454) — `AgentToolManifestSchema` gains optional `fallbackTo: string` field. When a tool's `executeLoop` encounters a permanent failure (`retryable: false`), agents check this field and attempt the named fallback tool with the same args before surfacing an error. Successful fallback results are tagged `{ usedFallback: true, primaryTool }` in the conversation history.
- **HTTP transport mode for `MCPServer`** (#363) — `MCPServer` now selects `StreamableHTTPServerTransport` when the `PORT` env var is set at construction time, and falls back to `StdioServerTransport` otherwise. All 14 inheriting servers gain HTTP capability without any per-server code change. New public helpers: `isHttpMode()` and `httpPort()`. `initialize()` starts the Node.js HTTP server and binds on the configured port; `stop()` closes it cleanly.

## [0.1.0] — 2026-06-04

### Added
- Initial package extraction from monorepo conversion (#385)
- `MCPServer` base class (from `src/shared/mcp-server.ts`)
- `LLMClient` shared Anthropic SDK wrapper (from `src/shared/llm-client.ts`)
- `ServerFactory` bootstrap helper (from `src/shared/server-factory.ts`)
- `AgentManifest`, `AgentRuntime`, `AgentService` contracts (from `src/agents/`)
- `FileIntegrationManager`, `FileFormatDetector`, `FileUtils` (from `src/shared/`)
- Parser suite: LAS, Excel, GIS, SEGY (from `src/shared/parsers/`)
- Domain types: geological, economic, risk, market, investment (from `src/shared/types.ts`)
