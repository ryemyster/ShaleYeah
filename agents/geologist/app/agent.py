from __future__ import annotations

import os
from typing import Any

from google.adk.agents import Agent
from google.adk.apps import App
from google.adk.tools import FunctionTool

from app.geowiz_mcp import (
    analyze_geowiz_formation,
    assess_geowiz_quality,
    geowiz_backend_url,
    process_geowiz_access_database,
    process_geowiz_aries_database,
    process_geowiz_document,
    process_geowiz_gis,
    process_geowiz_seismic_data,
    process_geowiz_well_logs,
    save_geowiz_finding,
)


def geowiz_backend_status() -> dict[str, Any]:
    """Return the configured Geowiz-compatible MCP backend for this agent."""

    return {
        "backend": "geowiz",
        "url": geowiz_backend_url(),
        "transport": "mcp-http",
        "independentBackend": True,
        "architectureMode": "stand-alone-with-progressive-disclosure-skills",
        "notes": [
            "servers/geowiz remains independently runnable.",
            "Set GEOWIZ_MCP_URL to use a compatible internal or proprietary MCP backend.",
            "This agent is not hierarchical, graph-based, ambient, or capability-first in #597.",
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
    execution_tool_by_tool_name = {
        "assess_quality": "assess_geowiz_quality",
        "analyze_formation": "analyze_geowiz_formation",
        "process_access_database": "process_geowiz_access_database",
        "process_aries_database": "process_geowiz_aries_database",
        "process_document": "process_geowiz_document",
        "process_gis": "process_geowiz_gis",
        "process_seismic_data": "process_geowiz_seismic_data",
        "process_well_logs": "process_geowiz_well_logs",
    }
    return {
        "backendUrl": geowiz_backend_url(),
        "mcpServer": "geowiz",
        "toolName": tool_name,
        "arguments": {
            "filePath": file_path,
            "dataType": data_type,
        },
        "goal": goal,
        "architectureMode": "stand-alone-with-progressive-disclosure-skills",
        "executionBoundary": "adk-mcp",
        "executionTool": execution_tool_by_tool_name.get(tool_name),
    }


root_agent = Agent(
    name="geologist",
    model=os.getenv("GEOLOGIST_ADK_MODEL", "gemini-flash-latest"),
    instruction=(
        "You are Marcus Aurelius Geologicus, a geological diligence agent. "
        "Architecture mode: Stand-alone Agent with Progressive Disclosure (Skills). "
        "Use Geowiz-compatible MCP tools for deterministic file processing and "
        "keep reasoning, tool selection, safety policy, and eval behavior in ADK. "
        "Never assume Geowiz is colocated; use the configured backend URL."
    ),
    tools=[
        geowiz_backend_status,
        plan_geowiz_tool_call,
        analyze_geowiz_formation,
        assess_geowiz_quality,
        process_geowiz_well_logs,
        process_geowiz_gis,
        process_geowiz_access_database,
        process_geowiz_document,
        process_geowiz_seismic_data,
        process_geowiz_aries_database,
        FunctionTool(save_geowiz_finding, require_confirmation=True),
    ],
)

app = App(root_agent=root_agent, name="app")
