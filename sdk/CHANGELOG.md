# Changelog — @shaleyeah/sdk

All notable changes to this package.

## [Unreleased]

### Documentation

- **Migration ownership** (#576) — linked SDK callers, public API compatibility,
  utility qualification limits and legacy execution-helper deletion gates from
  the README to the shared migration ledger. No runtime or export changes.

### Fixed

- **MCP tool schemas and genuine failures** (#677) — preserved full input/output schemas and discovery metadata through factory registration, emitted matching structured success/JSON text, removed the extra success-masking wrapper, preserved typed errors and recognized existing XOR/file/analysis failure records. Declared-success-schema failures retain JSON error text with `isError` for pinned generic-client compatibility. Existing raw-result compatibility and partial statuses remain; role schema/domain and access qualification are separate.

- **HTTP MCP session lifecycle** (#668) — replaced the shared stateful transport with independent protocol/transport instances, preserved tool/resource registrations, added bounded idle/request/capacity/body handling and DELETE/expiry/shutdown/restart cleanup. Real multi-client and lifecycle regressions include repeated-listener leak repair. Identity/authentication and result conformance remain #678/#677.

- **Fenced-JSON parser** (#571, CodeQL alert #51) — removed polynomial whitespace
  regexes in `runAgentTask` response parsing, preserved literal fence text in JSON
  values and added raw/fenced/large-response regressions. Updated ContextStore
  documentation to the portable lifecycle policy and optional retrieval adapters.

- **`LocalAgentRuntime.execute()` audits scope failures** (#403) — Scope rejections now call `this.audit()` before returning the `failed` result, so missing-scope events appear in the audit trail alongside HITL and eval failures.

### Added
- **Paginated Result — Arcade #31** (#450) — `PaginatedResult<T>` interface (with `data`, `cursor?`, `hasMore`, `totalCount?`), `encodeCursor(offset)`, `decodeCursor(cursor)`, and `paginateArray(items, options)` helper exported from `sdk/src/types.ts`. Cursor is a base64url-encoded numeric offset; `decodeCursor` returns `0` on any malformed input. `paginateArray` clamps `pageSize` to `[1, 100]`, defaults to `25`. 11 tests in `sdk/tests/paginated-result.test.ts`.
- **Identity Anchor — Arcade #35** (#449) — `SessionIdentity` interface (`userId`, `orgId`, `sessionId`, `roles`) added and exported. `AgentExecutionRequest` gains optional `identity` field. `AuditLogEntry` gains optional `userId` field. `LocalAgentRuntime.execute()` propagates identity to all audit call sites. `StandaloneToolHandlerContext` exposes `identity`. `MCPServer` now generates real UUIDs per session via `randomUUID()` (was `undefined`).
- **Dependency Hints — Arcade #14** (#448) — `AgentToolManifestSchema` gains optional `dependsOn: string[]` and `provides: string[]` fields on each tool entry. Non-breaking — tools without these fields are unchanged.
- **Tool Chain — Arcade #21** (#455) — `ToolChainSchema` exported from `@shaleyeah/sdk`. Optional `toolChains: ToolChain[]` field on `AgentManifestSchema`. Each `ToolChain` declares `id`, `description`, ordered `steps[]`, and optional `trigger` hint for the LLM. Non-breaking — manifests without `toolChains` are unchanged.
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
