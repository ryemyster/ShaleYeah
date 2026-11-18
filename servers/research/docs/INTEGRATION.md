# Integration — Research MCP Server

The Research Analyst ADK agent connects to this server over Streamable HTTP. Other MCP clients may call the same tools directly.

## Start HTTP Mode

```bash
cd servers/research
PORT=3008 pnpm start
```

## Agent Configuration

```bash
cd agents/research-analyst
RESEARCH_MCP_URL=http://localhost:3008 uv run pytest
```

The Python wrapper functions in `agents/research-analyst/app/research_mcp.py` map Python-friendly arguments to the MCP JSON contract.

## Tool Contract Summary

| Tool | Key args |
|------|----------|
| `conduct_market_research` | `topic`, optional `scope`, `timeframe`, `sources`, `outputPath` |
| `analyze_competition` | `region`, optional `competitors`, `analysisType`, `timeframe`, `outputPath`, `matchThreshold` |

See `src/index.ts` for the source-of-truth schemas.
