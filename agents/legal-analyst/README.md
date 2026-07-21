# Legal Analyst ADK Agent

**Legatus Juridicus** — the ShaleYeah fleet's legal diligence analyst.

Tier 2 ADK/Python intelligence layer over the [`servers/legal`](../../servers/legal) Tier 1 MCP server. It analyzes regulatory exposure, contract risk, and compliance requirements while deferring binding legal actions to human/legal review.

## ADK Project Boundary

This package is the Legal Analyst ADK project inside the monorepo. ADK files live here (`agents-cli-manifest.yaml`, `.agents-cli-spec.md`, `pyproject.toml`, `app/agent.py`) and must not be added at repo root.

Current migration state:

- ADK owns the agent shape, instructions, eval path, architecture classification, HITL boundary, and backend-selection contract.
- Architecture mode is **Stand-alone Agent with Progressive Disclosure (Skills)**.
- ADK executes every current Legal MCP tool through package-local Python wrappers.
- `servers/legal` remains the independently runnable TypeScript MCP backend.
- There is no Legal Analyst npm/package.json/TypeScript adapter surface in this package. If one reappears under `agents/legal-analyst`, it is migration debt unless the issue is explicitly deleting it.

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

## Commands

```bash
uv run pytest
uv run python -m py_compile app/agent.py app/legal_mcp.py
agents-cli info
agents-cli run "Analyze legal exposure for a Texas development project"
agents-cli eval run
```

## Key Files

| Path | Purpose |
|------|---------|
| [`app/agent.py`](app/agent.py) | Package-local ADK entrypoint and Legal backend-selection tools |
| [`app/legal_mcp.py`](app/legal_mcp.py) | Python MCP client and ADK-side execution tools |
| [`agents-cli-manifest.yaml`](agents-cli-manifest.yaml) | agents-cli project marker for this package only |
| [`.agents-cli-spec.md`](.agents-cli-spec.md) | ADK reference-pair spec, architecture mode, HITL boundary, and migration notes |
| [`tests/test_adk_project_shape.py`](tests/test_adk_project_shape.py) | Regression tests for package-local ADK shape, architecture classification, and absence of npm surface |
| [`tests/test_adk_mcp_execution_shape.py`](tests/test_adk_mcp_execution_shape.py) | Regression tests for ADK-owned Legal MCP execution |
| [`tests/test_adk_eval_harness_shape.py`](tests/test_adk_eval_harness_shape.py) | Regression tests for eval dataset/config coverage |
