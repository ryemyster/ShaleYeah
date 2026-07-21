# Architecture — Risk Analyst ADK Agent

`agents/risk-analyst` is the package-local ADK/Python project for the Risk Analyst role. The monorepo root remains workspace coordination only.

## Package Boundary

| Path | Purpose |
|------|---------|
| `agents-cli-manifest.yaml` | agents-cli project marker for this package |
| `.agents-cli-spec.md` | reference-pair spec and package boundary |
| `pyproject.toml` | Python ADK dependencies |
| `app/agent.py` | ADK `root_agent`, instructions, model choice, and tool registration |
| `app/risk_analysis_mcp.py` | Python MCP client and Risk Analysis execution wrappers |
| `tests/` | pytest shape tests plus ADK eval dataset/config |
| `servers/risk-analysis` | independent TypeScript MCP backend |

The Risk Analyst agent intentionally has no `package.json`, `tsconfig.json`, `biome.json`, `src/agent/`, or TypeScript agent tests. TypeScript/pnpm remains valid for the Risk Analysis MCP server and shared workspace packages.

## Execution Path

```
ADK runner / agents-cli
  |
  v
app/agent.py
  |
  |-- risk_analysis_backend_status()
  |-- plan_risk_analysis_tool_call()
  |-- assess_investment_risk()
  `-- monte_carlo_simulation()
       |
       v
app/risk_analysis_mcp.py
       |
       v
RISK_ANALYSIS_MCP_URL, default http://localhost:3005
       |
       v
servers/risk-analysis
```

## Tool Parity

| Risk Analysis MCP tool | ADK Python wrapper |
|------------------------|--------------------|
| `assess_investment_risk` | `assess_investment_risk` |
| `monte_carlo_simulation` | `monte_carlo_simulation` |

## Eval Harness

Behavior evals live under `tests/eval/`.

| File | Purpose |
|------|---------|
| `tests/eval/datasets/risk-analyst-adk-reference.json` | Control, edge, and capability-boundary cases for ADK tool selection |
| `tests/eval/eval_config.yaml` | Deterministic hard-boundary checks plus LLM-judged response quality |

Run from `agents/risk-analyst`:

```bash
agents-cli eval run
```

## Runtime Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `RISK_ANALYSIS_MCP_URL` | `http://localhost:3005` | Risk Analysis-compatible MCP backend URL |
| `RISK_ANALYST_ADK_MODEL` | `gemini-flash-latest` | ADK model id for local runs |

The agent does not depend on the orchestrator or any other agent. It can run standalone as long as a compatible Risk Analysis MCP backend is reachable when execution tools are invoked.
