# SHALE YEAH — Claude Code Instructions

Oil & gas investment analysis platform. 14 MCP servers behind an Agent OS kernel. Apache-2.0 / Ryan McDonald.

## Architecture

**Kernel** (`src/kernel/`) is the runtime — routes all execution: discovery, scatter-gather, bundles, sessions, RBAC, audit.

**14 MCP Servers** — all inherit `MCPServer` (`src/shared/mcp-server.ts`), have Roman personas, use `registerTool()`:
- Core: `geowiz`, `econobot`, `curve-smith`, `decision`, `reporter`, `risk-analysis`, `research`
- Support: `legal`, `market`, `title`, `development`, `drilling`, `infrastructure`, `test`

**Entry points:**
- `src/demo-runner.ts` — demo mode, fixture inputs, no API key required
- `src/main.ts` — production CLI, requires `ANTHROPIC_API_KEY`
- `src/mcp-client.ts` — `ShaleYeahMCPClient` wraps Kernel, `executeAnalysis()` → `kernel.fullAnalysis()`

**LLM calls:** Only via `src/shared/llm-client.ts` (shared utility, wraps `@anthropic-ai/sdk`).

## SDLC

**Branch flow:** `main` ← `develop` ← `<issue-number>-<slug>` (always branch off develop, PR targets develop)

**Per-issue workflow:**
1. `/new-issue-branch <n> <slug>` — cut branch off develop
2. Write failing test first (TDD)
3. Implement — no `Math.random()`, no mock bypasses, no silent fallbacks
4. `/pre-commit` — must pass before committing
5. `/finish-issue <n>` — CHANGELOG → commit → PR → compact

**Skills:** `/create-issue` `/new-issue-branch` `/pre-commit` `/finish-issue` `/compact` `/test-kernel`

## Standards

- TypeScript strict mode — no `any`, explicit interfaces, Zod at all boundaries
- No `Math.random()` in business logic — deterministic constants or real computation only
- Tests use simple assert pattern (not jest/vitest) — run via `npx tsx tests/<name>.test.ts`
- CI requires no API key — mock the Anthropic SDK in tests
- New servers: inherit `MCPServer`, add Roman persona, use `registerTool()`

## Key Commands

```bash
npm run demo                          # smoke test — all 14 servers must complete
npm run test                          # 16 suites (~700+ tests)
npm run build && npm run type-check   # compile gate
npm run lint                          # Biome
npm run server:geowiz                 # test individual server (all 14 available)
npm run prod -- --files="*.las"       # production analysis
```

**Pre-commit gate (all must pass):** `npm run build && npm run type-check && npm run lint && npm run test && npm run demo`

## Key Files

| Path | Purpose |
|------|---------|
| `src/kernel/` | Registry, executor, context, bundles, middleware |
| `src/servers/` | 14 MCP domain servers |
| `src/shared/mcp-server.ts` | Base class for all servers |
| `src/shared/llm-client.ts` | Shared Anthropic SDK wrapper (source of truth for LLM calls) |
| `tests/kernel-*.test.ts` | 8 kernel test suites |
| `docs/ARCHITECTURE.md` | Living architecture reference |
| `CHANGELOG.md` | Updated per issue before PR |
