from __future__ import annotations

import os
from typing import Any

from google.adk.agents import Agent
from google.adk.apps import App

from app.infrastructure_mcp import (
    assess_compliance,
    estimate_costs,
    infrastructure_backend_url,
    plan_pipeline,
    size_facilities,
)


def infrastructure_backend_status() -> dict[str, Any]:
    """Return the configured Infrastructure-compatible MCP backend for this agent."""

    return {
        "backend": "infrastructure",
        "url": infrastructure_backend_url(),
        "transport": "mcp-http",
        "independentBackend": True,
        "architectureMode": "stand-alone-with-progressive-disclosure-skills",
        "notes": [
            "servers/infrastructure remains independently runnable.",
            "Set INFRASTRUCTURE_MCP_URL to use a compatible internal or proprietary MCP backend.",
            "This agent is not hierarchical, graph-based, ambient, or capability-first in #543.",
        ],
    }


def plan_surface_tool_call(goal: str, work_type: str = "pipeline") -> dict[str, Any]:
    """Plan the Infrastructure MCP tool call for a surface or midstream request."""

    tool_by_work_type = {
        "pipeline": "plan_pipeline",
        "gathering": "plan_pipeline",
        "route": "plan_pipeline",
        "routing": "plan_pipeline",
        "takeaway": "plan_pipeline",
        "midstream": "plan_pipeline",
        "facility": "size_facilities",
        "facilities": "size_facilities",
        "battery": "size_facilities",
        "separator": "size_facilities",
        "compression": "size_facilities",
        "swd": "size_facilities",
        "water": "size_facilities",
        "cost": "estimate_costs",
        "costs": "estimate_costs",
        "capex": "estimate_costs",
        "afe": "estimate_costs",
        "budget": "estimate_costs",
        "compliance": "assess_compliance",
        "permit": "assess_compliance",
        "permitting": "assess_compliance",
        "regulatory": "assess_compliance",
        "environmental": "assess_compliance",
        "phmsa": "assess_compliance",
        "ferc": "assess_compliance",
        "uic": "assess_compliance",
    }
    tool_name = tool_by_work_type.get(work_type, "plan_pipeline")
    return {
        "backendUrl": infrastructure_backend_url(),
        "mcpServer": "infrastructure",
        "toolName": tool_name,
        "goal": goal,
        "workType": work_type,
        "architectureMode": "stand-alone-with-progressive-disclosure-skills",
        "executionBoundary": "adk-mcp",
        "requiresReviewForFinalRouteOrFacilityLayout": True,
        "requiresReviewForConstructionOrFieldExecution": True,
        "requiresReviewForCapitalApproval": True,
        "requiresReviewForRegulatoryCertification": True,
        "requiresReviewForRightOfWayOrCommercialCommitment": True,
        "requiresReviewForSensitiveMemoryPromotion": True,
    }


root_agent = Agent(
    name="infrastructure_planner",
    model=os.getenv("INFRASTRUCTURE_PLANNER_ADK_MODEL", "gemini-flash-latest"),
    instruction=(
        "You are Structura Ingenious, an infrastructure planner for oil and gas "
        "diligence. Architecture mode: Stand-alone Agent with Progressive "
        "Disclosure (Skills). Use Infrastructure-compatible MCP tools for "
        "pipeline and gathering plans, facility sizing, infrastructure CAPEX, "
        "and permitting or compliance assessment. Treat your output as diligence "
        "support, not final pipeline route approval, facility layout approval, "
        "construction authorization, AFE/capital authorization, ROW/easement "
        "decision, midstream commercial commitment, FERC/state/local permit "
        "certification, PHMSA safety certification, UIC/Class II disposal "
        "approval, environmental conclusion, public disclosure approval, or "
        "shared-memory approval. Surface missing location, well count, production, "
        "phasing, water-handling, right-of-way, commercial, environmental, "
        "regulatory, data-vintage, or GIS-confidence limits instead of fabricating "
        "infrastructure certainty. Never assume the Infrastructure server is "
        "colocated; use the configured backend URL."
    ),
    tools=[
        infrastructure_backend_status,
        plan_surface_tool_call,
        plan_pipeline,
        size_facilities,
        estimate_costs,
        assess_compliance,
    ],
)

app = App(root_agent=root_agent, name="app")
