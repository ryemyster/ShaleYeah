# Drilling Engineer ADK Agent

**Perforator Maximus** — the ShaleYeah fleet's drilling engineering diligence agent.

Tier 2 ADK/Python intelligence layer over the [`servers/drilling`](../../servers/drilling) Tier 1 MCP server. It designs drilling programs, estimates well costs, and assesses drilling risks while deferring final AFE, spud, field-execution, and safety approval to human engineering review.

## What It Does

Drilling Engineer turns a drilling diligence request into the right MCP tool call, sends structured well parameters to the Drilling backend, and explains the returned program, cost, or risk result in engineering language.

It exists so investment and development workflows can ask one specialist for drilling feasibility, expected cost, schedule risk, and missing-input analysis without giving the agent authority to approve field execution.

## Project Boundary

This package is the Drilling Engineer ADK project inside the monorepo. ADK files live here (`agents-cli-manifest.yaml`, `.agents-cli-spec.md`, `pyproject.toml`, `app/agent.py`) and must not be added at repo root.

At runtime:

- ADK owns the agent shape, instructions, eval path, architecture classification, HITL boundary, and backend selection.
- Architecture mode is **Stand-alone Agent with Progressive Disclosure (Skills)**.
- The agent calls the Drilling MCP backend through package-local Python wrappers.
- `servers/drilling` is the independently runnable MCP backend.

## Run A Drilling Task

```bash
cd agents/drilling-engineer
agents-cli install
DRILLING_MCP_URL=http://localhost:3003/mcp DRILLING_MCP_ACCESS_TOKEN_FILE=/path/to/private/mcp-token agents-cli run \
  "Design a drilling program for a horizontal Wolfcamp well at 10000 ft"
```

Start the Drilling MCP server separately when you want live backend execution:

```bash
cd servers/drilling
PORT=3003 pnpm start
```

The backend uses the selected MCP 2026-07-28 profile. Replace `/path/to/private/mcp-token` with an operator-issued credential file owned by your account and readable/writable only by you. Credentials are resolved when a tool runs and stay outside prompts. Use HTTPS for a remote endpoint; local HTTP is limited to loopback. Missing or denied credentials stop the call. An HTTP server needs explicit identity/scope and audit configuration; setting `PORT` alone does not supply that setup. The role-specific operator workflow and source qualification remain pending in the linked employee adoption issue.

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
| `DRILLING_MCP_URL` | `http://localhost:3003/mcp` | Drilling-compatible MCP backend URL |
| `DRILLING_MCP_ACCESS_TOKEN_FILE` | Yes for tool calls | None | Private file containing the operator-issued credential for this backend |
| `DRILLING_MCP_TIMEOUT_SECONDS` | No | `30` | Total connection/call budget, greater than zero and at most 120 seconds |
| `DRILLING_MCP_REQUEST_TIMEOUT_SECONDS` | No | `10` | Per-request budget, greater than zero and at most 120 seconds |
| `DRILLING_ENGINEER_ADK_MODEL` | `gemini-flash-latest` | Local ADK model id |

## Build, Test, And Use

Run these from `agents/drilling-engineer`.

| Task | Command |
|------|---------|
| Install dependencies | `uv sync --extra eval` |
| Test package behavior | `uv run pytest` |
| Build/syntax check | `uv run python -m py_compile app/agent.py app/drilling_mcp.py` |
| Inspect ADK project | `agents-cli info` |
| Run a local task | `DRILLING_MCP_URL=http://localhost:3003/mcp DRILLING_MCP_ACCESS_TOKEN_FILE=/path/to/private/mcp-token agents-cli run "Assess drilling risks for a horizontal Wolfcamp well"` |
| Run evals | `agents-cli eval run` |

## Key Files

| File | Purpose |
|------|---------|
| [`agents-cli-manifest.yaml`](agents-cli-manifest.yaml) | agents-cli project marker |
| [`.agents-cli-spec.md`](.agents-cli-spec.md) | ADK reference-pair spec, architecture mode, HITL boundary, and package constraints |
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
