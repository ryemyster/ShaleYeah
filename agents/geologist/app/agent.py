from __future__ import annotations

import os
from typing import Any

from google.adk.agents import Agent
from google.adk.apps import App

GEOWIZ_DEFAULT_URL = "http://localhost:3001"


def geowiz_backend_status() -> dict[str, Any]:
    """Return the configured Geowiz-compatible MCP backend for this agent."""

    return {
        "backend": "geowiz",
        "url": os.getenv("GEOWIZ_MCP_URL", GEOWIZ_DEFAULT_URL),
        "transport": "mcp-http",
        "independentBackend": True,
        "notes": [
            "servers/geowiz remains independently runnable.",
            "Set GEOWIZ_MCP_URL to use a compatible internal or proprietary MCP backend.",
        ],
    }


def plan_geowiz_tool_call(goal: str, file_path: str, data_type: str = "las") -> dict[str, Any]:
    """Plan the Geowiz MCP tool call for a geological diligence artifact.

    This is the first ADK adapter slice: it makes backend selection explicit without
    preserving the old TypeScript ReAct loop as the long-term agent runtime.
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
        "backendUrl": os.getenv("GEOWIZ_MCP_URL", GEOWIZ_DEFAULT_URL),
        "mcpServer": "geowiz",
        "toolName": tool_name,
        "arguments": {
            "filePath": file_path,
            "dataType": data_type,
        },
        "goal": goal,
        "executionBoundary": "planned-only",
        "adapterStatus": "MCP execution remains in src/agent/geowiz-client.ts until replaced by the ADK MCP client path.",
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
    tools=[geowiz_backend_status, plan_geowiz_tool_call],
)

app = App(root_agent=root_agent, name="geologist")
