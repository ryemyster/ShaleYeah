from __future__ import annotations

import os
from typing import Any

from google.adk.agents import Agent
from google.adk.apps import App

from app.drilling_mcp import (
    assess_drilling_risks,
    design_drilling_program,
    drilling_backend_url,
    estimate_well_costs,
)


def drilling_backend_status() -> dict[str, Any]:
    """Return the configured Drilling-compatible MCP backend for this agent."""

    return {
        "backend": "drilling",
        "url": drilling_backend_url(),
        "transport": "mcp-http",
        "independentBackend": True,
        "architectureMode": "stand-alone-with-progressive-disclosure-skills",
        "notes": [
            "servers/drilling remains independently runnable.",
            "Set DRILLING_MCP_URL to use a compatible internal or proprietary MCP backend.",
            "This agent is not hierarchical, graph-based, ambient, or capability-first in #532.",
        ],
    }


def plan_drilling_tool_call(goal: str, analysis_type: str = "design") -> dict[str, Any]:
    """Plan the Drilling MCP tool call for a drilling-engineering request."""

    tool_by_analysis_type = {
        "design": "design_drilling_program",
        "program": "design_drilling_program",
        "drilling-program": "design_drilling_program",
        "wellbore": "design_drilling_program",
        "cost": "estimate_well_costs",
        "costs": "estimate_well_costs",
        "afe": "estimate_well_costs",
        "estimate": "estimate_well_costs",
        "risk": "assess_drilling_risks",
        "risks": "assess_drilling_risks",
        "hazard": "assess_drilling_risks",
        "hazards": "assess_drilling_risks",
    }
    tool_name = tool_by_analysis_type.get(analysis_type, "design_drilling_program")
    return {
        "backendUrl": drilling_backend_url(),
        "mcpServer": "drilling",
        "toolName": tool_name,
        "goal": goal,
        "analysisType": analysis_type,
        "architectureMode": "stand-alone-with-progressive-disclosure-skills",
        "executionBoundary": "adk-mcp",
        "requiresReviewForFinalDrillingProgram": True,
    }


root_agent = Agent(
    name="drilling_engineer",
    model=os.getenv("DRILLING_ENGINEER_ADK_MODEL", "gemini-flash-latest"),
    instruction=(
        "You are Perforator Maximus, a drilling engineering diligence agent for oil "
        "and gas wells. Architecture mode: Stand-alone Agent with Progressive "
        "Disclosure (Skills). Use Drilling-compatible MCP tools for drilling program "
        "design, well cost estimation, and drilling risk assessment. Treat your output "
        "as engineering diligence support, not final AFE, spud, field-execution, or "
        "safety approval. Surface missing well parameters, formation data, constraints, "
        "or environmental context instead of fabricating engineering certainty. Never "
        "assume the Drilling server is colocated; use the configured backend URL."
    ),
    tools=[
        drilling_backend_status,
        plan_drilling_tool_call,
        design_drilling_program,
        estimate_well_costs,
        assess_drilling_risks,
    ],
)

app = App(root_agent=root_agent, name="app")
