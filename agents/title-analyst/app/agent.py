from __future__ import annotations

import os
from typing import Any

from google.adk.agents import Agent
from google.adk.apps import App

from app.title_mcp import (
    analyze_title_lease,
    check_title_burdens,
    examine_title_ownership,
    title_backend_url,
    trace_title_chain_of_title,
)


def title_backend_status() -> dict[str, Any]:
    """Return the configured Title-compatible MCP backend for this agent."""

    return {
        "backend": "title",
        "url": title_backend_url(),
        "transport": "mcp-http",
        "independentBackend": True,
        "architectureMode": "stand-alone-with-progressive-disclosure-skills",
        "notes": [
            "servers/title remains independently runnable.",
            "Set TITLE_MCP_URL to use a compatible internal or proprietary MCP backend.",
            "This agent is not hierarchical, graph-based, ambient, or capability-first in #528.",
        ],
    }


def plan_title_tool_call(goal: str, document_type: str = "ownership") -> dict[str, Any]:
    """Plan the Title MCP tool call for a title diligence request."""

    tool_by_document_type = {
        "ownership": "examine_ownership",
        "wi-nri": "examine_ownership",
        "tract": "examine_ownership",
        "lease": "analyze_lease",
        "lease-analysis": "analyze_lease",
        "burden": "check_burdens",
        "burdens": "check_burdens",
        "encumbrance": "check_burdens",
        "chain": "trace_chain_of_title",
        "chain-of-title": "trace_chain_of_title",
        "curative": "trace_chain_of_title",
    }
    tool_name = tool_by_document_type.get(document_type, "examine_ownership")
    execution_tool_by_tool_name = {
        "examine_ownership": "examine_title_ownership",
        "analyze_lease": "analyze_title_lease",
        "check_burdens": "check_title_burdens",
        "trace_chain_of_title": "trace_title_chain_of_title",
    }
    return {
        "backendUrl": title_backend_url(),
        "mcpServer": "title",
        "toolName": tool_name,
        "goal": goal,
        "documentType": document_type,
        "architectureMode": "stand-alone-with-progressive-disclosure-skills",
        "executionBoundary": "adk-mcp",
        "executionTool": execution_tool_by_tool_name.get(tool_name),
        "requiresReviewForLegalOpinion": True,
    }


root_agent = Agent(
    name="title_analyst",
    model=os.getenv("TITLE_ANALYST_ADK_MODEL", "gemini-flash-latest"),
    instruction=(
        "You are Titulus Verificatus, a title diligence agent for oil and gas assets. "
        "Architecture mode: Stand-alone Agent with Progressive Disclosure (Skills). "
        "Use Title-compatible MCP tools for ownership, lease, burden, and chain-of-title "
        "analysis. Treat your output as diligence support, not a final legal opinion. "
        "Surface missing documents, legal descriptions, tract identifiers, jurisdiction, "
        "and curative gaps instead of fabricating clean title. Never assume the Title "
        "server is colocated; use the configured backend URL."
    ),
    tools=[
        title_backend_status,
        plan_title_tool_call,
        examine_title_ownership,
        analyze_title_lease,
        check_title_burdens,
        trace_title_chain_of_title,
    ],
)

app = App(root_agent=root_agent, name="app")
