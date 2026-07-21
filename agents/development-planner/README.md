# Development Planner

The Development Planner is the ADK agent for field-development planning. It helps turn reserves, well count, location, capital limits, schedule goals, and operating constraints into draft development plans, phase timelines, and progress summaries.

It does not approve final field development plans, FID, AFE/capital authorization, drilling sequence authorization, facility execution, regulatory submissions, or external commitments. Those decisions need qualified human review.

## What This Package Contains

| Path | Purpose |
|------|---------|
| `app/agent.py` | ADK root agent, instructions, architecture marker, and tool list |
| `app/development_mcp.py` | Python MCP client wrappers for `servers/development` |
| `tests/` | pytest coverage for package shape, MCP wrapper parity, and eval harness shape |
| `tests/eval/` | ADK eval dataset and metric config for control, edge, and boundary cases |
| `agents-cli-manifest.yaml` | package-local Agents CLI manifest |

`servers/development` remains the TypeScript MCP backend. This agent package is Python/ADK; TypeScript implementation work belongs in the backend package.

## How It Works

The agent runs as a stand-alone specialist with progressive disclosure of its Development MCP tools. It decides whether the user needs:

- `create_development_plan` for draft field-development plan options.
- `estimate_project_timeline` for schedule, phase, milestone, or critical-path work.
- `monitor_development_progress` for schedule, budget, safety, and quality status.

The default MCP backend URL is `http://localhost:3011`. Set `DEVELOPMENT_MCP_URL` to point at another compatible Development MCP server.

## Run Locally

```bash
cd agents/development-planner
uv run pytest
```

To exercise the MCP path, start the backend separately:

```bash
cd servers/development
PORT=3011 pnpm start
```

Then run ADK or pytest commands from `agents/development-planner`.

## Environment

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `DEVELOPMENT_MCP_URL` | No | `http://localhost:3011` | Development MCP backend URL |
| `DEVELOPMENT_PLANNER_ADK_MODEL` | No | `gemini-flash-latest` | ADK model for the root agent |

Provider credentials are supplied by the ADK runtime or deployment environment. Do not check secrets into this package.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [How It Works](docs/HOW_IT_WORKS.md)
- [Development](docs/DEVELOPMENT.md)
- [Integration Guide](docs/INTEGRATION.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Local Testing](docs/LOCAL_TESTING.md)
