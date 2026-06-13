# Changelog — @shaleyeah/economist

## [Unreleased]

### Added
- `runEconomistTask` Layer 2 execution loop — LLM-driven multi-step loop with Permission Gate via `runtime.execute()`, HITL throw when no callback provided, and max-steps synthesis (#364)
- `executeWithRetry` — exponential backoff (500ms/1s/2s, up to 3 retries) for retryable tool failures before surfacing error to LLM (#364)
- CLI entrypoint — `npx tsx src/agent/index.ts "<goal>"` runs a task directly from the shell (#364)
- `callEconobotTool` MCP HTTP client — delegates to `@shaleyeah/server-econobot` over HTTP transport (#364)
- `createEconomistRuntime` / `createEconomistEndpoint` factories (#364)

### Changed
- `modelRouting` dev defaults wired to real Anthropic model IDs (`claude-sonnet-4-6` for standard-analysis, `claude-opus-4-8` for deep-reasoning, `claude-haiku-4-5-20251001` for small-fast / local-private) — replaces `configured-by-operator` placeholders (#364)
- `executeLoop` resolves `reasoningModel` from `config.modelRouting["standard-analysis"]` and passes it to all `callLLM()` calls so BYOE overrides flow through (#364)

### Fixed
- **`executeLoop` halts on permanent failures** (#423) — The `else` branch previously appended a hint string and continued the loop when `execResult.retryable === false` (blocking evals, scope rejections, security gates). Now returns immediately with the error string, matching the geologist Level 2 reference. Adds 2 tests to `tests/agent.test.ts` covering blocking schema eval halt + error string assertion.
