# How It Works — Title Analyst ADK Agent

The Title Analyst agent is the reasoning layer for title diligence. It decides whether to examine ownership, analyze lease terms, check burdens, or trace chain of title, calls the Title MCP backend, and explains the result.

## Plain Language Flow

1. You ask a title question or request title diligence.
2. The ADK agent chooses a matching Title tool.
3. `app/title_mcp.py` sends the request to the configured Title MCP server.
4. The agent receives the tool result and responds.
5. If the user asks for final legal approval or clean-title signoff, the agent defers to human review.

## The Two Pieces

| Piece | What it does |
|-------|--------------|
| Title Analyst agent | ADK/Python reasoning, tool choice, instructions, and eval behavior |
| Title server | TypeScript MCP backend that performs ownership, lease, burden, and chain-of-title analysis |

This split is intentional. Agents are ADK/Python. Servers may remain TypeScript/pnpm.

## Safety Boundary

Title output supports diligence. It is not a final legal opinion. Missing documents, legal descriptions, tract IDs, jurisdiction, or curative gaps must be surfaced instead of hidden behind false clean-title confidence.
