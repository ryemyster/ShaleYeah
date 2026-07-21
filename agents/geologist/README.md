# Geologist ADK Agent

**Marcus Aurelius Geologicus** — the ShaleYeah fleet's geological analyst.

Tier 2 ADK/Python intelligence layer over the [`servers/geowiz`](../../servers/geowiz) Tier 1 MCP server. Accepts natural-language geological goals, reasons over 9 domain tools via MCP/HTTP, and returns synthesized answers.

## ADK project boundary

This package is the Geologist ADK project inside the monorepo. ADK files live here (`agents-cli-manifest.yaml`, `.agents-cli-spec.md`, `pyproject.toml`, `app/agent.py`) and must not be added at repo root.

Current migration state:

- ADK owns the agent shape, instructions, eval path, and backend-selection contract.
- Architecture mode is **Stand-alone Agent with Progressive Disclosure (Skills)**.
- ADK now executes every current Geowiz MCP tool through package-local Python wrappers. `save_finding` is exposed through ADK confirmation before persistence.
- `servers/geowiz` remains the independently runnable MCP backend.
- There is no Geologist npm/package.json/TypeScript adapter surface in this package. If one reappears under `agents/geologist`, it is migration debt unless the issue is explicitly deleting it.
- New Geologist reasoning/runtime work should target `app/agent.py` and `app/geowiz_mcp.py`.

---

## Run A Geological Task

**ADK path — MCP-backed tools**

```bash
cd agents/geologist
agents-cli install
GEOWIZ_MCP_URL=http://localhost:3001 agents-cli run \
  "Use process_geowiz_well_logs to process sample.las with format auto and page size 25"
```

This path uses `app/agent.py` and the Python MCP client in `app/geowiz_mcp.py`.

Start the Geowiz MCP server separately when you want live backend execution:

```bash
cd servers/geowiz
PORT=3001 pnpm start
```

---

## I want to connect this to Claude Desktop

Add the server (Tier 1) to your MCP config. The Geologist ADK agent consumes that MCP backend through `GEOWIZ_MCP_URL`.

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

---

## Tools

| Tool | What it does | Type | HITL |
|------|-------------|------|------|
| `geologist.analyze_formation` | LAS/DLIS/WITSML log analysis — porosity, permeability, maturity | query | No |
| `geologist.process_gis` | GIS spatial analysis (.shp, .geojson, .kml) | query | No |
| `geologist.process_well_logs` | Multi-format well log processing | query | No |
| `geologist.assess_quality` | Data quality scoring | query | No |
| `geologist.process_access_database` | Access DB / petroleum data extraction | query | No |
| `geologist.process_document` | Geological document parsing and extraction | query | No |
| `geologist.process_seismic_data` | SEG-Y seismic interpretation | query | No |
| `geologist.process_aries_database` | ARIES reserves database processing | query | No |
| `geologist.save_finding` | Persist a key finding to the agent memory store | **command** (transactional) | **Yes** |

---

## Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `GEOLOGIST_ADK_MODEL` | No | `gemini-flash-latest` | ADK model id for local runs |
| `GEOWIZ_MCP_URL` | No | `http://localhost:3001` | geowiz Tier 1 server URL |

---

## Commands

```bash
uv run pytest
uv run python -m py_compile app/agent.py app/geowiz_mcp.py
agents-cli info
agents-cli run "Assess the data quality of sample.las"
agents-cli eval run
```

---

## Key files

| Path | Purpose |
|------|---------|
| [`app/agent.py`](app/agent.py) | Package-local ADK entrypoint and Geowiz backend-selection tools |
| [`app/geowiz_mcp.py`](app/geowiz_mcp.py) | Python MCP client and ADK-side execution tools for every current Geowiz tool |
| [`agents-cli-manifest.yaml`](agents-cli-manifest.yaml) | agents-cli project marker for this package only |
| [`.agents-cli-spec.md`](.agents-cli-spec.md) | ADK reference-pair spec and boundaries |
| [`tests/test_adk_project_shape.py`](tests/test_adk_project_shape.py) | Regression tests for package-local ADK shape and absence of npm surface |
| [`tests/test_adk_mcp_execution_shape.py`](tests/test_adk_mcp_execution_shape.py) | Regression tests for ADK-owned Geowiz MCP execution |
| [`tests/test_adk_eval_harness_shape.py`](tests/test_adk_eval_harness_shape.py) | Regression tests for eval dataset/config coverage |

---

## Documentation

| Doc | Who it's for |
|-----|-------------|
| [HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md) | New to the project — plain-language + five-component framework |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Understanding the topology, execution paths, Arcade patterns |
| [INTEGRATION.md](docs/INTEGRATION.md) | Calling this agent from your own code |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Running in production — Docker, Kong, scopes, BYOE |
| [LOCAL_TESTING.md](docs/LOCAL_TESTING.md) | Running both processes locally, HITL testing |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | TDD workflow, adding tools, implementation notes |
