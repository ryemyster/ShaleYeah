# SHALE YEAH — Claude Code Instructions

pnpm workspace monorepo. 14 Tier 1 MCP servers + 14 Tier 2 agent packages + shared sdk. Apache-2.0 / Ryan McDonald.

## Architecture

**Two-tier.** See `ARCHITECTURE.md` for full topology.

- `sdk/` — `@shaleyeah/sdk`: contracts, LLM client, MCP base, parsers
- `servers/<name>/` — Tier 1 MCP tool servers (14 total)
- `agents/<name>/` — Tier 2 agent packages (geologist + agent-zero implemented; 12 stubs)
- `orchestrator/` — stub, Temporal workflows (#362)

**LLM calls:** Only via `callLLM()` from `@shaleyeah/sdk`. Never instantiate `@anthropic-ai/sdk` directly in server or agent code.

## SDLC

Branch from `develop`, PR targets `develop` — always `--base develop`. See `.claude/rules/sdlc.md`.

**Skills:** `/create-issue` `/new-issue-branch` `/pre-commit` `/finish-issue` `/compact`

## Standards

- TypeScript strict mode — no `any`. Exception: `sdk/src/mcp-server.ts` and `sdk/src/server-factory.ts` use `any` for Zod runtime interop.
- No `Math.random()` in business logic. Exception: `sampleUniform`, `sampleTriangular`, `sampleNormal` in `servers/risk-analysis/src/index.ts` are intentional Monte Carlo samplers.
- Tests use simple `node:assert` pattern — no jest/vitest. Run via `npx tsx <path>.test.ts`.
- New servers: inherit `MCPServer` from `@shaleyeah/sdk`, Roman persona, `registerTool()`, add to `servers/` as its own package.
- Comments explain the "why" — write for a reader who has never seen this codebase.

## Key Commands

```bash
pnpm turbo build                      # build all 30 packages (sdk → servers → agents)
pnpm turbo test                       # all test suites
pnpm turbo lint                       # Biome across all packages
cd servers/geowiz && pnpm start       # run individual MCP server
cd agents/geologist && pnpm test      # test individual package
npx tsx servers/geowiz/tests/server.test.ts   # run one suite directly
```

## Key Files

| Path | Purpose |
|------|---------|
| `sdk/src/llm-client.ts` | Shared Anthropic SDK wrapper — source of truth for all LLM calls |
| `sdk/src/contracts.ts` | AgentManifest, AgentRuntimeConfig Zod schemas |
| `ARCHITECTURE.md` | Fleet topology, orchestrator workflow, package structure |
| `CHANGELOG.md` | Updated per issue before PR (root + per-package) |
