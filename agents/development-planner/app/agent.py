from __future__ import annotations

import os
from typing import Any

from google.adk.agents import Agent
from google.adk.apps import App

from app.development_mcp import (
    create_development_plan,
    development_backend_url,
    estimate_project_timeline,
    monitor_development_progress,
)


def development_backend_status() -> dict[str, Any]:
    """Return the configured Development-compatible MCP backend for this agent."""

    return {
        "backend": "development",
        "url": development_backend_url(),
        "transport": "mcp-http",
        "independentBackend": True,
        "architectureMode": "stand-alone-with-progressive-disclosure-skills",
        "notes": [
            "servers/development remains independently runnable.",
            "Set DEVELOPMENT_MCP_URL to use a compatible internal or proprietary MCP backend.",
            "This agent is not hierarchical, graph-based, ambient, or capability-first in #534.",
        ],
    }


def plan_development_tool_call(goal: str, work_type: str = "plan") -> dict[str, Any]:
    """Plan the Development MCP tool call for a field-development request."""

    tool_by_work_type = {
        "plan": "create_development_plan",
        "field-development": "create_development_plan",
        "development-plan": "create_development_plan",
        "project": "create_development_plan",
        "concept": "create_development_plan",
        "timeline": "estimate_project_timeline",
        "schedule": "estimate_project_timeline",
        "phase": "estimate_project_timeline",
        "phases": "estimate_project_timeline",
        "milestones": "estimate_project_timeline",
        "progress": "monitor_development_progress",
        "monitor": "monitor_development_progress",
        "monitoring": "monitor_development_progress",
        "status": "monitor_development_progress",
        "kpi": "monitor_development_progress",
    }
    tool_name = tool_by_work_type.get(work_type, "create_development_plan")
    return {
        "backendUrl": development_backend_url(),
        "mcpServer": "development",
        "toolName": tool_name,
        "goal": goal,
        "workType": work_type,
        "architectureMode": "stand-alone-with-progressive-disclosure-skills",
        "executionBoundary": "adk-mcp",
        "requiresReviewForFinalDevelopmentPlan": True,
        "requiresReviewForDevelopmentSanction": True,
        "requiresReviewForCapitalApproval": True,
    }


root_agent = Agent(
    name="development_planner",
    model=os.getenv("DEVELOPMENT_PLANNER_ADK_MODEL", "gemini-flash-latest"),
    instruction=(
        "You are the Development Planner, a field-development planning agent for oil "
        "and gas projects. Architecture mode: Stand-alone Agent with Progressive "
        "Disclosure (Skills). Use Development-compatible MCP tools for field "
        "development plans, project timeline estimates, and progress monitoring. "
        "Treat your output as planning diligence support, not final FDP approval, "
        "FID, AFE/capital authorization, development sanction, drilling-sequence "
        "authorization, facility execution, regulatory submission, or external "
        "commitment. Surface missing reserves, well count, schedule, budget, "
        "infrastructure, regulatory, surface, or operating constraints instead of "
        "fabricating planning certainty. Never assume the Development server is "
        "colocated; use the configured backend URL."
    ),
    tools=[
        development_backend_status,
        plan_development_tool_call,
        create_development_plan,
        estimate_project_timeline,
        monitor_development_progress,
    ],
)

app = App(root_agent=root_agent, name="app")
