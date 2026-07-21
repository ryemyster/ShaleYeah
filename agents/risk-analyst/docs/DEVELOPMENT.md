# Development Guide — Risk Analyst ADK Agent

## Prerequisites

```bash
uv
agents-cli
```

## Setup

```bash
cd agents/risk-analyst
uv sync --extra eval
```

## ADK Package-Local Workflow

```bash
cd agents/risk-analyst
agents-cli info
agents-cli install
agents-cli run "Assess investment risk for a Wolfcamp project"
agents-cli eval run
```

`app/agent.py` is the target authoring surface for Risk Analyst reasoning, instructions, and ADK tools. `app/risk_analysis_mcp.py` owns the ADK-side Risk Analysis MCP execution paths.

This package intentionally has no npm/package.json/TypeScript agent surface. `servers/risk-analysis` may remain TypeScript/pnpm; the Risk Analyst agent itself is ADK/Python.

## TDD Workflow

```bash
cd agents/risk-analyst
uv run pytest
uv run python -m py_compile app/agent.py app/risk_analysis_mcp.py
agents-cli info
```

## Test Suites

| File | What it tests | Live server needed? |
|------|--------------|-------------------|
| `tests/test_adk_project_shape.py` | Package-local ADK markers, root-boundary regression, and no dangling npm surface | No |
| `tests/test_adk_mcp_execution_shape.py` | ADK-owned Risk Analysis MCP execution boundaries | No |
| `tests/test_adk_eval_harness_shape.py` | ADK eval dataset/config shape and minimum case coverage | No |

## Adding A New Tool

1. Add or update the wrapper in `app/risk_analysis_mcp.py`.
2. Register the wrapper in `app/agent.py`.
3. Make sure the corresponding tool exists in `servers/risk-analysis/src/index.ts` or open an issue against that server.
4. Add or update pytest coverage under `tests/`.
5. Run `uv run pytest`, `uv run python -m py_compile app/agent.py app/risk_analysis_mcp.py`, and `agents-cli info`.

## Safety Boundary

The agent can provide risk diligence and simulation outputs. It must not present final investment approval without human review.
