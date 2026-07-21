# Drilling Engineer ADK Agent

**Perforator Maximus** — the ShaleYeah fleet's drilling engineering diligence agent.

Tier 2 ADK/Python intelligence layer over the [`servers/drilling`](../../servers/drilling) Tier 1 MCP server. It designs drilling programs, estimates well costs, and assesses drilling risks while deferring final AFE, spud, field-execution, and safety approval to human engineering review.

## ADK Project Boundary

This package is the Drilling Engineer ADK project inside the monorepo. ADK files live here (`agents-cli-manifest.yaml`, `.agents-cli-spec.md`, `pyproject.toml`, `app/agent.py`) and must not be added at repo root.

Current migration state:

- ADK owns the agent shape, instructions, eval path, architecture classification, HITL boundary, and backend-selection contract.
- Architecture mode is **Stand-alone Agent with Progressive Disclosure (Skills)**.
- ADK executes every current Drilling MCP tool through package-local Python wrappers.
- `servers/drilling` remains the independently runnable TypeScript MCP backend.
- There is no Drilling Engineer npm/package.json/TypeScript adapter surface in this package. If one reappears under `agents/drilling-engineer`, it is migration debt unless the issue is explicitly deleting it.

## Run A Drilling Task

```bash
cd agents/drilling-engineer
agents-cli install
DRILLING_MCP_URL=http://localhost:3003 agents-cli run \
  "Design a drilling program for a horizontal Wolfcamp well at 10000 ft"
```

Start the Drilling MCP server separately when you want live backend execution:

```bash
cd servers/drilling
PORT=3003 pnpm start
```

## Tools

| Tool | What it does | Type | HITL |
|------|--------------|------|------|
| `design_drilling_program` | Designs casing, mud, schedule, and program risk for a proposed well | Query | Defers final program/execution approval |
| `estimate_well_costs` | Estimates drilling, completion, facilities, total cost, cost/ft, and days | Query | Defers final AFE/capital approval |
| `assess_drilling_risks` | Assesses geological, operational, and environmental drilling risks | Query | Defers final safety/field approval |

## HITL Boundary

The agent may provide drilling diligence, provisional program design, cost ranges, risk assessment, and missing-input analysis. It must not approve a final drilling program, AFE, spud decision, field-execution instruction, or safety-critical plan without human engineering review.

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `DRILLING_MCP_URL` | `http://localhost:3003` | Drilling-compatible MCP backend URL |
| `DRILLING_ENGINEER_ADK_MODEL` | `gemini-flash-latest` | Local ADK model id |

## Commands

```bash
cd agents/drilling-engineer
uv run pytest
uv run python -m py_compile app/agent.py app/drilling_mcp.py
agents-cli info
agents-cli eval run
```

## Key Files

| File | Purpose |
|------|---------|
| [`agents-cli-manifest.yaml`](agents-cli-manifest.yaml) | agents-cli project marker |
| [`.agents-cli-spec.md`](.agents-cli-spec.md) | ADK reference-pair spec, architecture mode, HITL boundary, and migration notes |
| [`app/agent.py`](app/agent.py) | ADK `root_agent`, instructions, backend status, planning tool, and tool registration |
| [`app/drilling_mcp.py`](app/drilling_mcp.py) | Python MCP client wrappers for the Drilling backend |
| [`tests/eval/`](tests/eval) | ADK eval dataset and grading config |

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [How It Works](docs/HOW_IT_WORKS.md)
- [Development](docs/DEVELOPMENT.md)
- [Integration Guide](docs/INTEGRATION.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Local Testing](docs/LOCAL_TESTING.md)
