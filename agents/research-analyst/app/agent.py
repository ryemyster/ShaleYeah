from __future__ import annotations

import os
from typing import Any

from google.adk.agents import Agent
from google.adk.apps import App

from app.research_mcp import (
    analyze_competition,
    conduct_market_research,
    research_backend_url,
)


def research_backend_status() -> dict[str, Any]:
    """Return the configured Research-compatible MCP backend for this agent."""

    return {
        "backend": "research",
        "url": research_backend_url(),
        "transport": "mcp-http",
        "independentBackend": True,
        "architectureMode": "stand-alone-with-progressive-disclosure-skills",
        "notes": [
            "servers/research remains independently runnable.",
            "Set RESEARCH_MCP_URL to use a compatible internal or proprietary MCP backend.",
            "This agent is not hierarchical, graph-based, ambient, or capability-first in #535.",
        ],
    }


def plan_research_tool_call(goal: str, research_type: str = "market") -> dict[str, Any]:
    """Plan the Research MCP tool call for a market-intelligence request."""

    tool_by_research_type = {
        "market": "conduct_market_research",
        "market-research": "conduct_market_research",
        "source": "conduct_market_research",
        "sources": "conduct_market_research",
        "policy": "conduct_market_research",
        "regulatory": "conduct_market_research",
        "technology": "conduct_market_research",
        "commodity": "conduct_market_research",
        "competition": "analyze_competition",
        "competitive": "analyze_competition",
        "competitor": "analyze_competition",
        "competitors": "analyze_competition",
        "operator": "analyze_competition",
        "operators": "analyze_competition",
        "landscape": "analyze_competition",
    }
    tool_name = tool_by_research_type.get(research_type, "conduct_market_research")
    return {
        "backendUrl": research_backend_url(),
        "mcpServer": "research",
        "toolName": tool_name,
        "goal": goal,
        "researchType": research_type,
        "architectureMode": "stand-alone-with-progressive-disclosure-skills",
        "executionBoundary": "adk-mcp",
        "requiresReviewForFinalInvestmentRecommendation": True,
        "requiresReviewForDisclosureOrReservesClassification": True,
        "requiresReviewForSensitiveMemoryPromotion": True,
    }


root_agent = Agent(
    name="research_analyst",
    model=os.getenv("RESEARCH_ANALYST_ADK_MODEL", "gemini-flash-latest"),
    instruction=(
        "You are Scientius Researchicus, a research analyst for oil and gas "
        "diligence. Architecture mode: Stand-alone Agent with Progressive "
        "Disclosure (Skills). Use Research-compatible MCP tools for market "
        "research and competitive analysis. Treat your output as source-backed "
        "intelligence support, not final investment approval, bid/no-bid "
        "authorization, capital allocation, trade execution, securities disclosure, "
        "reserve or resource classification, legal/title/regulatory conclusion, "
        "publication approval, or shared-memory approval. Separate cited facts, "
        "source-derived inferences, and assumptions. Surface missing scope, stale "
        "sources, inaccessible sources, conflicting evidence, or low confidence "
        "instead of fabricating market certainty. Never assume the Research server "
        "is colocated; use the configured backend URL."
    ),
    tools=[
        research_backend_status,
        plan_research_tool_call,
        conduct_market_research,
        analyze_competition,
    ],
)

app = App(root_agent=root_agent, name="app")
