# Infrastructure Planner

The Infrastructure Planner is the ADK agent for oil and gas surface and midstream feasibility. It helps evaluate whether a development plan can move hydrocarbons and associated fluids from wells to market without pipelines, facilities, water handling, right-of-way, permitting, safety, or environmental constraints becoming the bottleneck.

It does not approve final pipeline routes, facility layouts, construction, AFE/capital spend, procurement, right-of-way or easement decisions, midstream commercial commitments, permit certifications, PHMSA safety compliance, UIC/Class II disposal approvals, environmental conclusions, public disclosures, or sensitive memory promotion. Those decisions need qualified human review.

## What This Package Contains

| Path | Purpose |
|------|---------|
| `app/agent.py` | ADK root agent, instructions, architecture marker, and tool list |
| `app/infrastructure_mcp.py` | Python MCP client wrappers for `servers/infrastructure` |
| `tests/` | pytest coverage for package shape, MCP wrapper parity, and eval harness shape |
| `tests/eval/` | ADK eval dataset and metric config for control, edge, and boundary cases |
| `agents-cli-manifest.yaml` | package-local Agents CLI manifest |

`servers/infrastructure` is the TypeScript MCP backend. This agent package is Python/ADK; backend tool implementation work belongs in the server package.

## How It Works

The agent runs as a stand-alone specialist with progressive disclosure of its Infrastructure MCP tools. It decides whether the user needs:

- `plan_pipeline` for gathering, routing, capacity, and takeaway-risk work.
- `size_facilities` for tank batteries, separators, compression, and saltwater-disposal sizing.
- `estimate_costs` for pipeline, facility, compression, and SWD CAPEX.
- `assess_compliance` for permitting, safety, environmental, ROW, and regulatory review support.

The default MCP backend URL is `http://localhost:3012`. Set `INFRASTRUCTURE_MCP_URL` to point at another compatible Infrastructure MCP server.

## Run Locally

```bash
cd agents/infrastructure-planner
uv run pytest
```

To exercise the MCP path, start the backend separately:

```bash
cd servers/infrastructure
PORT=3012 pnpm start
```

Then run ADK or pytest commands from `agents/infrastructure-planner`.

## Environment

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `INFRASTRUCTURE_MCP_URL` | No | `http://localhost:3012` | Infrastructure MCP backend URL |
| `INFRASTRUCTURE_PLANNER_ADK_MODEL` | No | `gemini-flash-latest` | ADK model for the root agent |

Provider credentials are supplied by the ADK runtime or deployment environment. Do not check secrets, proprietary midstream data, ROW terms, or confidential asset details into this package.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [How It Works](docs/HOW_IT_WORKS.md)
- [Development](docs/DEVELOPMENT.md)
- [Integration Guide](docs/INTEGRATION.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Local Testing](docs/LOCAL_TESTING.md)
