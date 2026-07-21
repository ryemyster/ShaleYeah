# How It Works — Geologist ADK Agent

The Geologist agent is the reasoning layer for geological diligence. It decides which Geowiz tool to use, calls that tool through MCP, and explains the result.

## Plain Language Flow

1. You ask a geology question or request processing for a file.
2. The ADK agent chooses a matching Geowiz tool.
3. `app/geowiz_mcp.py` sends the request to the configured Geowiz MCP server.
4. The agent receives the tool result and responds.
5. If the agent wants to save a finding, ADK confirmation is required first.

## The Two Pieces

| Piece | What it does |
|-------|--------------|
| Geologist agent | ADK/Python reasoning, tool choice, instructions, and eval behavior |
| Geowiz server | TypeScript MCP backend that parses logs, GIS, documents, seismic data, databases, and findings |

This split is intentional. Agents are ADK/Python. Servers may remain TypeScript/pnpm.

## Safety Boundary

`save_geowiz_finding` is registered with ADK confirmation. That keeps durable memory writes behind a human approval step while read-only geology tools can run without write approval.

## Configuration

`GEOWIZ_MCP_URL` points the agent at the backend. The default is `http://localhost:3001`.

`GEOLOGIST_ADK_MODEL` sets the local ADK model id. The default is `gemini-flash-latest`.
