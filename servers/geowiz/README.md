# @shaleyeah/server-geowiz

**Marcus Aurelius Geologicus** — Tier 1 geological analysis MCP server.

Tool server exposing 9 domain tools and one model-profile discovery tool over the Model Context Protocol. It maintains HTTP transport sessions and writes findings/artifacts. Used directly by an MCP client (stdio launch mode) or called by the Geologist ADK employee over HTTP. Advertised input formats require their own source/format qualification; see the [support guide](../../docs/deployment-support.md) for current evidence and limits.

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
      "env": { "GEOWIZ_MODEL_CONFIG_FILE": "/absolute/private/models.json" }
    }
  }
}
```

Restart Claude Desktop. You'll see 9 domain tools and model-profile discovery. Ask Claude: *"Use geowiz to assess the quality of this LAS file: /path/to/your.las"*

---

## I want to run it as an HTTP server

Follow [HTTP access setup](docs/HTTP_ACCESS.md) to build the package, create a
private operator policy/dedicated credential and start `pnpm start:http`.
The sample grants only the existing quality-control read tool. It binds to
loopback and records redacted access events before dispatch. An ordinary PORT
setting alone no longer supplies authority or opens a listener.

Verify it's up:

```bash
curl http://127.0.0.1:3001/health
# { "status": "ok", "server": "geowiz", "version": "1.0.0" }
```

Tool calls go through the MCP protocol (used by the geologist agent or any MCP client). To send a real task in natural language, use the geologist Tier 2 agent — see [`agents/geologist`](../../agents/geologist).

Startup/health need no model key. Real model-assisted tools need a separately
resolved provider credential from the [private profile](../../docs/model-providers.md). HTTP tool access requires configured credentials
and scopes; remote deployments inject their verified identity/audit adapters.
A healthy port does not prove source access, professional results or reviewed persistence.
Follow [DEPLOYMENT.md](docs/DEPLOYMENT.md) for build/state and qualification steps.

---

## I want to run the geologist agent against this server

Geologist uses the installed [Python MCP client](../../sdk/python/README.md)
with the launcher's dedicated private credential file. No-key controls prove
the protected connection and rejected anonymous/ungranted calls. Follow
[HTTP access setup](docs/HTTP_ACCESS.md); full source, review and employee
performance qualification remains #674 and its dependencies.

→ See [`agents/geologist/README.md`](../../agents/geologist/README.md) for the full agent quick start.

---

## Tools

| Tool | Input formats | LLM call |
|------|--------------|----------|
| `analyze_formation` | LAS 2.0 | Configured Gemini or Anthropic; explicit errors |
| `process_gis` | GeoJSON, Shapefile (.shp), KML | No — source/format qualification remains |
| `process_well_logs` | LAS, DLIS, WITSML | No — source/format qualification remains |
| `assess_quality` | Advertised file path; current fixed metrics do not inspect it | No — input-derived repair is #671 |
| `process_access_database` | .mdb, .accdb, CSV | No — source/format qualification remains |
| `process_document` | PDF, DOCX, TXT | No — source/format qualification remains |
| `process_seismic_data` | SEG-Y (.segy, .sgy) | No — source/format qualification remains |
| `process_aries_database` | ARIES export files | No — source/format qualification remains |
| `save_finding` | JSON payload | No — fs write to `./data/geowiz/findings/` |
| `get_model_profile` | Empty object | No — authenticated discovery without keys/references |

---

## Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `GEOWIZ_MODEL_CONFIG_FILE` | Model-backed stdio calls | None | Private model profile; [setup](../../docs/model-providers.md) |
| `PORT` | No | — | HTTP requires configured access; omit for stdio (Claude Desktop) |
| `GEOWIZ_HTTP_CONFIG_FILE` | Local HTTP example | — | Private operator policy with credential/audit file references |

---

## Commands

```bash
pnpm build        # TypeScript compile
pnpm start:http   # configured local HTTP example, after build/private setup
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
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Local transport/setup, storage and qualified deployment limits |
| [LOCAL_TESTING.md](docs/LOCAL_TESTING.md) | Running locally, testing tools directly |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | Adding tools, LLM wiring pattern, TDD checklist |
