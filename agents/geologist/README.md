# Geologist ADK Agent

**Marcus Aurelius Geologicus** — the ShaleYeah fleet's geological analyst.

Tier 2 ADK/Python intelligence layer over the [`servers/geowiz`](../../servers/geowiz) Tier 1 MCP server. Accepts natural-language geological goals, reasons over 9 domain tools via MCP/HTTP, and returns synthesized answers.

## What It Does

Geologist turns geological diligence requests into the right Geowiz MCP tool call, sends structured data-processing inputs to the backend, and explains the returned formation, GIS, seismic, document, or data-quality result.

It exists so the fleet has one specialist for subsurface evidence and geological context while keeping persistence actions, such as saving a finding, behind explicit confirmation.

## Project Boundary

This package is the Geologist ADK project inside the monorepo. ADK files live here (`agents-cli-manifest.yaml`, `.agents-cli-spec.md`, `pyproject.toml`, `app/agent.py`) and must not be added at repo root.

At runtime:

- ADK owns the agent shape, instructions, eval path, and backend-selection contract.
- Architecture mode is **Stand-alone Agent with Progressive Disclosure (Skills)**.
- The agent executes current Geowiz MCP tools through package-local Python wrappers. `save_finding` is exposed through ADK confirmation before persistence.
- `servers/geowiz` is the independently runnable MCP backend.
- New Geologist reasoning/runtime work should target `app/agent.py` and `app/geowiz_mcp.py`.

---

## Run A Geological Task

**ADK path — MCP-backed tools**

```bash
cd agents/geologist
uv sync --frozen --extra eval
GEOWIZ_MCP_URL=http://127.0.0.1:3001 agents-cli run \
  "Use assess_geowiz_quality on tests/sample-files/sample.las as LAS data"
```

Start Geowiz and load the chosen model credentials before this live command;
follow the [ordered setup](../../docs/deployment-support.md#run-the-current-reference-locally).
The fixture path resolves on the Geowiz host. This path uses `app/agent.py` and
the Python MCP client in `app/geowiz_mcp.py`; it remains subject to provider,
source and composition qualification.

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
      "cwd": "/path/to/ShaleYeah"
    }
  }
}
```

Load Geowiz's provider credential through your local secret loader, outside the
saved config. Leave `PORT` unset for this stdio launch mode. The configuration
does not establish MCP client/session, identity or professional-result
qualification; see [deployment limits](docs/DEPLOYMENT.md).

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
| `geologist.save_finding` | Write finding JSON on the Geowiz host; durable employee context is separate | **command** | **Yes**, ADK confirmation; backend enforcement pending |

## HITL Boundary

The agent may analyze geological data, assess data quality, process files, and summarize findings. It must ask for explicit confirmation before saving a finding or performing any persistence-like action.

---

## Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `GEOLOGIST_ADK_MODEL` | No | `gemini-flash-latest` | ADK model id for local runs |
| `GEOWIZ_MCP_URL` | No | `http://localhost:3001` | geowiz Tier 1 server URL |

---

## Build, Test, And Use

Run these from `agents/geologist`.

| Task | Command |
|------|---------|
| Install dependencies | `uv sync --frozen --extra eval` |
| Test project shape and MCP result boundaries | `uv run --frozen pytest -q` |
| Syntax check | `uv run --frozen python -m py_compile app/agent.py app/geowiz_mcp.py` |
| Inspect ADK project | `agents-cli info` |
| Run a live local task | Follow [the ordered setup](../../docs/deployment-support.md#run-the-current-reference-locally) with backend and provider configured |
| Run configured live evals | `agents-cli eval run --dataset tests/eval/datasets/geologist-adk-reference.json --config tests/eval/eval_config.yaml` |

Pytest includes project/eval shape checks and deterministic fake-session tests
for discovered schemas, structured-only results, input/output rejection, legacy
errors, bounded discovery and missing role capabilities. They are not employee
performance scores. Live evals need the tool/model and selected grader prerequisites; see
[LOCAL_TESTING.md](docs/LOCAL_TESTING.md#run-adk-evals) for inputs, artifacts and
limits. A passing mock, import or healthy port does not qualify geological work
or backend approval enforcement.

---

## Key files

| Path | Purpose |
|------|---------|
| [`app/agent.py`](app/agent.py) | Package-local ADK entrypoint and Geowiz backend-selection tools |
| [`app/geowiz_mcp.py`](app/geowiz_mcp.py) | Python MCP client and ADK-side execution tools for every current Geowiz tool |
| [`agents-cli-manifest.yaml`](agents-cli-manifest.yaml) | agents-cli project marker for this package only |
| [`.agents-cli-spec.md`](.agents-cli-spec.md) | ADK reference-pair spec and boundaries |
| [`tests/test_adk_project_shape.py`](tests/test_adk_project_shape.py) | Regression tests for package-local ADK shape |
| [`tests/test_adk_mcp_execution_shape.py`](tests/test_adk_mcp_execution_shape.py) | Regression tests for ADK-owned Geowiz MCP execution |
| [`tests/test_adk_eval_harness_shape.py`](tests/test_adk_eval_harness_shape.py) | Regression tests for eval dataset/config coverage |
| [`tests/test_mcp_result_contract.py`](tests/test_mcp_result_contract.py) | Schema/result/failure and incompatible-backend controls without a model key |

---

## Documentation

| Doc | Who it's for |
|-----|-------------|
| [HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md) | New to the project — plain-language + five-component framework |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Understanding the topology, execution paths, Arcade patterns |
| [INTEGRATION.md](docs/INTEGRATION.md) | Calling this agent from your own code |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Local setup, state/review requirements and qualified deployment limits |
| [LOCAL_TESTING.md](docs/LOCAL_TESTING.md) | Running both processes locally, HITL testing |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | TDD workflow, adding tools, implementation notes |
