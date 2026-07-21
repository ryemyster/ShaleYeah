# Title Analyst ADK Agent

**Titulus Verificatus** — the ShaleYeah fleet's title diligence analyst.

Tier 2 ADK/Python intelligence layer over the [`servers/title`](../../servers/title) Tier 1 MCP server. It examines ownership, lease terms, encumbrances, and chain of title, while deferring final legal-opinion language to human review.

## ADK Project Boundary

This package is the Title Analyst ADK project inside the monorepo. ADK files live here (`agents-cli-manifest.yaml`, `.agents-cli-spec.md`, `pyproject.toml`, `app/agent.py`) and must not be added at repo root.

Current migration state:

- ADK owns the agent shape, instructions, eval path, and backend-selection contract.
- ADK executes every current Title MCP tool through package-local Python wrappers.
- `servers/title` remains the independently runnable TypeScript MCP backend.
- There is no Title Analyst npm/package.json/TypeScript adapter surface in this package. If one reappears under `agents/title-analyst`, it is migration debt unless the issue is explicitly deleting it.

## Run A Title Task

```bash
cd agents/title-analyst
agents-cli install
TITLE_MCP_URL=http://localhost:3010 agents-cli run \
  "Examine ownership for Section 12, T2N, R4E in Reeves County, Texas"
```

Start the Title MCP server separately when you want live backend execution:

```bash
cd servers/title
PORT=3010 pnpm start
```

## Tools

| Tool | What it does | Type | Legal signoff? |
|------|--------------|------|----------------|
| `examine_title_ownership` | Calls `examine_ownership` for WI/NRI ownership diligence | query | No |
| `analyze_title_lease` | Calls `analyze_lease` for primary term and expiry diligence | query | No |
| `check_title_burdens` | Calls `check_burdens` for ORRI, liens, and encumbrances | query | No |
| `trace_title_chain_of_title` | Calls `trace_chain_of_title` for conveyance-chain and curative diligence | query | No |

The agent must not present final clean-title or legal approval without human review.

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `TITLE_MCP_URL` | No | `http://localhost:3010` | Title Tier 1 server URL |
| `TITLE_ANALYST_ADK_MODEL` | No | `gemini-flash-latest` | ADK model id for local runs |

## Commands

```bash
uv run pytest
uv run python -m py_compile app/agent.py app/title_mcp.py
agents-cli info
agents-cli run "Examine ownership for a tract"
agents-cli eval run
```

## Key Files

| Path | Purpose |
|------|---------|
| [`app/agent.py`](app/agent.py) | Package-local ADK entrypoint and Title backend-selection tools |
| [`app/title_mcp.py`](app/title_mcp.py) | Python MCP client and ADK-side execution tools |
| [`agents-cli-manifest.yaml`](agents-cli-manifest.yaml) | agents-cli project marker for this package only |
| [`.agents-cli-spec.md`](.agents-cli-spec.md) | ADK reference-pair spec and boundaries |
| [`tests/test_adk_project_shape.py`](tests/test_adk_project_shape.py) | Regression tests for package-local ADK shape and absence of npm surface |
| [`tests/test_adk_mcp_execution_shape.py`](tests/test_adk_mcp_execution_shape.py) | Regression tests for ADK-owned Title MCP execution |
| [`tests/test_adk_eval_harness_shape.py`](tests/test_adk_eval_harness_shape.py) | Regression tests for eval dataset/config coverage |

## Documentation

| Doc | Who it's for |
|-----|-------------|
| [HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md) | Plain-language flow and legal-review boundary |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Package topology and execution path |
| [INTEGRATION.md](docs/INTEGRATION.md) | Calling the ADK agent and backend contract |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Runtime pairing and environment variables |
| [LOCAL_TESTING.md](docs/LOCAL_TESTING.md) | Local smoke checks and evals |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | TDD workflow and adding tools |
