# Development Guide — Geologist ADK Agent

## Prerequisites

```bash
uv
agents-cli
```

## Setup

```bash
cd agents/geologist
uv sync --extra eval
```

## ADK package-local workflow

This directory is an ADK project. The repo root is not.

```bash
cd agents/geologist
agents-cli info
agents-cli install      # installs Python ADK dependencies when needed
agents-cli run "Assess the data quality of sample.las"
agents-cli eval run     # runs the package-local ADK eval harness
```

`app/agent.py` is the target authoring surface for Geologist reasoning, instructions, and ADK tools. `app/geowiz_mcp.py` owns the ADK-side Geowiz MCP execution paths for every current Geowiz tool.

## TDD workflow

This package follows strict TDD: tests are written before implementation. Geologist agent tests use pytest and must not require a live Geowiz server unless they skip gracefully when it is absent.

```bash
cd agents/geologist
uv run pytest
uv run python -m py_compile app/agent.py app/geowiz_mcp.py
agents-cli info
```

## Test suites

| File | What it tests | Live server needed? |
|------|--------------|-------------------|
| `tests/test_adk_project_shape.py` | Package-local ADK markers and root-boundary regression | No |
| `tests/test_adk_mcp_execution_shape.py` | ADK-owned Geowiz MCP execution boundaries | No |
| `tests/test_adk_eval_harness_shape.py` | ADK eval dataset/config shape and minimum case coverage | No |

## Adding a new tool

1. Add or update the wrapper in `app/geowiz_mcp.py`.
2. Register the wrapper in `app/agent.py`.
3. Make sure the corresponding tool exists in `servers/geowiz/src/index.ts` or open an issue against geowiz.
4. Add or update pytest coverage under `tests/`.
5. Run `uv run pytest`, `uv run python -m py_compile app/agent.py app/geowiz_mcp.py`, and `agents-cli info`.

## Changing HITL policy

`save_geowiz_finding` is registered as `FunctionTool(save_geowiz_finding, require_confirmation=True)` in `app/agent.py`. Keep persistence and other write-like operations behind ADK confirmation.

## Changing model routing

`GEOLOGIST_ADK_MODEL` controls the ADK model for local runs. The default is `gemini-flash-latest`.

## Lint

```bash
cd agents/geologist && uv run ruff check .
```

## Type checking

```bash
cd agents/geologist && uv run python -m py_compile app/agent.py app/geowiz_mcp.py
```

## Adding a custom audit logger (e.g. Supabase)

Add durable audit logging at the ADK tool/orchestration boundary when a production runtime issue requires it.

---

## See also

- [README](../README.md) — quick start, tool table, commands
- [ARCHITECTURE.md](ARCHITECTURE.md) — topology, execution paths, Arcade patterns
- [HOW_IT_WORKS.md](HOW_IT_WORKS.md) — five-component framework, plain-language explanation
- [INTEGRATION.md](INTEGRATION.md) — calling this agent from your code
- [DEPLOYMENT.md](DEPLOYMENT.md) — production deployment, Docker, Kong, BYOE model routing
- [LOCAL_TESTING.md](LOCAL_TESTING.md) — running both processes locally, HITL testing
