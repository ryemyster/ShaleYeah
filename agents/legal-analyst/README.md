# Legal Analyst ADK Agent

**Legatus Juridicus** — the ShaleYeah fleet's legal diligence analyst.

Tier 2 ADK/Python intelligence layer over the [`servers/legal`](../../servers/legal) Tier 1 MCP server. It analyzes regulatory exposure, contract risk, and compliance requirements while deferring binding legal actions to human/legal review.

## What It Does

Legal Analyst turns legal diligence requests into the right Legal MCP tool call, sends structured jurisdiction, project, contract, or compliance inputs to the backend, and explains the returned exposure or risk result.

It exists so diligence workflows can identify legal issues early while keeping legal opinions, filings, signatures, and binding decisions with qualified human/legal reviewers.

## Project Boundary

This package is the Legal Analyst ADK project inside the monorepo. ADK files live here (`agents-cli-manifest.yaml`, `.agents-cli-spec.md`, `pyproject.toml`, `app/agent.py`) and must not be added at repo root.

At runtime:

- ADK owns the agent shape, instructions, eval path, architecture classification, HITL boundary, and backend selection.
- Architecture mode is **Stand-alone Agent with Progressive Disclosure (Skills)**.
- The agent calls the Legal MCP backend through package-local Python wrappers.
- `servers/legal` is the independently runnable MCP backend.

## Run A Legal Task

```bash
cd agents/legal-analyst
agents-cli install
LEGAL_MCP_URL=http://localhost:3006 agents-cli run \
  "Analyze regulatory exposure for a Texas development project covering three Permian leases"
```

Start the Legal MCP server separately when you want live backend execution:

```bash
cd servers/legal
PORT=3006 pnpm start
```

## Tools

| Tool | What it does | Type | Final approval? |
|------|--------------|------|-----------------|
| `analyze_legal_framework` | Calls `analyze_legal_framework` for jurisdiction/project legal exposure | query | No |
| `review_contract` | Calls `review_contract` for contract-risk diligence | query | No |
| `assess_compliance` | Calls `assess_compliance` for environmental, safety, and tax requirements | query | No |

## HITL Boundary

The agent may support diligence. It must defer to human/legal review for legal opinions, contract redlines, contract approval, signatures, filings, regulatory submissions, waivers, settlement positions, enforcement decisions, or any binding approval/authorization.

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `LEGAL_MCP_URL` | No | `http://localhost:3006` | Legal Tier 1 server URL |
| `LEGAL_ANALYST_ADK_MODEL` | No | `gemini-flash-latest` | ADK model id for local runs |

## Build, Test, And Use

Run these from `agents/legal-analyst`.

| Task | Command |
|------|---------|
| Install dependencies | `uv sync --extra eval` |
| Test package behavior | `uv run pytest` |
| Build/syntax check | `uv run python -m py_compile app/agent.py app/legal_mcp.py` |
| Inspect ADK project | `agents-cli info` |
| Run a local task | `LEGAL_MCP_URL=http://localhost:3006 agents-cli run "Analyze legal exposure for a Texas development project"` |
| Run evals | `agents-cli eval run` |

## Key Files

| Path | Purpose |
|------|---------|
| [`app/agent.py`](app/agent.py) | Package-local ADK entrypoint and Legal backend-selection tools |
| [`app/legal_mcp.py`](app/legal_mcp.py) | Python MCP client and ADK-side execution tools |
| [`agents-cli-manifest.yaml`](agents-cli-manifest.yaml) | agents-cli project marker for this package only |
| [`.agents-cli-spec.md`](.agents-cli-spec.md) | ADK reference-pair spec, architecture mode, HITL boundary, and package constraints |
| [`tests/test_adk_project_shape.py`](tests/test_adk_project_shape.py) | Regression tests for package-local ADK shape and architecture classification |
| [`tests/test_adk_mcp_execution_shape.py`](tests/test_adk_mcp_execution_shape.py) | Regression tests for ADK-owned Legal MCP execution |
| [`tests/test_adk_eval_harness_shape.py`](tests/test_adk_eval_harness_shape.py) | Regression tests for eval dataset/config coverage |
