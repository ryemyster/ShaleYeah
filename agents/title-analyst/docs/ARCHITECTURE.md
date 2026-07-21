# Architecture — Title Analyst ADK Agent

`agents/title-analyst` is the package-local ADK/Python project for the Title Analyst role. The monorepo root remains workspace coordination only.

## Package Boundary

| Path | Purpose |
|------|---------|
| `agents-cli-manifest.yaml` | agents-cli project marker for this package |
| `.agents-cli-spec.md` | reference-pair spec and package boundary |
| `pyproject.toml` | Python ADK dependencies |
| `app/agent.py` | ADK `root_agent`, instructions, model choice, and tool registration |
| `app/title_mcp.py` | Python MCP client and Title execution wrappers |
| `tests/` | pytest shape tests plus ADK eval dataset/config |
| `servers/title` | independent TypeScript MCP backend |

The Title Analyst agent intentionally has no `package.json`, `tsconfig.json`, `biome.json`, `src/agent/`, or TypeScript agent tests. TypeScript/pnpm remains valid for the Title MCP server and shared workspace packages.

## Execution Path

```
ADK runner / agents-cli
  |
  v
app/agent.py
  |
  |-- title_backend_status()
  |-- plan_title_tool_call()
  |-- examine_title_ownership()
  |-- analyze_title_lease()
  |-- check_title_burdens()
  `-- trace_title_chain_of_title()
       |
       v
app/title_mcp.py
       |
       v
TITLE_MCP_URL, default http://localhost:3010
       |
       v
servers/title
```

## Tool Parity

| Title MCP tool | ADK Python wrapper |
|----------------|--------------------|
| `examine_ownership` | `examine_title_ownership` |
| `analyze_lease` | `analyze_title_lease` |
| `check_burdens` | `check_title_burdens` |
| `trace_chain_of_title` | `trace_title_chain_of_title` |

## Eval Harness

Behavior evals live under `tests/eval/`.

| File | Purpose |
|------|---------|
| `tests/eval/datasets/title-analyst-adk-reference.json` | Control, edge, and capability-boundary cases for ADK tool selection |
| `tests/eval/eval_config.yaml` | Deterministic hard-boundary checks plus LLM-judged response quality |

Run from `agents/title-analyst`:

```bash
agents-cli eval run
```

## Runtime Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `TITLE_MCP_URL` | `http://localhost:3010` | Title-compatible MCP backend URL |
| `TITLE_ANALYST_ADK_MODEL` | `gemini-flash-latest` | ADK model id for local runs |

The agent does not depend on the orchestrator or any other agent. It can run standalone as long as a compatible Title MCP backend is reachable when execution tools are invoked.
