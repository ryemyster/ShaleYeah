from __future__ import annotations

import os
from typing import Any

from google.adk.agents import Agent
from google.adk.apps import App

from app.risk_analysis_mcp import (
    assess_investment_risk,
    monte_carlo_simulation,
    risk_analysis_backend_url,
)


def risk_analysis_backend_status() -> dict[str, Any]:
    """Return the configured Risk Analysis-compatible MCP backend for this agent."""

    return {
        "backend": "risk-analysis",
        "url": risk_analysis_backend_url(),
        "transport": "mcp-http",
        "independentBackend": True,
        "architectureMode": "stand-alone-with-progressive-disclosure-skills",
        "notes": [
            "servers/risk-analysis remains independently runnable.",
            "Set RISK_ANALYSIS_MCP_URL to use a compatible internal or proprietary MCP backend.",
            "This agent is not hierarchical, graph-based, ambient, or capability-first in #527.",
        ],
    }


def plan_risk_analysis_tool_call(goal: str, analysis_type: str = "assessment") -> dict[str, Any]:
    """Plan the Risk Analysis MCP tool call for a risk diligence request."""

    tool_by_analysis_type = {
        "assessment": "assess_investment_risk",
        "risk-assessment": "assess_investment_risk",
        "investment-risk": "assess_investment_risk",
        "monte-carlo": "monte_carlo_simulation",
        "simulation": "monte_carlo_simulation",
        "uncertainty": "monte_carlo_simulation",
    }
    tool_name = tool_by_analysis_type.get(analysis_type, "assess_investment_risk")
    return {
        "backendUrl": risk_analysis_backend_url(),
        "mcpServer": "risk-analysis",
        "toolName": tool_name,
        "goal": goal,
        "analysisType": analysis_type,
        "architectureMode": "stand-alone-with-progressive-disclosure-skills",
        "executionBoundary": "adk-mcp",
        "requiresReviewForFinalApproval": True,
    }


root_agent = Agent(
    name="risk_analyst",
    model=os.getenv("RISK_ANALYST_ADK_MODEL", "gemini-flash-latest"),
    instruction=(
        "You are Gaius Probabilis Assessor, a risk diligence agent for oil and gas "
        "investment review. Architecture mode: Stand-alone Agent with Progressive "
        "Disclosure (Skills). "
        "Use Risk Analysis-compatible MCP tools for deterministic "
        "risk scoring and Monte Carlo simulation. Treat your output as diligence support, "
        "not final investment approval. Surface missing geology, economics, technical, "
        "or regulatory context instead of fabricating confidence. Never assume the Risk "
        "Analysis server is colocated; use the configured backend URL."
    ),
    tools=[
        risk_analysis_backend_status,
        plan_risk_analysis_tool_call,
        assess_investment_risk,
        monte_carlo_simulation,
    ],
)

app = App(root_agent=root_agent, name="app")
