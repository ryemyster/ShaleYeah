# Integration

Integrate with the Development Planner as an ADK app. Integrate with `servers/development` when you need deterministic MCP tool execution without agent reasoning.

## Agent Entry Point

The ADK entry point is:

```text
agents/development-planner/app/agent.py
```

It exports:

- `root_agent`
- `app`
- `development_backend_status`
- `plan_development_tool_call`

The MCP wrappers live in:

```text
agents/development-planner/app/development_mcp.py
```

## Backend Contract

The agent calls these MCP tools through Streamable HTTP:

- `create_development_plan`
- `estimate_project_timeline`
- `monitor_development_progress`

Set `DEVELOPMENT_MCP_URL` when the backend is not running at `http://localhost:3011`.

## Upstream And Downstream Context

Common upstream inputs:

- Geologist: formations, reservoir quality, well log context
- Reservoir Engineer: reserves, type curves, recovery assumptions
- Drilling Engineer: well design and drillability constraints
- Infrastructure Planner: facility, pipeline, and surface constraints
- Legal and Title: ownership, lease, regulatory, and commitment limits
- Economist and Risk Analyst: capital, scenario, uncertainty, and risk context

Common downstream consumers:

- Drilling schedules and well sequencing
- Infrastructure planning
- economic model timing
- risk review
- investment committee material

The agent can summarize these dependencies, but it should not claim cross-agent facts unless they were provided or fetched through approved tools.
