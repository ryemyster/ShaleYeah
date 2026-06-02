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

Branch from `develop`, PR targets `develop` — always `--base develop`. See `.claude/rules/sdlc.md` for full workflow.

**Skills:** `/create-issue` `/new-issue-branch` `/pre-commit` `/finish-issue` `/compact` `/test-kernel`

## Standards

- TypeScript strict mode — no `any`, explicit interfaces, Zod at all boundaries. Exception: `src/shared/mcp-server.ts` and `src/shared/server-factory.ts` use `any` for Zod runtime interop; all other files are `any`-free. No `z.any()` in Zod schemas — use explicit types.
- No `Math.random()` in business logic — deterministic constants or real computation only. Exception: `sampleUniform`, `sampleTriangular`, `sampleNormal` in `src/servers/risk-analysis.ts` are intentional Monte Carlo samplers and are explicitly named as such.
- Tests use simple assert pattern (not jest/vitest) — run via `npx tsx tests/<name>.test.ts`
- New servers: inherit `MCPServer`, add Roman persona, use `registerTool()`
- Code comments explain the "why", not the "what" — write for a reader who has never seen this codebase. Bad: `// set toc based on depth`. Good: `// Deeper rock has had more time to cook organic material, so we estimate higher TOC for deeper wells.`

## Key Commands

```bash
npm run demo                          # smoke test — all 14 servers must complete
npm run test                          # all suites (auto-discovered via scripts/run-tests.sh)
npx tsx tests/<name>.test.ts          # run one suite directly — no npm alias needed
npm run build && npm run type-check   # compile gate
npm run lint                          # Biome
npm run server:geowiz                 # test individual server (all 14 available)
npm run prod -- --files="*.las"       # production analysis
```

## Key Files

| Path | Purpose |
|------|---------|
| `src/shared/llm-client.ts` | Shared Anthropic SDK wrapper — source of truth for all LLM calls |
| `docs/ARCHITECTURE.md` | Living architecture reference |
| `CHANGELOG.md` | Updated per issue before PR |
