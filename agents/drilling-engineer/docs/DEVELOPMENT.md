# Development Guide — Drilling Engineer ADK Agent

## Prerequisites

```bash
uv
agents-cli
```

## Setup

```bash
cd agents/drilling-engineer
uv sync --extra eval
```

## ADK Package-Local Workflow

```bash
cd agents/drilling-engineer
agents-cli info
agents-cli install
agents-cli run "Design a drilling program for a horizontal Wolfcamp well"
agents-cli eval run
```

`app/agent.py` is the target authoring surface for Drilling Engineer reasoning, instructions, and ADK tools. `app/drilling_mcp.py` owns the ADK-side Drilling MCP execution paths.

## TDD Workflow

```bash
cd agents/drilling-engineer
uv run pytest
uv run python -m py_compile app/agent.py app/drilling_mcp.py
agents-cli info
```

## Test Suites

| File | What it tests | Live server needed? |
|------|--------------|-------------------|
| `tests/test_adk_project_shape.py` | Package-local ADK markers, root-boundary regression, and architecture mode | No |
| `tests/test_adk_mcp_execution_shape.py` | ADK-owned Drilling MCP execution boundaries | No |
| `tests/test_adk_eval_harness_shape.py` | ADK eval dataset/config shape and minimum case coverage | No |

## Adding A New Tool

1. Add or update the wrapper in `app/drilling_mcp.py`.
2. Register the wrapper in `app/agent.py`.
3. Make sure the corresponding tool exists in `servers/drilling/src/index.ts` or open an issue against that server.
4. Add or update pytest coverage under `tests/`.
5. Run `uv run pytest`, `uv run python -m py_compile app/agent.py app/drilling_mcp.py`, and `agents-cli info`.

## Safety Boundary

The agent can provide drilling diligence, provisional program design, cost estimates, and risk assessment. It must not present final AFE, spud, field-execution, or safety approval without human engineering review.
