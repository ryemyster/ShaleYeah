# Architecture — Geologist ADK Agent

`agents/geologist` is the package-local ADK/Python project for the Geologist role. The monorepo root remains workspace coordination only.

## Package Boundary

| Path | Purpose |
|------|---------|
| `agents-cli-manifest.yaml` | agents-cli project marker for this package |
| `.agents-cli-spec.md` | reference-pair spec and package boundary |
| `pyproject.toml` | Python ADK dependencies |
| `app/agent.py` | ADK `root_agent`, instructions, model choice, and tool registration |
| `app/geowiz_mcp.py` | Python MCP client and Geowiz execution wrappers |
| `tests/` | pytest shape tests plus ADK eval dataset/config |
| `servers/geowiz` | independent TypeScript MCP backend |

## Architecture Mode

Primary mode: **Stand-alone Agent with Progressive Disclosure (Skills)**.

Geologist is a stand-alone specialist that equips package-local instructions, eval criteria, and Geowiz MCP tools when geological diligence is requested. It is not a hierarchical orchestrator, graph workflow, ambient event-driven agent, or capability-first arbitrator in #597.

Graph-based workflow is reserved for a later issue if geology review needs deterministic nodes, conditional routes, stateful sessions, or explicit HITL gates as workflow nodes.

## Execution Path

```
ADK runner / agents-cli
  |
  v
app/agent.py
  |
  |-- geowiz_backend_status()
  |-- plan_geowiz_tool_call()
  |-- analyze_geowiz_formation()
  |-- assess_geowiz_quality()
  |-- process_geowiz_well_logs()
  |-- process_geowiz_gis()
  |-- process_geowiz_access_database()
  |-- process_geowiz_document()
  |-- process_geowiz_seismic_data()
  |-- process_geowiz_aries_database()
  `-- save_geowiz_finding() with ADK confirmation
       |
       v
app/geowiz_mcp.py
       |
       v
GEOWIZ_MCP_URL, default http://localhost:3001
       |
       v
servers/geowiz
```

## Tool Parity

| Geowiz MCP tool | ADK Python wrapper |
|-----------------|--------------------|
| `analyze_formation` | `analyze_geowiz_formation` |
| `assess_quality` | `assess_geowiz_quality` |
| `process_well_logs` | `process_geowiz_well_logs` |
| `process_gis` | `process_geowiz_gis` |
| `process_access_database` | `process_geowiz_access_database` |
| `process_document` | `process_geowiz_document` |
| `process_seismic_data` | `process_geowiz_seismic_data` |
| `process_aries_database` | `process_geowiz_aries_database` |
| `save_finding` | `save_geowiz_finding` with `FunctionTool(..., require_confirmation=True)` |

## Eval Harness

Behavior evals live under `tests/eval/`.

| File | Purpose |
|------|---------|
| `tests/eval/datasets/geologist-adk-reference.json` | Control, edge, and capability-boundary cases for ADK tool selection |
| `tests/eval/eval_config.yaml` | Deterministic hard-boundary checks plus LLM-judged response quality |

Run from `agents/geologist`:

```bash
agents-cli eval run
```

Use deterministic grading for hard rules such as tool-call expectations and "do not save without approval." Use an LLM judge only for subjective final-response quality.

## Runtime Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `GEOWIZ_MCP_URL` | `http://localhost:3001` | Geowiz-compatible MCP backend URL |
| `GEOLOGIST_ADK_MODEL` | `gemini-flash-latest` | ADK model id for local runs |

The agent does not depend on the orchestrator or any other agent. It can run standalone as long as a compatible Geowiz MCP backend is reachable when execution tools are invoked.
