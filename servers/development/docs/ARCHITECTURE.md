# Architecture — Development MCP Server

`servers/development` is the TypeScript MCP backend for field-development planning. It is independent from the ADK agent in `agents/development-planner`.

## Responsibilities

This server owns executable tool contracts, argument validation, deterministic fallbacks, and optional LLM synthesis for:

| Tool | Purpose |
|------|---------|
| `create_development_plan` | Draft a structured development plan from project reserves, location, well count, timeline, and constraints |
| `estimate_project_timeline` | Estimate phase sequence, duration, strategy, and critical-path risk |
| `monitor_development_progress` | Summarize project status from schedule, budget, safety, quality, or requested metrics |

The agent owns natural-language reasoning, tool choice, evals, and HITL deferral. The server does not approve final FDPs, FID, AFE/capital decisions, or execution commitments.

## Runtime Flow

```text
agents/development-planner
Python ADK agent
        |
        | Streamable HTTP MCP
        v
servers/development
TypeScript MCP server on PORT=3011
```

## Transport Modes

- stdio when `PORT` is not set.
- HTTP with `StreamableHTTPServerTransport` when `PORT=3011`.

## Key Modules

- `src/index.ts` registers MCP tools.
- `src/tools/planning.ts` derives development outlook and plan synthesis.
- `src/tools/phases.ts` derives phase timelines.
- `src/tools/monitoring.ts` derives progress reports.
