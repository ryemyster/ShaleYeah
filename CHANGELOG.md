# Changelog

All notable changes to SHALE YEAH will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Retry with Exponential Backoff** (`src/kernel/executor.ts`) — automatic retry for retryable errors (rate limit, timeout, connection) using existing `ResilienceMiddleware.classifyError()` classification. Exponential backoff with jitter (`baseDelay * 2^attempt + 0-30% jitter`) prevents thundering herd. Base delays from resilience recommendations (rate limit: 5s, timeout: 2s, connection: 1s). Configurable via `KernelConfig.resilience.maxRetries` (default 2) and `retryBackoffMs` (default 1000ms). Permanent, auth, and user_action errors are never retried. Retry metadata (`retryAttempts`, `totalRetryDelayMs`) attached to responses.

### Changed
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
