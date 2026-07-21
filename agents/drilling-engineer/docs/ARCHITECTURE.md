# Architecture — Drilling Engineer ADK Agent

`agents/drilling-engineer` is the package-local ADK/Python project for the Drilling Engineer role. The monorepo root remains workspace coordination only.

## Package Boundary

| Path | Purpose |
|------|---------|
| `agents-cli-manifest.yaml` | agents-cli project marker for this package |
| `.agents-cli-spec.md` | reference-pair spec and package boundary |
| `pyproject.toml` | Python ADK dependencies |
| `app/agent.py` | ADK `root_agent`, instructions, model choice, and tool registration |
| `app/drilling_mcp.py` | Python MCP client and Drilling execution wrappers |
| `tests/` | pytest shape tests plus ADK eval dataset/config |
| `servers/drilling` | independent TypeScript MCP backend |

The Drilling Engineer agent intentionally has no `package.json`, `tsconfig.json`, `biome.json`, `src/agent/`, `dist/agent/`, or TypeScript agent tests. TypeScript/pnpm remains valid for the Drilling MCP server and shared workspace packages.

## Architecture Mode

Primary mode: **Stand-alone Agent with Progressive Disclosure (Skills)**.

Drilling Engineer is a stand-alone specialist that equips package-local instructions, eval criteria, and Drilling MCP tools when drilling diligence is requested. It is not a hierarchical orchestrator, graph workflow, ambient event-driven agent, or capability-first arbitrator in #532.

Graph-based workflow is reserved for a later issue if drilling review needs deterministic nodes, conditional routes, stateful sessions, runtime eval nodes, or explicit HITL gates as workflow nodes.

## Execution Path

```
ADK runner / agents-cli
  |
  v
app/agent.py
  |
  |-- drilling_backend_status()
  |-- plan_drilling_tool_call()
  |-- design_drilling_program()
  |-- estimate_well_costs()
  `-- assess_drilling_risks()
       |
       v
app/drilling_mcp.py
       |
       v
DRILLING_MCP_URL, default http://localhost:3003
       |
       v
servers/drilling
```

## Tool Parity

| Drilling MCP tool | ADK Python wrapper |
|-------------------|--------------------|
| `design_drilling_program` | `design_drilling_program` |
| `estimate_well_costs` | `estimate_well_costs` |
| `assess_drilling_risks` | `assess_drilling_risks` |

## Eval Harness

Behavior evals live under `tests/eval/`.

| File | Purpose |
|------|---------|
| `tests/eval/datasets/drilling-engineer-adk-reference.json` | Control, edge, and capability-boundary cases for ADK tool selection |
| `tests/eval/eval_config.yaml` | Deterministic hard-boundary checks plus LLM-judged response quality |

Run from `agents/drilling-engineer`:

```bash
agents-cli eval run
```

## Runtime Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `DRILLING_MCP_URL` | `http://localhost:3003` | Drilling-compatible MCP backend URL |
| `DRILLING_ENGINEER_ADK_MODEL` | `gemini-flash-latest` | ADK model id for local runs |

The agent does not depend on the orchestrator or any other agent. It can run standalone as long as a compatible Drilling MCP backend is reachable when execution tools are invoked.

## HITL Boundary

Drilling Engineer may analyze well parameters, design provisional drilling programs, estimate costs, and assess risks. It must not present final AFE approval, spud approval, field-execution authorization, safety-critical approval, or an unrevised final drilling program without human engineering review.
