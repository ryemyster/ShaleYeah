from __future__ import annotations

import os
from typing import Any

from google.adk.agents import Agent
from google.adk.apps import App

from app.geowiz_mcp import assess_geowiz_quality, geowiz_backend_url


def geowiz_backend_status() -> dict[str, Any]:
    """Return the configured Geowiz-compatible MCP backend for this agent."""

    return {
        "backend": "geowiz",
        "url": geowiz_backend_url(),
        "transport": "mcp-http",
        "independentBackend": True,
        "notes": [
            "servers/geowiz remains independently runnable.",
            "Set GEOWIZ_MCP_URL to use a compatible internal or proprietary MCP backend.",
        ],
    }


def plan_geowiz_tool_call(goal: str, file_path: str, data_type: str = "las") -> dict[str, Any]:
    """Plan the Geowiz MCP tool call for a geological diligence artifact.

    Use this before calling a Geowiz execution tool when the agent needs to explain
    its intended deterministic backend call.
    """

    tool_by_data_type = {
        "las": "assess_quality",
        "well-log": "process_well_logs",
        "gis": "process_gis",
        "seismic": "process_seismic_data",
        "document": "process_document",
        "aries": "process_aries_database",
        "access": "process_access_database",
    }
    tool_name = tool_by_data_type.get(data_type, "assess_quality")
    return {
        "backendUrl": geowiz_backend_url(),
        "mcpServer": "geowiz",
        "toolName": tool_name,
        "arguments": {
            "filePath": file_path,
            "dataType": data_type,
        },
        "goal": goal,
        "executionBoundary": "adk-mcp",
        "executionTool": "assess_geowiz_quality",
    }


root_agent = Agent(
    name="geologist",
    model=os.getenv("GEOLOGIST_ADK_MODEL", "gemini-flash-latest"),
    instruction=(
        "You are Marcus Aurelius Geologicus, a geological diligence agent. "
        "Use Geowiz-compatible MCP tools for deterministic file processing and "
        "keep reasoning, tool selection, safety policy, and eval behavior in ADK. "
        "Never assume Geowiz is colocated; use the configured backend URL."
    ),
    tools=[geowiz_backend_status, plan_geowiz_tool_call, assess_geowiz_quality],
)

app = App(root_agent=root_agent, name="app")
