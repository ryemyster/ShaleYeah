from __future__ import annotations

from typing import Any

from shaleyeah_mcp import call_tool, load_mcp_config

MARKET_DEFAULT_URL = "http://localhost:3007/mcp"


def market_backend_url() -> str:
    """Return the validated configured MCP endpoint without resolving credentials."""
    return load_mcp_config("MARKET", MARKET_DEFAULT_URL).endpoint


async def call_market_tool(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    """Call the selected modern MCP profile with separately resolved authority."""
    config = load_mcp_config("MARKET", MARKET_DEFAULT_URL)
    result = await call_tool(config, tool_name, arguments)
    return {
        "backendUrl": config.endpoint,
        "mcpServer": "market",
        "toolName": tool_name,
        **result,
    }

async def analyze_market_conditions(
    region: str,
    commodity: str = "both",
    timeframe: str = "1year",
    factors: list[str] | None = None,
    output_path: str | None = None,
    match_threshold: float | None = None,
) -> dict[str, Any]:
    """Execute Market analyze_market_conditions for commodity-market diligence."""

    arguments: dict[str, Any] = {
        "commodity": commodity,
        "region": region,
        "timeframe": timeframe,
    }

    if factors is not None:
        arguments["factors"] = factors
    if output_path is not None:
        arguments["outputPath"] = output_path
    if match_threshold is not None:
        arguments["matchThreshold"] = match_threshold

    return await call_market_tool("analyze_market_conditions", arguments)


async def competitive_market_analysis(
    competitors: list[str],
    market: str,
    metrics: list[str] | None = None,
    output_path: str | None = None,
    match_threshold: float | None = None,
) -> dict[str, Any]:
    """Execute Market competitive_analysis for competitive-landscape diligence."""

    arguments: dict[str, Any] = {
        "competitors": competitors,
        "market": market,
    }

    if metrics is not None:
        arguments["metrics"] = metrics
    if output_path is not None:
        arguments["outputPath"] = output_path
    if match_threshold is not None:
        arguments["matchThreshold"] = match_threshold

    return await call_market_tool("competitive_analysis", arguments)
