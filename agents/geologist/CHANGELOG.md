# Changelog — @shaleyeah/geologist

## [Unreleased]

### Changed
- **MCP over HTTP transport** (#363) — handlers no longer call `@shaleyeah/server-geowiz` directly. Each tool handler now connects to the geowiz Tier 1 server via `StreamableHTTPClientTransport` at the URL in `AgentRuntimeConfig.mcpServers.geowiz.url` (defaults to `http://localhost:3001`). New module: `src/agent/geowiz-client.ts` exports `callGeowizTool()`. Removed `@shaleyeah/server-geowiz` workspace dependency; added `@modelcontextprotocol/sdk` as a direct dependency.

### Tests
- `tests/mcp-client.test.ts` — verifies `callGeowizTool` export, config wiring, and error propagation when geowiz is unreachable. Integration test for live MCP round-trip is skipped when geowiz is not running.
- `tests/agent.test.ts` — updated routing, HITL, and eval sections to test config-level invariants rather than executing through the network.

## [0.1.0] — 2026-06-04

### Added
- Initial package extraction from monorepo conversion (#385)
- Migrated from `src/agents/geologist.ts`
- Standalone AgentRuntime with isolated config, context, and MCP tools (#363)
