# @shaleyeah/geologist

**Marcus Aurelius Geologicus** — the ShaleYeah fleet's geological analyst.

Tier 2 intelligence layer over the [`@shaleyeah/server-geowiz`](../../servers/geowiz) Tier 1 MCP server. Accepts natural language geological tasks, reasons over 8 domain tools via MCP/HTTP, and returns synthesized answers with full audit trail and HITL support.

## Quick start

```bash
# 1. Start the geowiz MCP server (Tier 1)
cd servers/geowiz && PORT=3001 pnpm start

# 2. In another terminal — run the geologist task loop
cd agents/geologist
ANTHROPIC_API_KEY=sk-ant-... npx tsx src/agent/index.ts
```

## Commands

```bash
pnpm build          # TypeScript compile
pnpm test           # 51 tests (unit + contract; no live server required)
pnpm type-check     # tsc --noEmit
```

## Tools

| Tool | What it does | Model |
|------|-------------|-------|
| `geologist.analyze_formation` | LAS/DLIS/WITSML log analysis | standard-analysis |
| `geologist.process_gis` | GIS spatial analysis (.shp, .geojson, .kml) | deterministic |
| `geologist.process_well_logs` | Multi-format well log processing | standard-analysis |
| `geologist.assess_quality` | Data quality scoring | deterministic |
| `geologist.process_access_database` | Access DB / petroleum data extraction | deterministic |
| `geologist.process_document` | Geological document parsing + extraction | standard-analysis |
| `geologist.process_seismic_data` | SEG-Y seismic interpretation | standard-analysis |
| `geologist.process_aries_database` | ARIES reserves database processing | standard-analysis |

## Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Yes | — | LLM synthesis calls |
| `GEOWIZ_MCP_URL` | No | `http://localhost:3001` | Geowiz server endpoint |

## Key files

| Path | Purpose |
|------|---------|
| `src/agent/index.ts` | Manifest, config, handlers, `runGeologistTask()` |
| `src/agent/geowiz-client.ts` | MCP/HTTP client with timeout + error classification |
| `tests/agent.test.ts` | 27 contract tests (no live server) |
| `tests/mcp-client.test.ts` | 12 HTTP client + task loop tests |
| `docs/HOW_IT_WORKS.md` | Plain-language explanation |
| `docs/ARCHITECTURE.md` | Technical architecture |
| `docs/LOCAL_TESTING.md` | Run the geowiz+geologist pair locally |
| `docs/INTEGRATION.md` | Call this agent from other code |
| `docs/DEPLOYMENT.md` | Production deployment guide |
