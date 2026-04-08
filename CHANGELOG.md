# Changelog

All notable changes to SHALE YEAH will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **Demo bypass removed** (`src/mcp-client.ts`) — `createExecutorFn()` no longer hardcodes `mode: "demo"` as the fallback default; production mode is now the default when no `currentRequest` is set. Demo mode remains valid but is explicitly opt-in via `mode: "demo"` on the `AnalysisRequest`. (closes #221)

### Security
- **Clear-text logging of sensitive field** (`tools/access-processor.ts`) — removed `hasPassword` from the summary object logged to stdout. The boolean indicated whether an Access database is password-protected and was flowing into `console.log(JSON.stringify(summary))`, triggering CodeQL `js/clear-text-logging` (CWE-532). The field is no longer needed in the CLI summary output. (fixes CodeQL alert #39)
- **CI/CD Supply Chain Hardening** — all GitHub Actions pinned to full commit SHAs (previously used mutable tags like `@v6`/`@v4`/`@v3`); added `permissions: contents: read` default to `ci.yml` and `demo.yml` to prevent over-privileged tokens on PR/push runs; added `environment: production` gate (requires reviewer approval) to `release` and `sign` jobs in `release.yml`; pinned SLSA generator to SHA; removed lint-suppression hacks (`|| echo ...`) from `ci.yml` and `release.yml`; renamed `gitleaks.yml` → `codeql.yml` to match its actual content (CodeQL, not Gitleaks)

### Added

- **Fixture Injection for Demo Mode** (`src/fixtures/demo-data.ts`, `src/demo-runner.ts`, `src/mcp-client.ts`) — deleted `generateMockAnalysis()` from `mcp-client.ts`; demo mode now passes static, deterministic fixture args to real server tool handlers rather than bypassing execution entirely. `src/fixtures/demo-data.ts` exports `DEMO_FIXTURE_ARGS` (typed fixture inputs for all 14 servers) and `DEMO_SERVER_NAMES`. The demo mode bypass branch (`request.mode === "demo"` → mock) is removed; `executeServerAnalysis()` always calls `client.callTool()`. `AnalysisRequest` gains optional `fixtureArgs` field so callers can inject server-specific args. `npm run demo` now exercises real code paths. `tests/demo.test.ts` updated to check model structure (not a specific NPV value) since real servers return deterministic data, not random mocks. 6 tests in `tests/demo-fixture-injection.test.ts`. (closes #225)

- **Agent OS Rearchitecture** (`src/kernel/executor.ts`, `src/kernel/index.ts`, `src/kernel/bundles.ts`, `src/kernel/types.ts`) — all five structural gaps in the kernel are now implemented and verified: (1) `storeResult()` called inside `executeBundle()` after every successful step; (2) `_context` (including `availableResults`) injected into each tool's args; (3) `BundleStep.condition` predicate skips steps when false, marking them `SKIPPED` not `FAILED`; (4) `shouldWeInvest()` runs the pre-decision bundle once then applies the confirmation gate — no double-execution; (5) all bundle definitions consolidated in `bundles.ts` — none remain in `executor.ts`. Tests in `tests/kernel-executor.test.ts` (Tests A–H) verify each criterion. (closes #209)

- **Anti-Stub Test Pattern** (`tests/geowiz-anti-stub.test.ts`, `CONTRIBUTING.md`) — reference implementation of the three-part server test standard: (1) Mock-SDK test asserting `messages.create` is reached (not just that the server responds), (2) determinism test asserting different inputs produce different outputs, (3) demo-fallback test asserting `callLLM` throws a clear error without `ANTHROPIC_API_KEY`. Pattern documented in `CONTRIBUTING.md` under "Testing Standards". Ghost-close guard added to `/finish-issue` and `/create-issue` skills. 4 tests in `tests/geowiz-anti-stub.test.ts`. (closes #245)

- **Partial Success** (`src/kernel/executor.ts`, `src/kernel/middleware/output.ts`, `src/kernel/types.ts`) — `PartialSuccessResult` schema with `succeeded[]`, `failed[]`, and `errors[]` arrays (flat, no Map iteration needed). `toPartialSuccessResult(gathered)` and `toBundlePartialSuccessResult(bundle)` convert `GatheredResponse`/`BundleResponse` into `PartialSuccessResult` — each `FailedItem` includes `errorType`, `message`, and `recoveryHint` for direct agent retry logic. `OutputShaper` gains `shapeGathered(gathered, detailLevel)` and `shapeBundle(bundle, detailLevel)` — natural language summaries at summary/standard/full levels. All types and helpers exported from the kernel barrel. 15 tests in `tests/kernel-partial-success.test.ts`. (closes #148)

- **Graceful Degradation** (`src/kernel/executor.ts`, `src/kernel/types.ts`) — `executeParallel()` and `executeBundle()` now populate `degraded: true` and a `degradationManifest` (with `missingSections`, `reasons`, and `completeness`) whenever any tool fails but the operation still returns partial results. `ExecutionOptions` gains `minSuccessRatio?: number` — when the success ratio falls below this threshold, `overallFailure: true` is also set. All methods remain backward compatible when no failures occur. 10 tests in `tests/kernel-graceful-degradation.test.ts`. (closes #147)

- **Timeout Boundary** (`src/kernel/executor.ts`, `src/kernel/types.ts`) — per-server timeout overrides via `serverTimeouts: Record<string, number>` in `Executor` constructor; `KERNEL_TIMEOUT_MS` env var sets the default `toolTimeoutMs` when no explicit option is provided; aggregate timeout for `executeParallel()` and `executeBundle()` via `ExecutionOptions.aggregateTimeoutMs` — checks fire both before and after each chunk/phase, returning completed results with `timedOut: true` when the deadline passes. `GatheredResponse` and `BundleResponse` gain an optional `timedOut` flag. All methods remain backward compatible. 11 tests in `tests/kernel-timeout-boundary.test.ts`. (closes #146)

- **Cancellation Tokens** (`src/kernel/executor.ts`, `src/kernel/types.ts`) — `CancellationToken` class with `cancel()`, `isCancelled`, and `throwIfCancelled()`. `execute()`, `executeParallel()`, and `executeBundle()` each accept an optional `token?: CancellationToken`. Pre-cancelled tokens fast-fail immediately; tokens cancelled between chunks or phases stop the next unit from starting while preserving already-completed results. `GatheredResponse` and `BundleResponse` gain an optional `cancelled` flag. All methods remain backward compatible when no token is supplied. 13 tests in `tests/kernel-cancellation.test.ts`. (closes #130)

- **Session Persistence** (`src/kernel/context.ts`) — pluggable storage backend for sessions that survive kernel restarts. `SessionStorageBackend` interface (`save`, `load`, `loadAll`, `delete`) with a `FileSessionStorage` implementation (one JSON file per session, configurable directory, auto-created on first use). `Session` gains `exportResults()` and a `fromSerialized()` static factory. `SessionManager` accepts an optional backend; `createSession()` and `destroySession()` fire best-effort persistence saves on every lifecycle event; `recoverSessions()` reloads all sessions from storage on startup. `Kernel` exposes `recoverSessions()` and reads `KernelConfig.sessionStorage.path` to auto-configure `FileSessionStorage`. No backend = identical in-memory-only behavior. `KernelConfig` extended with optional `sessionStorage: { path: string }`. `FileSessionStorage`, `SessionStorageBackend`, and `SerializedSession` exported from the kernel barrel. 14 tests in `tests/kernel-session-persistence.test.ts`. (closes #114)

- **Result Caching with Idempotency Keys** (`src/kernel/result-cache.ts`) — TTL-based in-memory result cache keyed by the deterministic SHA-256 idempotency keys already generated by `Executor.generateIdempotencyKey()`. Query tools are cacheable; command tools (`reporter`, `decision`) are never cached. Cache hits return the stored `ToolResponse` with `metadata.fromCache: true` set; misses fall through to normal execution and populate the cache on success. `invalidate(key)` / `invalidateAll()` for programmatic eviction. `metrics` property exposes `{ hits, misses, size }` (size counts only live, non-expired entries). TTL defaults to `KernelConfig.execution.idempotencyTtlMs` (5 minutes). Exposed on `Kernel` as `kernel.resultCache` (direct access) and `kernel.invalidateCache(key?)`. `ResponseMetadata` extended with optional `fromCache` field. 16 tests in `tests/kernel-result-cache.test.ts`. (closes #113)

- **Server Health Check Monitoring** (`src/kernel/health-monitor.ts`) — proactive per-server health probing that updates `Registry` server status before requests are routed. `HealthMonitor` accepts an injected `ProbeFn` (returns `"up" | "down"`), a configurable probe interval (default 60s), and a per-probe timeout (default 5s — slow probes counted as `"down"`). `probeNow(name)` / `probeAll()` for manual probing; `start()` / `stop()` for periodic monitoring; `getStatus(name)` and `listHealthy()` for observability. Integrated into `Kernel` as `kernel.healthMonitor` (public) and `kernel.getServerHealth(name)` / `kernel.startHealthMonitor(probeFn)`. Configurable via `KernelConfig.resilience.healthCheck`. Complements the reactive circuit breaker (#111) with a proactive health layer. 19 tests in `tests/kernel-health-monitor.test.ts`. (closes #112)

- **EIA API Integration** (`src/servers/market.ts`) — `analyze_market_conditions` now fetches live WTI crude and Henry Hub natural gas spot prices from the U.S. EIA Open Data API. Falls back to documented stub constants (`$75/bbl`, `$3.50/MMBtu`) when `EIA_API_KEY` is absent or the request fails. Response includes `dataSource: 'eia'` or `dataSource: 'stub'` for provenance transparency. Prices are cached in-memory for 1 hour (2 API calls per analysis run). See `docs/EIA_API_SETUP.md` for key registration. 7 tests in `tests/market-eia.test.ts` (mocked fetch — no key required in CI). (closes #223)

- **Real Monte Carlo Simulation** (`src/servers/risk-analysis.ts`) — `performMonteCarloAnalysis()` now runs true probabilistic sampling using three distribution types: triangular (inverse-CDF), normal (Box-Muller transform), and uniform. Each variable (`oilPrice`, `initialProduction`, `declineRate`, `capex`) is independently sampled from its specified distribution; p10/p50/p90 statistics converge for large iteration counts; 10,000 iterations completes in <500ms. Replaces the deterministic linear spread stub. Three samplers exported for unit testing: `sampleUniform`, `sampleTriangular`, `sampleNormal`. 15 tests in `tests/kernel-monte-carlo.test.ts`. (closes #224)

- **Shared LLM Client** (`src/shared/llm-client.ts`) — `callLLM(options)` is the single entry point for all Anthropic API calls in SHALE YEAH. Accepts `prompt`, optional `system`, `model` (default `claude-opus-4-6`), and `maxTokens` (default 4096). Uses adaptive thinking on Opus 4.6 for best reasoning quality. Throws a descriptive `Error` when `ANTHROPIC_API_KEY` is absent. 6 tests in `tests/llm-client.test.ts`. (closes #222)
- **Circuit Breaker Pattern** (`src/kernel/middleware/circuit-breaker.ts`) — per-server state machine (closed → open → half-open) that automatically excludes repeatedly-failing servers from scatter-gather and bundle execution. Configurable failure threshold (default 3 consecutive RETRYABLE failures), reset timeout (default 30s), and half-open probe attempts (default 1). Only RETRYABLE errors trip the breaker — PERMANENT, AUTH_REQUIRED, and USER_ACTION errors are request-level issues and do not affect server health. Integrated into `Executor` (fast-fail + outcome recording) and `Registry` (`listServers()` filters open-circuit servers). Exposed on `Kernel` via `getCircuitState(serverName)` for observability. Configurable via `KernelConfig.resilience.circuitBreaker`. 43 tests in `tests/kernel-circuit-breaker.test.ts`. (issue #111)
- **Retry with Exponential Backoff** (`src/kernel/executor.ts`) — automatic retry for retryable errors (rate limit, timeout, connection) using existing `ResilienceMiddleware.classifyError()` classification. Exponential backoff with jitter (`baseDelay * 2^attempt + 0-30% jitter`) prevents thundering herd. Base delays from resilience recommendations (rate limit: 5s, timeout: 2s, connection: 1s). Configurable via `KernelConfig.resilience.maxRetries` (default 2) and `retryBackoffMs` (default 1000ms). Permanent, auth, and user_action errors are never retried. Retry metadata (`retryAttempts`, `totalRetryDelayMs`) attached to responses.

### Changed

- **`demo.yml` workflow trimmed** — removed redundant steps (triple demo runs, performance timeout test, doc file checks); workflow now runs `npm run demo` once and verifies outputs. (closes #221)
- **README.md**: Full rewrite from 2,401 to ~360 lines targeting O&G investment professionals — removed ~1,200 lines of TypeScript code examples, aspirational features (Docker, WebSocket, SIEM), duplicate sections, and developer implementation guides; fixed factual errors (server counts, output paths, persona names, non-existent npm scripts)
- **ARCHITECTURE.md**: Integrated kernel as main narrative instead of appendix — removed outdated "two-tier" / "6 agents" framing, duplicate "Composition — Abstraction Ladder" section, jest test examples, and aspirational Docker/Kubernetes deployment claims
- **API_REFERENCE.md**: Removed duplicate "Composition — High-Level Tools" section and non-existent community links (GitHub Discussions, Discord, examples directory)
- **CONTRIBUTING.md**: Fixed demo command (`bash scripts/demo.sh` → `npm run demo`), removed Python reference (TypeScript only), removed non-existent `specs/` directory and `npm run gen` command references, removed `scripts/verify-branding.sh` from PR checklist
- **GETTING_STARTED.md**: Fixed clone URL (`your-org` → `rmcdonald`), removed non-existent GitHub Discussions reference
- **DEMO_VS_PRODUCTION.md**: Updated roadmap to reflect kernel v2.0.0 completions (RBAC, audit logging, session management, composable bundles now marked complete)

## [2.0.0] - 2026-02-14

**SHALE YEAH is now an Agent OS.** The 14 MCP domain servers are unchanged, but they now run through a kernel runtime layer that provides dynamic tool discovery, parallel scatter-gather execution, identity-anchored sessions, role-based access control, audit logging, error intelligence, and composable task bundles. Based on [Arcade.dev's 52 Agentic Tool Patterns](https://www.arcade.dev/patterns), this release moves pattern coverage from ~8% (4.5/52) to ~56% (29/52).

### Added

#### Kernel Runtime (`src/kernel/`)
- **Kernel** (`src/kernel/index.ts`) — unified entry point for the Agent OS runtime with discovery, execution, session management, and middleware pipeline
- **Tool Registry** (`src/kernel/registry.ts`) — central index of all 14 servers and their tools with capability matching, server routing, and tool type classification (12 query + 2 command)
- **Execution Engine** (`src/kernel/executor.ts`) — single, parallel (scatter-gather via `Promise.allSettled`), and bundled tool execution with dependency-ordered phases, timeout handling, `maxParallel` concurrency control, and confirmation gates
- **Session & Context** (`src/kernel/context.ts`) — `SessionManager` with identity anchoring, context injection, result storage/retrieval, and session isolation
- **Task Bundles** (`src/kernel/bundles.ts`) — 4 pre-built bundles: `QUICK_SCREEN` (4 servers), `FULL_DUE_DILIGENCE` (14 servers), `GEOLOGICAL_DEEP_DIVE` (3 servers), `FINANCIAL_REVIEW` (3 servers)
- **Type System** (`src/kernel/types.ts`) — foundation types for tool classification, detail levels, error classification, response envelopes, user identity, permissions, audit entries, and kernel configuration

#### Middleware Pipeline (`src/kernel/middleware/`)
- **Auth** (`auth.ts`) — RBAC permission gates with hierarchical role model (analyst → engineer → executive → admin) and env-var toggle (`KERNEL_AUTH_ENABLED`)
- **Audit** (`audit.ts`) — append-only JSONL audit trail with sensitive value redaction and env-var toggle (`KERNEL_AUDIT_ENABLED`)
- **Resilience** (`resilience.ts`) — error classification (retryable/permanent/auth_required/user_action), recovery guides, alternative tool suggestions, and graceful degradation assessment
- **Output Shaping** (`output.ts`) — progressive detail levels (summary/standard/full) with per-domain field rules

#### High-Level Composition API
- `kernel.quickScreen(tract)` — 4 core servers in 1 parallel phase
- `kernel.fullAnalysis(tract)` — 14 servers in 4 dependency-ordered phases
- `kernel.geologicalDeepDive(tract)` — geowiz + curve-smith + research
- `kernel.financialReview(tract)` — econobot + risk-analysis + market
- `kernel.shouldWeInvest(tract)` — full due diligence with confirmation-gated investment decision
- `kernel.confirmAction(id)` / `kernel.cancelAction(id)` — human-in-the-loop confirmation gate

#### Discovery API
- `kernel.listServers()` — enumerate all registered MCP servers
- `kernel.describeTools(server)` — list tools for a specific server
- `kernel.findCapability(keyword)` — search tools by capability
- `kernel.whoAmI()` — return current session identity

#### Test Suites (8 new files, 627 tests)
- `tests/kernel-registry.test.ts` — 60 tests
- `tests/kernel-output.test.ts` — 56 tests
- `tests/kernel-executor.test.ts` — 83 tests
- `tests/kernel-context.test.ts` — 87 tests
- `tests/kernel-resilience.test.ts` — 108 tests
- `tests/kernel-auth.test.ts` — 63 tests
- `tests/kernel-audit.test.ts` — 58 tests
- `tests/kernel-bundles.test.ts` — 112 tests

### Changed
- `ShaleYeahMCPClient` now wraps `Kernel` internally — `executeAnalysis()` delegates to `kernel.fullAnalysis()` for parallel, dependency-ordered execution (replaces sequential for-loop)
- `demo-runner.ts` and `main.ts` create kernel sessions with identity anchoring for each analysis run
- `MCPServer.formatResult()` accepts optional `detailLevel` parameter (backward compatible)
- `MCPServer.formatError()` includes `error_type` field for error classification (backward compatible)
- `MCPTool` and `ServerToolTemplate` interfaces have optional `type` and `detailLevel` fields (backward compatible)
- `package.json` version aligned to 2.0.0, description updated to reflect Agent OS architecture
- README architecture diagram updated to show kernel layer

### Documentation
- Consolidated 18 markdown files to 9 — relocated unique content, deleted duplicates and stale docs
- Added testing, release process, and pre-commit sections to `CONTRIBUTING.md` (from `DEVELOPMENT.md`)
- Added sample file specs, LAS/CSV format examples, and troubleshooting to `docs/GETTING_STARTED.md` (from `DIRECTORY_STRUCTURE.md`)
- Added file format licensing section to `SECURITY.md` (from `FILE_FORMAT_LEGAL.md`)
- Deleted: `DEMO_VS_PRODUCTION.md` (root duplicate), `docs/DEVELOPMENT.md`, `docs/DIRECTORY_STRUCTURE.md`, `docs/WORKSPACE_MANAGEMENT.md`, `docs/FILE_FORMAT_LEGAL.md`, `docs/JUNIOR_DEVELOPER_GUIDE.md`, `tests/COVERAGE_PLAN.md`, `tests/COVERAGE_STATUS.md`
- Fixed all cross-references in remaining docs

### Infrastructure
- Created `biome.json` — lint/format config with project-specific rule overrides
- Fixed 200+ lint and formatting issues across all source and test files
- Added 8 kernel test scripts to `npm run test` (627 additional tests now in CI)
- Removed `|| true` from lint script — lint errors now fail the build
- Added `data/audit/` to `.gitignore` to prevent audit logs from being committed
- Added GitHub issue templates (bug report, feature request) and PR template
- Updated `LICENSE` copyright to `2025 Ryan McDonald / Ascendvent LLC`

## [Unreleased]
