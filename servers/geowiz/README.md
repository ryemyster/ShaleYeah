# @shaleyeah/server-geowiz

**Marcus Aurelius Geologicus** — Tier 1 geological analysis MCP server.

Stateless tool server exposing 9 geological analysis tools over the Model Context Protocol. Handles LAS/DLIS/WITSML well logs, GIS files, seismic data, geological documents, and petroleum databases. Used directly by Claude Desktop (stdio) or called by the geologist Tier 2 agent over HTTP.

---

## I want to try this in Claude Desktop right now

Add to your Claude Desktop MCP config:

```json
{
  "mcpServers": {
    "geowiz": {
      "command": "pnpm",
      "args": ["--filter", "@shaleyeah/server-geowiz", "start"],
      "cwd": "/path/to/ShaleYeah",
      "env": { "ANTHROPIC_API_KEY": "sk-ant-..." }
    }
  }
}
```

Restart Claude Desktop. You'll see 9 geology tools available. Ask Claude: *"Use geowiz to assess the quality of this LAS file: /path/to/your.las"*

---

## I want to run it as an HTTP server

```bash
cd servers/geowiz
PORT=3001 ANTHROPIC_API_KEY=sk-ant-... pnpm start
# ✅ Marcus Aurelius Geologicus ready
# 🚀 HTTP server listening on :3001
```

Verify it's up:

```bash
curl http://localhost:3001/health
# { "status": "ok", "server": "geowiz", "version": "0.1.0" }
```

Tool calls go through the MCP protocol (used by the geologist agent or any MCP client). To send a real task in natural language, use the geologist Tier 2 agent — see [`agents/geologist`](../../agents/geologist).

---

## I want to run the geologist agent against this server

```bash
# Terminal 1 — this server
cd servers/geowiz && PORT=3001 pnpm start

# Terminal 2 — the Tier 2 agent
cd agents/geologist
ANTHROPIC_API_KEY=sk-ant-... npx tsx src/agent/index.ts \
  "Analyze the Permian Basin formation in data/test.las"
```

→ See [`agents/geologist/README.md`](../../agents/geologist/README.md) for the full agent quick start.

---

## Tools

| Tool | Input formats | LLM call |
|------|--------------|----------|
| `analyze_formation` | LAS 2.0 | Yes — synthesis + fallback |
| `process_gis` | GeoJSON, Shapefile (.shp), KML | Yes |
| `process_well_logs` | LAS, DLIS, WITSML | Yes |
| `assess_quality` | LAS, any file path | No — deterministic scoring |
| `process_access_database` | .mdb, .accdb, CSV | Yes |
| `process_document` | PDF, DOCX, TXT | Yes |
| `process_seismic_data` | SEG-Y (.segy, .sgy) | Yes |
| `process_aries_database` | ARIES export files | Yes |
| `save_finding` | JSON payload | No — fs write to `./data/geowiz/findings/` |

---

## Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Yes | — | LLM synthesis calls (all tools except `assess_quality`, `save_finding`) |
| `PORT` | No | — | Set to enable HTTP mode; omit for stdio (Claude Desktop) |

---

## Commands

```bash
pnpm build        # TypeScript compile
pnpm test         # all test suites
pnpm type-check   # tsc --noEmit
pnpm lint         # Biome
```

---

## Documentation

| Doc | Who it's for |
|-----|-------------|
| [HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md) | New to the project — plain-language + technical lifecycle |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Tool inventory, data flow, LLM call locations |
| [INTEGRATION.md](docs/INTEGRATION.md) | Calling geowiz tools from an agent or MCP client |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | stdio vs HTTP modes, Docker, Kong, production checklist |
| [LOCAL_TESTING.md](docs/LOCAL_TESTING.md) | Running locally, testing tools directly |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | Adding tools, LLM wiring pattern, TDD checklist |
