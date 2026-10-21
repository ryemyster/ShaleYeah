# How It Works — Risk Analyst ADK Agent

The Risk Analyst agent is the reasoning layer for risk diligence. It decides whether to assess project risk or run uncertainty simulation, calls the Risk Analysis MCP backend, and explains the result.

## Plain Language Flow

1. You ask a risk question or request uncertainty analysis.
2. The ADK agent chooses a matching Risk Analysis tool.
3. `app/risk_analysis_mcp.py` sends the request to the configured Risk Analysis MCP server.
4. The agent receives the tool result and responds.
5. If the user asks for final approval, the agent defers to human review.

## The Two Pieces

| Piece | What it does |
|-------|--------------|
| Risk Analyst agent | ADK/Python reasoning, tool choice, instructions, and eval behavior |
| Risk Analysis server | TypeScript MCP backend that scores risk and runs Monte Carlo simulation |

This split is intentional. Agents are ADK/Python. Servers may remain TypeScript/pnpm.

## Safety Boundary

Risk output supports diligence. It is not final investment approval. Missing geology, economics, technical, or regulatory inputs must be surfaced instead of hidden behind false confidence.
