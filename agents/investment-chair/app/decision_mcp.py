from __future__ import annotations

from typing import Any, Literal

from shaleyeah_mcp import call_tool, load_mcp_config

DECISION_DEFAULT_URL = "http://localhost:3013/mcp"
BidStrategyMode = Literal["AGGRESSIVE", "CONSERVATIVE", "OPPORTUNISTIC"]


def decision_backend_url() -> str:
    """Return the validated configured MCP endpoint without resolving credentials."""
    return load_mcp_config("DECISION", DECISION_DEFAULT_URL).endpoint


async def call_decision_tool(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    """Call the selected modern MCP profile with separately resolved authority."""
    config = load_mcp_config("DECISION", DECISION_DEFAULT_URL)
    result = await call_tool(config, tool_name, arguments)
    return {
        "backendUrl": config.endpoint,
        "mcpServer": "decision",
        "toolName": tool_name,
        **result,
    }

async def make_investment_decision(
    analysis_inputs: dict[str, Any],
    investment_criteria: dict[str, Any] | None = None,
    market_conditions: dict[str, Any] | None = None,
    output_path: str | None = None,
) -> dict[str, Any]:
    """Execute Decision make_investment_decision for advisory go/no-go synthesis."""

    arguments: dict[str, Any] = {"analysisInputs": analysis_inputs}

    if investment_criteria is not None:
        arguments["investmentCriteria"] = investment_criteria
    if market_conditions is not None:
        arguments["marketConditions"] = market_conditions
    if output_path is not None:
        arguments["outputPath"] = output_path

    return await call_decision_tool("make_investment_decision", arguments)


async def calculate_bid_strategy(
    valuation: dict[str, Any],
    market_data: dict[str, Any] | None = None,
    strategy: BidStrategyMode = "CONSERVATIVE",
    output_path: str | None = None,
) -> dict[str, Any]:
    """Execute Decision calculate_bid_strategy for advisory bid posture and range."""

    arguments: dict[str, Any] = {
        "valuation": valuation,
        "strategy": strategy,
    }

    if market_data is not None:
        arguments["marketData"] = market_data
    if output_path is not None:
        arguments["outputPath"] = output_path

    return await call_decision_tool("calculate_bid_strategy", arguments)


async def analyze_portfolio_fit(
    opportunity: dict[str, Any],
    current_portfolio: list[dict[str, Any]] | None = None,
    portfolio_strategy: dict[str, Any] | None = None,
    match_threshold: float | None = None,
) -> dict[str, Any]:
    """Execute Decision analyze_portfolio_fit for strategic fit and concentration risk."""

    arguments: dict[str, Any] = {"opportunity": opportunity}

    if current_portfolio is not None:
        arguments["currentPortfolio"] = current_portfolio
    if portfolio_strategy is not None:
        arguments["portfolioStrategy"] = portfolio_strategy
    if match_threshold is not None:
        arguments["matchThreshold"] = match_threshold

    return await call_decision_tool("analyze_portfolio_fit", arguments)
