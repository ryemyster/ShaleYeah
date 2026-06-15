# Changelog

All notable changes to SHALE YEAH will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Develop-only — not yet released to main.

### Added

- **`@anthropic-ai/sdk` 0.88.0 → 0.104.1** (#400) — dependency bump via Dependabot; adds `standardwebhooks` transitive dep.
- **research / research-analyst pair** (#369) — Tier 1 split (market-research, competitive-analysis modules; 47 tests) + Tier 2 agent (2 tools, port 3008; 53 tests).
- **legal / legal-analyst pair** (#370) — Tier 1 split (regulatory, contract, compliance; 32 tests) + Tier 2 agent (3 tools, port 3006; 53 tests).
- **title / title-analyst pair** (#372) — Tier 1 split (ownership, lease-analysis, burden-check, chain-of-title; 22 tests) + Tier 2 agent (4 tools, port 3010; 44 tests).
- **drilling / drilling-engineer pair** (#374) — Tier 1 split (program, costs, risks; 30 tests) + Tier 2 agent (3 tools, port 3003; 47 tests).
- **infrastructure / infrastructure-planner pair** (#375) — Tier 1 split (pipeline, facilities, cost-estimation, compliance; 28 tests) + Tier 2 agent (4 tools, port 3012; 43 tests).
- **development-planner pair** (#373) — Tier 1 split + Tier 2 agent (3 tools: create_development_plan, estimate_project_timeline, monitor_development_progress; port 3011; 54 tests).
- **qa-server Tier 1 split** (#411) — monolithic index split into validation + reporting domain modules; 23 tests.
- **quality-assurance Tier 2 agent** (#376) — `runQAAssuranceTask()` Layer 2 loop, 2 tools (run_quality_tests, generate_quality_report), port 3014; 42 tests.
- **economist Tier 2 agent** (#364) — `runEconomistTask()` Layer 2 loop, MCP HTTP client; 34 tests.
- **geologist foundation fixes** (#402–#407) — model routing wired, scope enforcement, blocking eval halt, `executeWithRetry`, `geologist.save_finding` write tool, `/health` endpoint on all 14 MCP servers.
- **Level 2 batch — investment-chair, market-analyst, reporter-agent, reservoir-engineer, risk-analyst** (#439–#443) — all 5 remaining stub agents fully implemented: `runXxxTask` Layer 2 loop with `executeWithRetry` (3-attempt exponential backoff) + permanent halt guard (`!retryable` → return immediately); MCP HTTP clients wired to ports 3013/3007/3009/3004/3005; Arcade-compliant manifests + runtime configs; 265 tests total across all 5 agents (contract + MCP client suites).
- **Context injection — `ContextStore` Phase 1** (#395) — new `sdk/src/context-store.ts` process-level singleton; all 14 agent `executeLoop` functions now read prior findings from their memory namespace before building the system prompt and write synthesized results on successful completion. Permanent failures (blocking evals, scope rejections) do not write. 28 new tests across all agents verify read-inject and write-after-run behavior.
- **Async Job polling — Arcade #24** (#396) — new `sdk/src/async-job.ts` defines `AsyncJobPoller`, `AsyncJobPollResult`, `ASYNC_THRESHOLD_MS = 10_000`, `ASYNC_POLL_INTERVAL_MS = 2_000`, and `defaultAsyncJobPoller` (polls `get_job_status` via MCP JSON-RPC). All 14 agent `executeLoop` functions now detect pending job responses from long-running tools (`timeoutMs > 10s`) and poll until completion or timeout. `risk-analyst.monte_carlo_simulation` gets `timeoutMs: 60_000` as the first live async tool. Poller and poll interval are injectable for tests.
- **Mutual Exclusivity — Arcade #9** (#453) — new `sdk/src/mutual-exclusivity.ts` exports `checkMutualExclusivity(args, groups)` and `buildMutualExclusivityError(group, provided)`. `AgentToolManifestSchema` gains an optional `mutuallyExclusive` field. Four priority tools wired: `geowiz.analyze_formation` (`formationName`/`formationId` XOR), `geowiz.process_well_logs` (`wellName`/`wellId` XOR), `title.examine_ownership` (`propertyDescription`/`tractId` XOR), `econobot.analyze_economics` (`scenarioName`/`scenarioConfig` XOR). XOR violations return `{error_type: "permanent", error, hint}` so the LLM knows to remove one param rather than retry. 10 SDK utility tests added.

### Changed

- **Monorepo conversion** (#385) — restructured from single npm package to pnpm workspace + Turborepo. `sdk/`, `servers/*/` (14), `agents/*/` (14), `orchestrator/`. Kernel deleted. CI updated to pnpm + Turborepo.
- **HTTP transport** (#363) — `MCPServer` gains `StreamableHTTPServerTransport` when `PORT` is set; geologist wired to geowiz over HTTP via `callGeowizTool()`.
- **Model routing into `callLLM`** (#402) — all agents resolve `config.modelRouting["standard-analysis"].model` on every LLM call; injectable `callLLM` option added to all `runTask` functions for test capture without real API calls.

### Fixed

- **Level 2 parity — 9 agents** (#403, #404, #423–#430) — `executeWithRetry` (3-attempt exponential backoff) and permanent halt guard (`!execResult.retryable`) applied to geologist, economist, quality-assurance, title-analyst, research-analyst, development-planner, drilling-engineer, infrastructure-planner, legal-analyst. Each gains 2 contract tests verifying a blocking eval halts the loop.
- **`LocalAgentRuntime.execute()` scope audit** (#403) — scope rejections now written to audit trail before returning.
- **Security: CodeQL high alerts** — insecure temp files (`fs.mkdtemp`), ReDoS (`\d{1,4}` bound in lease regexes), `security-events: write` added to CodeQL workflow.
- **CI: pnpm/action-setup SHA** (#409) — replaced non-existent `fe02b74` with correct v4.1.0 SHA `a7487c7e`.
- **Biome v2 migration** — `biome.json` added per-package across all 30 packages; lint errors resolved.

---

## [2.1.0] - TBD

Kernel additions built on top of 2.0.0 — present in `main` but not yet assigned a version tag.

### Added

- **Dependency Hints** — tools declare `dependsOn`/`providesFor`; registry exposes full execution graph with `validateExecutionOrder()` and `getExecutionGraph()`. 18 tests. (closes #198)
- **Resource Reference** — `ResourceRef` tickets let tools pass large payloads by reference instead of value; executor auto-resolves refs before dispatch. 14 tests. (closes #204)
- **Canonical Tool Model** — Zod schemas (`FormationSchema`, `EconomicsSchema`, `RiskProfileSchema`, `DecisionSchema`) as the shared contract between all 14 servers; `SessionManager` accumulates canonical sections across tool calls. 26 tests. (closes #208)
- **Fallback Tool** — when a primary tool exhausts retries, the executor routes through a configurable fallback chain; result metadata flags `usedFallback`. Three default chains registered at kernel init. 10 tests. (closes #149)
- **Token-Efficient Response** — `OutputShaper.shape()` gains `fields?` projection, `stripNulls?`, and `maxTokenHint?`. 7 tests. (closes #201)
- **Session Persistence** — pluggable `SessionStorageBackend` with `FileSessionStorage` implementation; sessions survive kernel restarts. 14 tests. (closes #114)
- **Result Caching** — TTL-based in-memory cache keyed by idempotency SHA-256; query tools cacheable, command tools never cached; `fromCache: true` in metadata. 16 tests. (closes #113)
- **Server Health Check Monitoring** — proactive per-server health probes with configurable interval/timeout; `HealthMonitor` exposed on `Kernel`. Complements the circuit breaker. 19 tests. (closes #112)
- **Circuit Breaker** — per-server state machine (closed → open → half-open) that excludes repeatedly-failing servers from scatter-gather and bundles. Only retryable errors trip the breaker. 43 tests. (closes #111)
- **Retry with Exponential Backoff** — automatic retry for retryable errors with jitter; configurable via `KernelConfig.resilience`. Permanent/auth/user_action errors never retried.
- **Partial Success** — `PartialSuccessResult` schema with `succeeded[]`, `failed[]`, `errors[]`; `OutputShaper` gains natural-language summaries at all detail levels. 15 tests. (closes #148)
- **Graceful Degradation** — `executeParallel()` and `executeBundle()` populate `degraded: true` and `degradationManifest` on partial failures; `minSuccessRatio` threshold. 10 tests. (closes #147)
- **Timeout Boundary** — per-server timeout overrides, `KERNEL_TIMEOUT_MS` env var, aggregate timeout via `ExecutionOptions.aggregateTimeoutMs`. 11 tests. (closes #146)
- **Cancellation Tokens** — `CancellationToken` with `cancel()`, pre-cancel fast-fail, between-chunk cancellation. 13 tests. (closes #130)
- **Secret Injection** — `SecretsStore` manages API keys without exposing in args or logs; `callLLM()` accepts `apiKey` param; audit trail records key name + source. 14 tests. (closes #205)
- **EIA API Integration** — `analyze_market_conditions` fetches live WTI/Henry Hub prices; 1-hour cache; falls back to documented stubs when `EIA_API_KEY` absent. 7 tests. (closes #223)
- **Real Monte Carlo Simulation** — `performMonteCarloAnalysis()` uses triangular (inverse-CDF), normal (Box-Muller), and uniform distributions; 10,000 iterations in <500ms. Exports `sampleUniform`, `sampleTriangular`, `sampleNormal`. 15 tests. (closes #224)
- **Shared LLM Client** — `callLLM()` is the single Anthropic API entry point for all servers. (closes #222)
- **LLM Integration — all 14 servers** — each server calls `callLLM()` with domain-specific inputs; falls back to rule-based `deriveDefault*()` when API unavailable. (#211–#217)
- **Fixture Injection for Demo Mode** — `generateMockAnalysis()` deleted; demo mode passes static `DEMO_FIXTURE_ARGS` to real server handlers instead of bypassing execution. (closes #225)
- **Agent OS Rearchitecture** — kernel structural gaps closed: `storeResult()`, context injection, `BundleStep.condition` predicates, confirmation gate dedup, bundle definition consolidation. (closes #209)
- **E2E Production Validation suite** — 15 tests covering fixture existence, real LAS parsing, fallback determinism, LLM graceful degradation; includes anonymized Wolfcamp/Bone Spring `.las` sample file. (closes #218)
- **`/code-review` skill** — self-audit before `/pre-commit`: scope alignment, anti-pattern greps, ghost-close guard, coverage check.
- **Anti-pattern greps in `/pre-commit`** — direct `@anthropic-ai/sdk` imports in servers and `Math.random()` in business logic now fail the gate with file:line.
- **Test auto-discovery** — `scripts/run-tests.sh` replaces 38-suite `&&`-chain; new test files are picked up automatically.
- **Anti-Stub Test Pattern** — three-part standard (mock-SDK reach, determinism, demo-fallback) documented in `CONTRIBUTING.md`. (closes #245)

### Fixed

- **Demo bypass removed** — `createExecutorFn()` no longer defaults to `mode: "demo"`; production is the default. (closes #221)

### Security

- **Clear-text logging** — removed `hasPassword` boolean from `console.log` summary in `tools/access-processor.ts`. (CodeQL CWE-532, alert #39)
- **CI/CD supply chain hardening** — all Actions pinned to full SHAs; `permissions: contents: read` default added; `environment: production` gate on release jobs; `gitleaks.yml` renamed to `codeql.yml`.

### Changed

- `demo.yml` trimmed — single `npm run demo` run; redundant steps removed. (closes #221)
- Docs pass — README, ARCHITECTURE.md, API_REFERENCE.md, CONTRIBUTING.md, GETTING_STARTED.md, DEMO_VS_PRODUCTION.md updated for accuracy and reduced to essential content.

---

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
