# Integration — Development MCP Server

The Development Planner ADK agent connects to this server over Streamable HTTP. Other MCP clients may call the same tools directly.

## Start HTTP Mode

```bash
cd servers/development
PORT=3011 pnpm start
```

## Agent Configuration

```bash
cd agents/development-planner
DEVELOPMENT_MCP_URL=http://localhost:3011 uv run pytest
```

The Python wrapper functions in `agents/development-planner/app/development_mcp.py` map Python-friendly arguments to the MCP JSON contract.

## Tool Contract Summary

| Tool | Key args |
|------|----------|
| `create_development_plan` | `project`, optional `timeline`, `constraints`, `outputPath`, `matchThreshold` |
| `estimate_project_timeline` | `projectName`, `wellCount`, `budget`, optional `constraints`, `matchThreshold` |
| `monitor_development_progress` | `projectId`, optional `metrics`, `reportingPeriod`, `outputPath` |

See `src/index.ts` for the source-of-truth schemas.
