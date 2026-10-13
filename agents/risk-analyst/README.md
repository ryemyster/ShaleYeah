# Risk Analyst ADK Agent

**Gaius Probabilis Assessor** — the ShaleYeah fleet's risk diligence analyst.

Tier 2 ADK/Python intelligence layer over the [`servers/risk-analysis`](../../servers/risk-analysis) Tier 1 MCP server. It assesses investment risk, runs Monte Carlo uncertainty analysis, and explains missing context that should block overconfident decisions.

## What It Does

Risk Analyst turns risk diligence questions into the right Risk Analysis MCP tool call, sends structured project and uncertainty inputs to the backend, and explains risk scores, Monte Carlo outputs, and missing context.

It exists so investment workflows can compare uncertainty and downside exposure without letting the agent approve final investment decisions.

## Project Boundary

This package is the Risk Analyst ADK project inside the monorepo. ADK files live here (`agents-cli-manifest.yaml`, `.agents-cli-spec.md`, `pyproject.toml`, `app/agent.py`) and must not be added at repo root.

At runtime:

- ADK owns the agent shape, instructions, eval path, and backend-selection contract.
- Architecture mode is **Stand-alone Agent with Progressive Disclosure (Skills)**.
- The agent calls the Risk Analysis MCP backend through package-local Python wrappers.
- `servers/risk-analysis` is the independently runnable MCP backend.

## Run A Risk Task

```bash
cd agents/risk-analyst
agents-cli install
RISK_ANALYSIS_MCP_URL=http://localhost:3005/mcp RISK_ANALYSIS_MCP_ACCESS_TOKEN_FILE=/path/to/private/mcp-token agents-cli run \
  "Assess investment risk for a Wolfcamp project with moderate risk profile and standard depth"
```

Start the Risk Analysis MCP server separately when you want live backend execution:

```bash
cd servers/risk-analysis
PORT=3005 pnpm start
```

The backend uses the selected MCP 2026-07-28 profile. Replace `/path/to/private/mcp-token` with an operator-issued credential file owned by your account and readable/writable only by you. Credentials are resolved when a tool runs and stay outside prompts. Use HTTPS for a remote endpoint; local HTTP is limited to loopback. Missing or denied credentials stop the call. An HTTP server needs explicit identity/scope and audit configuration; setting `PORT` alone does not supply that setup. The role-specific operator workflow and source qualification remain pending in the linked employee adoption issue.

## Tools

| Tool | What it does | Type | Final approval? |
|------|--------------|------|-----------------|
| `assess_investment_risk` | Scores geological, technical, economic, regulatory, environmental, and operational risk | query | No |
| `monte_carlo_simulation` | Runs uncertainty simulation over price, production, decline, and capex variables | query | No |

## HITL Boundary

The agent must not present final investment approval without human review.

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `RISK_ANALYSIS_MCP_URL` | No | `http://localhost:3005/mcp` | Risk Analysis Tier 1 server URL |
| `RISK_ANALYSIS_MCP_ACCESS_TOKEN_FILE` | Yes for tool calls | None | Private file containing the operator-issued credential for this backend |
| `RISK_ANALYSIS_MCP_TIMEOUT_SECONDS` | No | `30` | Total connection/call budget, greater than zero and at most 120 seconds |
| `RISK_ANALYSIS_MCP_REQUEST_TIMEOUT_SECONDS` | No | `10` | Per-request budget, greater than zero and at most 120 seconds |
| `RISK_ANALYST_ADK_MODEL` | No | `gemini-flash-latest` | ADK model id for local runs |

## Build, Test, And Use

Run these from `agents/risk-analyst`.

| Task | Command |
|------|---------|
| Install dependencies | `uv sync --extra eval` |
| Test package behavior | `uv run pytest` |
| Build/syntax check | `uv run python -m py_compile app/agent.py app/risk_analysis_mcp.py` |
| Inspect ADK project | `agents-cli info` |
| Run a local task | `RISK_ANALYSIS_MCP_URL=http://localhost:3005/mcp RISK_ANALYSIS_MCP_ACCESS_TOKEN_FILE=/path/to/private/mcp-token agents-cli run "Assess investment risk for a project"` |
| Run evals | `agents-cli eval run` |

## Key Files

| Path | Purpose |
|------|---------|
| [`app/agent.py`](app/agent.py) | Package-local ADK entrypoint and Risk Analysis backend-selection tools |
| [`app/risk_analysis_mcp.py`](app/risk_analysis_mcp.py) | Python MCP client and ADK-side execution tools |
| [`agents-cli-manifest.yaml`](agents-cli-manifest.yaml) | agents-cli project marker for this package only |
| [`.agents-cli-spec.md`](.agents-cli-spec.md) | ADK reference-pair spec and boundaries |
| [`tests/test_adk_project_shape.py`](tests/test_adk_project_shape.py) | Regression tests for package-local ADK shape |
| [`tests/test_adk_mcp_execution_shape.py`](tests/test_adk_mcp_execution_shape.py) | Regression tests for ADK-owned Risk Analysis MCP execution |
| [`tests/test_adk_eval_harness_shape.py`](tests/test_adk_eval_harness_shape.py) | Regression tests for eval dataset/config coverage |

## Documentation

| Doc | Who it's for |
|-----|-------------|
| [HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md) | Plain-language flow and safety boundary |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Package topology and execution path |
| [INTEGRATION.md](docs/INTEGRATION.md) | Calling the ADK agent and backend contract |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Runtime pairing and environment variables |
| [LOCAL_TESTING.md](docs/LOCAL_TESTING.md) | Local smoke checks and evals |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | TDD workflow and adding tools |
