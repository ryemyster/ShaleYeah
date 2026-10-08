# Development Guide — Geologist ADK Agent

## Prerequisites

```bash
uv
agents-cli
```

## Setup

```bash
cd agents/geologist
uv sync --frozen --extra eval
```

## ADK package-local workflow

This directory is an ADK project. The repo root is not.

```bash
cd agents/geologist
agents-cli info
agents-cli eval run --help
```

Follow [the ordered pair setup](../../../docs/deployment-support.md#run-the-current-reference-locally)
before a live task, and [the eval steps](LOCAL_TESTING.md#run-adk-evals) before
inference/grading. Do not rely on the CLI's generic default dataset: this
package's actual file is `tests/eval/datasets/geologist-adk-reference.json`.

`app/agent.py` is the target authoring surface for Geologist reasoning, instructions, and ADK tools. `app/geowiz_mcp.py` owns the ADK-side Geowiz MCP execution paths for every current Geowiz tool.

## TDD workflow

This package follows strict TDD: tests are written before implementation.
Deterministic pytest fixtures run without a live Geowiz server or provider key.
Live integration/evals have explicit prerequisites and separate results; missing
configuration is an unrun case, not a successful evaluation.

```bash
cd agents/geologist
uv run --frozen pytest -q
uv run --frozen python -m py_compile app/agent.py app/geowiz_mcp.py
agents-cli info
```

## Test suites

| File | What it tests | Live server needed? |
|------|--------------|-------------------|
| `tests/test_adk_project_shape.py` | Package-local ADK markers and root-boundary regression | No |
| `tests/test_adk_mcp_execution_shape.py` | ADK-owned Geowiz MCP execution boundaries | No |
| `tests/test_adk_eval_harness_shape.py` | ADK eval dataset/config shape and minimum case coverage | No |

These are shape/regression checks. They do not run the live employee or certify
domain correctness, direct MCP authority or durable review/resume. Record
those results separately; the MVP plan assigns their implementation owners.

## Adding a new tool

1. Start an approved issue and define failing contract/execution tests plus
   control, edge and authority-boundary eval cases.
2. Verify the corresponding Geowiz tool contract; if absent, deliver its owning
   issue first rather than assuming a wrapper supplies backend behavior.
3. Add/update the wrapper in `app/geowiz_mcp.py` and register it in `app/agent.py`.
4. Run package-local pytest, syntax/import and project checks, then configured
   behavior evals when ready. Delete any displaced wrapper/path in the same PR.

## Changing HITL policy

`save_geowiz_finding` is registered as `FunctionTool(save_geowiz_finding, require_confirmation=True)` in `app/agent.py`. Keep persistence and other write-like operations behind ADK confirmation. The executing MCP backend must separately
enforce identity/scopes and reviewed revisions; this UI confirmation alone does
not protect direct callers. Follow [deployment state/review limits](DEPLOYMENT.md#state-and-human-review).

## Changing model routing

`GEOLOGIST_ADK_MODEL` controls the ADK model for local runs. The default is `gemini-flash-latest`.

## Lint

```bash
uv sync --frozen --extra eval --extra lint
uv run --frozen ruff check .
```

Run from `agents/geologist`. The lint extra supplies Ruff; preserve eval
dependencies when syncing the same environment. A syntax check is not a type
analysis or behavior eval.

## Syntax checking

```bash
uv run --frozen python -m py_compile app/agent.py app/geowiz_mcp.py
```

## Adding a custom audit logger (e.g. Supabase)

Add durable audit logging at the ADK tool/orchestration boundary when a production runtime issue requires it.

---

## See also

- [README](../README.md) — quick start, tool table, commands
- [ARCHITECTURE.md](ARCHITECTURE.md) — topology, execution paths, Arcade patterns
- [HOW_IT_WORKS.md](HOW_IT_WORKS.md) — five-component framework, plain-language explanation
- [INTEGRATION.md](INTEGRATION.md) — calling this agent from your code
- [DEPLOYMENT.md](DEPLOYMENT.md) — local setup, state/review requirements and deployment evidence
- [LOCAL_TESTING.md](LOCAL_TESTING.md) — running both processes locally, HITL testing
