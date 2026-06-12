# Changelog — @shaleyeah/sdk

All notable changes to this package.

## [Unreleased]

### Fixed

- **`LocalAgentRuntime.execute()` audits scope failures** (#403) — Scope rejections now call `this.audit()` before returning the `failed` result, so missing-scope events appear in the audit trail alongside HITL and eval failures.

### Added
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
