from __future__ import annotations

import os
from typing import Any

from google.adk.agents import Agent
from google.adk.apps import App

from app.decision_mcp import (
    analyze_portfolio_fit,
    calculate_bid_strategy,
    decision_backend_url,
    make_investment_decision,
)


def decision_backend_status() -> dict[str, Any]:
    """Return the configured Decision-compatible MCP backend for this agent."""

    return {
        "backend": "decision",
        "url": decision_backend_url(),
        "transport": "mcp-http",
        "independentBackend": True,
        "architectureMode": "stand-alone-with-progressive-disclosure-skills",
        "notes": [
            "servers/decision remains independently runnable.",
            "Set DECISION_MCP_URL to use a compatible internal or proprietary MCP backend.",
            "This agent is not hierarchical, graph-based, ambient, or capability-first in #539.",
        ],
    }


def plan_decision_tool_call(goal: str, work_type: str = "decision") -> dict[str, Any]:
    """Plan the Decision MCP tool call for an investment-governance request."""

    tool_by_work_type = {
        "decision": "make_investment_decision",
        "go-no-go": "make_investment_decision",
        "go_no_go": "make_investment_decision",
        "invest": "make_investment_decision",
        "pass_recommendation": "make_investment_decision",
        "conditional": "make_investment_decision",
        "final": "make_investment_decision",
        "memo": "make_investment_decision",
        "synthesis": "make_investment_decision",
        "bid": "calculate_bid_strategy",
        "bidding": "calculate_bid_strategy",
        "auction": "calculate_bid_strategy",
        "loi": "calculate_bid_strategy",
        "term-sheet": "calculate_bid_strategy",
        "term_sheet": "calculate_bid_strategy",
        "strategy": "calculate_bid_strategy",
        "valuation": "calculate_bid_strategy",
        "portfolio": "analyze_portfolio_fit",
        "fit": "analyze_portfolio_fit",
        "concentration": "analyze_portfolio_fit",
        "diversification": "analyze_portfolio_fit",
        "synergy": "analyze_portfolio_fit",
        "synergies": "analyze_portfolio_fit",
        "conflict": "analyze_portfolio_fit",
        "allocation": "analyze_portfolio_fit",
    }
    tool_name = tool_by_work_type.get(work_type, "make_investment_decision")
    return {
        "backendUrl": decision_backend_url(),
        "mcpServer": "decision",
        "toolName": tool_name,
        "goal": goal,
        "workType": work_type,
        "architectureMode": "stand-alone-with-progressive-disclosure-skills",
        "executionBoundary": "adk-mcp",
        "requiresReviewForFinalInvestmentApproval": True,
        "requiresReviewForBindingBidOrTransaction": True,
        "requiresReviewForCapitalAuthorization": True,
        "requiresReviewForDisclosureOrReserveClassification": True,
        "requiresReviewForLegalTaxFiduciaryConflictConclusion": True,
        "requiresReviewForSensitiveMemoryPromotion": True,
    }


root_agent = Agent(
    name="investment_chair",
    model=os.getenv("INVESTMENT_CHAIR_ADK_MODEL", "gemini-flash-latest"),
    instruction=(
        "You are Augustus Decidius Maximus, an investment chair support agent "
        "for oil and gas diligence. Architecture mode: Stand-alone Agent with "
        "Progressive Disclosure (Skills). Use Decision-compatible MCP tools for "
        "advisory investment decision synthesis, bid strategy, and portfolio-fit "
        "analysis. Treat your output as diligence and committee-support material, "
        "not final investment approval, board approval, officer approval, fund "
        "manager approval, investment committee vote, binding bid, LOI, PSA, "
        "term sheet, financing action, acquisition or divestiture authority, "
        "AFE/capital/budget release, legal conclusion, tax conclusion, title "
        "conclusion, fiduciary or conflict clearance, fairness opinion, securities "
        "disclosure, reserve or resource classification, or shared-memory approval. "
        "Preserve source limits and data vintage. Surface missing geology, "
        "engineering, economics, risk, title, legal, market, infrastructure, "
        "development, drilling, research, portfolio, financing, governance, or "
        "comparable-sales inputs instead of fabricating investment certainty. "
        "Never assume the Decision server is colocated; use the configured backend URL."
    ),
    tools=[
        decision_backend_status,
        plan_decision_tool_call,
        make_investment_decision,
        calculate_bid_strategy,
        analyze_portfolio_fit,
    ],
)

app = App(root_agent=root_agent, name="app")
