from __future__ import annotations

import os
from typing import Any

from google.adk.agents import Agent
from google.adk.apps import App

from app.legal_mcp import (
    analyze_legal_framework,
    assess_compliance,
    legal_backend_url,
    review_contract,
)


def legal_backend_status() -> dict[str, Any]:
    """Return the configured Legal-compatible MCP backend for this agent."""

    return {
        "backend": "legal",
        "url": legal_backend_url(),
        "transport": "mcp-http",
        "independentBackend": True,
        "architectureMode": "stand-alone-with-progressive-disclosure-skills",
        "notes": [
            "servers/legal remains independently runnable.",
            "Set LEGAL_MCP_URL to use a compatible internal or proprietary MCP backend.",
            "This agent is not hierarchical, graph-based, ambient, or capability-first in #531.",
        ],
    }


def plan_legal_tool_call(goal: str, analysis_type: str = "framework") -> dict[str, Any]:
    """Plan the Legal MCP tool call for a legal diligence request."""

    tool_by_analysis_type = {
        "framework": "analyze_legal_framework",
        "regulatory": "analyze_legal_framework",
        "legal-exposure": "analyze_legal_framework",
        "risk": "analyze_legal_framework",
        "contract": "review_contract",
        "contract-review": "review_contract",
        "terms": "review_contract",
        "agreement": "review_contract",
        "compliance": "assess_compliance",
        "environmental": "assess_compliance",
        "safety": "assess_compliance",
        "tax": "assess_compliance",
    }
    tool_name = tool_by_analysis_type.get(analysis_type, "analyze_legal_framework")
    execution_tool_by_tool_name = {
        "analyze_legal_framework": "analyze_legal_framework",
        "review_contract": "review_contract",
        "assess_compliance": "assess_compliance",
    }
    return {
        "backendUrl": legal_backend_url(),
        "mcpServer": "legal",
        "toolName": tool_name,
        "goal": goal,
        "analysisType": analysis_type,
        "architectureMode": "stand-alone-with-progressive-disclosure-skills",
        "executionBoundary": "adk-mcp",
        "executionTool": execution_tool_by_tool_name.get(tool_name),
        "requiresHumanLegalReviewForBindingAction": True,
        "hitlDeferralRequiredFor": [
            "legal opinions",
            "contract redlines",
            "contract approval",
            "signatures",
            "filings",
            "regulatory submissions",
            "waivers",
            "settlement positions",
            "binding approvals",
        ],
    }


root_agent = Agent(
    name="legal_analyst",
    model=os.getenv("LEGAL_ANALYST_ADK_MODEL", "gemini-flash-latest"),
    instruction=(
        "You are Legatus Juridicus, a legal diligence agent for oil and gas deal "
        "review. Architecture mode: Stand-alone Agent with Progressive Disclosure "
        "(Skills). Use Legal-compatible MCP tools for regulatory exposure, contract "
        "risk, and compliance requirements. Treat your output as diligence support, "
        "not legal advice, a final legal opinion, contract approval, redline authority, "
        "signature authority, filing authority, waiver approval, settlement authority, "
        "or regulatory submission authorization. Defer those actions to human/legal "
        "review. Surface missing jurisdiction, asset, party, contract-term, source, or "
        "authority gaps instead of fabricating legal certainty. Never assume the Legal "
        "server is colocated; use the configured backend URL."
    ),
    tools=[
        legal_backend_status,
        plan_legal_tool_call,
        analyze_legal_framework,
        review_contract,
        assess_compliance,
    ],
)

app = App(root_agent=root_agent, name="app")
