# Changelog — @shaleyeah/quality-assurance

## [Unreleased]

### Added
- **Initial package** (#376) — quality-assurance Tier 2 agent wrapping `@shaleyeah/server-qa` over MCP HTTP transport. Exports `qaAssuranceManifest`, `qaAssuranceConfig`, `createQAAssuranceRuntime()`, `createQAAssuranceEndpoint()`, and `callQAServerTool()`. Manifests 2 QA tools (`quality-assurance.run_quality_tests`, `quality-assurance.generate_quality_report`) with explicit model capability requirements, scopes, input schemas, and eval profiles. All tool handlers connect to qa-server via `StreamableHTTPClientTransport` at the URL in `AgentRuntimeConfig.mcpServers["qa-server"].url` (defaults to `http://localhost:3004`).

- **Layer 2 execution loop** (#376) — `runQAAssuranceTask(goal, options)` drives a multi-step QA task via the LLM. Accepts a natural-language goal, reasons about which qa-server tools to call, routes every tool call through `LocalAgentRuntime.execute()` (Permission Gate — HITL + scope checks fire on every step), and returns a synthesized answer. Accepts `runtime?: LocalAgentRuntime` (caller-managed lifecycle) and `onApprovalRequired?: (challenge) => Promise<HumanApproval>` (HITL callback). Throws with a clear message when `approval_required` and no callback provided. Deferred: Context Injection (#395), Async Job (#396).

### Changed

- **Model routing wired into `callLLM`** (#402) — `executeLoop` now resolves `config.modelRouting["standard-analysis"].model` and passes it to every `callLLM()` call. Previously the loop omitted the `model` parameter. Adds a throw guard when `standard-analysis` is absent. `qaAssuranceConfig` dev defaults replaced `"configured-by-operator"` placeholder strings with real Anthropic model IDs.
- **Injectable `callLLM` option on `runQAAssuranceTask`** (#402) — `options.callLLM?: (opts: LLMCallOptions) => Promise<string>` allows tests to capture the resolved model without real API calls.

### Tests
- `tests/mcp-client.test.ts` — verifies `callQAServerTool` export, config wiring (URL, transport), all tools declare `mcpServer: "qa-server"`, and error propagation when qa-server is unreachable. Layer 2 tests added: `runQAAssuranceTask` export, no-API-key throw, callLLM path via invalid key (auth error), SDK error class exports, runtime option signature, and HITL throw when `approvalMode: "always"` and no callback. Integration test for live MCP round-trip is skipped when qa-server is not running.
- `tests/agent.test.ts` — 37 contract tests covering manifest validation, progressive discovery, organization-owned model routing, HITL policy, evals, standalone boot, and invalid manifest rejection.
