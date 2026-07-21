# How It Works - Legal Analyst ADK Agent

Legal Analyst translates legal diligence questions into calls against the Legal MCP server.

## Components

`app/agent.py` defines the ADK root agent, instructions, architecture mode, planning helper, backend status helper, and callable tool surface.

`app/legal_mcp.py` owns the MCP client boundary. It maps Python tool arguments to the current `servers/legal` MCP tool schemas and serializes returned MCP content for the ADK response path.

`servers/legal` remains the tool backend. It performs regulatory, contract, and compliance operations and can keep its own TypeScript package because it is not an agent.

## Request Flow

1. A user asks for legal diligence.
2. The ADK agent decides whether the task is legal framework, contract review, or compliance assessment.
3. The Python wrapper calls `LEGAL_MCP_URL`.
4. The backend returns structured MCP content.
5. The agent explains the result and calls out uncertainty, missing facts, or review requirements.

## Review Boundary

The agent can support diligence. It cannot issue final legal opinions, approve redlines, authorize signatures, make filings, submit regulatory materials, waive rights, approve settlements, or make binding approvals without human/legal review.
