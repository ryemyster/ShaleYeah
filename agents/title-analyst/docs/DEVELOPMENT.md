# Development Guide — Title Analyst ADK Agent

## Prerequisites

```bash
uv
agents-cli
```

## Setup

```bash
cd agents/title-analyst
uv sync --extra eval
```

## ADK Package-Local Workflow

```bash
cd agents/title-analyst
agents-cli info
agents-cli install
agents-cli run "Examine ownership for Section 12 in Reeves County, Texas"
agents-cli eval run
```

`app/agent.py` is the target authoring surface for Title Analyst reasoning, instructions, and ADK tools. `app/title_mcp.py` owns the ADK-side Title MCP execution paths.

This package intentionally has no npm/package.json/TypeScript agent surface. `servers/title` may remain TypeScript/pnpm; the Title Analyst agent itself is ADK/Python.

## TDD Workflow

```bash
cd agents/title-analyst
uv run pytest
uv run python -m py_compile app/agent.py app/title_mcp.py
agents-cli info
```

## Test Suites

| File | What it tests | Live server needed? |
|------|--------------|-------------------|
| `tests/test_adk_project_shape.py` | Package-local ADK markers, root-boundary regression, and no dangling npm surface | No |
| `tests/test_adk_mcp_execution_shape.py` | ADK-owned Title MCP execution boundaries | No |
| `tests/test_adk_eval_harness_shape.py` | ADK eval dataset/config shape and minimum case coverage | No |

## Adding A New Tool

1. Add or update the wrapper in `app/title_mcp.py`.
2. Register the wrapper in `app/agent.py`.
3. Make sure the corresponding tool exists in `servers/title/src/index.ts` or open an issue against that server.
4. Add or update pytest coverage under `tests/`.
5. Run `uv run pytest`, `uv run python -m py_compile app/agent.py app/title_mcp.py`, and `agents-cli info`.

## Safety Boundary

The agent can provide title diligence and curative guidance. It must not present final clean-title or legal approval without human legal or land review.
