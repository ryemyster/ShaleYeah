# How It Works - Market Analyst ADK Agent

Market Analyst translates market diligence questions into calls against the Market MCP server.

## Components

`app/agent.py` defines the ADK root agent, instructions, planning helper, backend status helper, and callable tool surface.

`app/market_mcp.py` owns the MCP client boundary. It maps Python tool arguments to the current `servers/market` MCP tool schemas and serializes returned MCP content for the ADK response path.

`servers/market` remains the tool backend. It performs market-condition and competitive-analysis operations and can keep its own TypeScript package because it is not an agent.

## Request Flow

1. A user asks for market diligence.
2. The ADK agent decides whether the task is market conditions or competitive analysis.
3. The Python wrapper calls `MARKET_MCP_URL`.
4. The backend returns structured MCP content.
5. The agent explains the result and calls out uncertainty or missing data.

## Review Boundary

The agent can support diligence. It cannot approve a final bid, acquisition, investment committee decision, or capital allocation without human review.
