from __future__ import annotations

import os
from typing import Any

from google.adk.agents import Agent
from google.adk.apps import App

from app.market_mcp import (
    analyze_market_conditions,
    competitive_market_analysis,
    market_backend_url,
)


def market_backend_status() -> dict[str, Any]:
    """Return the configured Market-compatible MCP backend for this agent."""

    return {
        "backend": "market",
        "url": market_backend_url(),
        "transport": "mcp-http",
        "independentBackend": True,
        "architectureMode": "stand-alone-with-progressive-disclosure-skills",
        "notes": [
            "servers/market remains independently runnable.",
            "Set MARKET_MCP_URL to use a compatible internal or proprietary MCP backend.",
            "This agent is not hierarchical, graph-based, ambient, or capability-first in #530.",
        ],
    }


def plan_market_tool_call(goal: str, analysis_type: str = "conditions") -> dict[str, Any]:
    """Plan the Market MCP tool call for a market intelligence request."""

    tool_by_analysis_type = {
        "conditions": "analyze_market_conditions",
        "market-conditions": "analyze_market_conditions",
        "commodity": "analyze_market_conditions",
        "price": "analyze_market_conditions",
        "competitive": "competitive_analysis",
        "competition": "competitive_analysis",
        "competitors": "competitive_analysis",
        "landscape": "competitive_analysis",
    }
    tool_name = tool_by_analysis_type.get(analysis_type, "analyze_market_conditions")
    execution_tool_by_tool_name = {
        "analyze_market_conditions": "analyze_market_conditions",
        "competitive_analysis": "competitive_market_analysis",
    }
    return {
        "backendUrl": market_backend_url(),
        "mcpServer": "market",
        "toolName": tool_name,
        "goal": goal,
        "analysisType": analysis_type,
        "architectureMode": "stand-alone-with-progressive-disclosure-skills",
        "executionBoundary": "adk-mcp",
        "executionTool": execution_tool_by_tool_name.get(tool_name),
        "requiresReviewForFinalBidOrInvestmentRecommendation": True,
    }


root_agent = Agent(
    name="market_analyst",
    model=os.getenv("MARKET_ANALYST_ADK_MODEL", "gemini-flash-latest"),
    instruction=(
        "You are Mercatus Analyticus, a market intelligence agent for oil and gas "
        "deal review. Architecture mode: Stand-alone Agent with Progressive Disclosure "
        "(Skills). "
        "Use Market-compatible MCP tools for commodity market conditions "
        "and competitive landscape analysis. Treat your output as diligence support, "
        "not final bid, pricing, or investment approval. Surface stale, missing, or "
        "stubbed market data instead of fabricating live-market certainty. Never "
        "assume the Market server is colocated; use the configured backend URL."
    ),
    tools=[
        market_backend_status,
        plan_market_tool_call,
        analyze_market_conditions,
        competitive_market_analysis,
    ],
)

app = App(root_agent=root_agent, name="app")
