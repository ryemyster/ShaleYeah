# Changelog — @shaleyeah/quality-assurance

## [Unreleased]

### Added
- **Initial package** (#376) — quality-assurance Tier 2 agent wrapping `@shaleyeah/server-qa` over MCP HTTP transport. Exports `qaAssuranceManifest`, `qaAssuranceConfig`, `createQAAssuranceRuntime()`, `createQAAssuranceEndpoint()`, and `callQAServerTool()`. Manifests 2 QA tools (`quality-assurance.run_quality_tests`, `quality-assurance.generate_quality_report`) with explicit model capability requirements, scopes, input schemas, and eval profiles. All tool handlers connect to qa-server via `StreamableHTTPClientTransport` at the URL in `AgentRuntimeConfig.mcpServers["qa-server"].url` (defaults to `http://localhost:3004`).

### Tests
- `tests/mcp-client.test.ts` — verifies `callQAServerTool` export, config wiring (URL, transport), all tools declare `mcpServer: "qa-server"`, and error propagation when qa-server is unreachable. Integration test for live MCP round-trip is skipped when qa-server is not running.
- `tests/agent.test.ts` — 37 contract tests covering manifest validation, progressive discovery, organization-owned model routing, HITL policy, evals, standalone boot, and invalid manifest rejection.
