from __future__ import annotations

from typing import Any

from shaleyeah_mcp import call_tool, load_mcp_config

RESEARCH_DEFAULT_URL = "http://localhost:3008/mcp"


def research_backend_url() -> str:
    """Return the validated configured MCP endpoint without resolving credentials."""
    return load_mcp_config("RESEARCH", RESEARCH_DEFAULT_URL).endpoint


async def call_research_tool(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    """Call the selected modern MCP profile with separately resolved authority."""
    config = load_mcp_config("RESEARCH", RESEARCH_DEFAULT_URL)
    result = await call_tool(config, tool_name, arguments)
    return {
        "backendUrl": config.endpoint,
        "mcpServer": "research",
        "toolName": tool_name,
        **result,
    }

async def conduct_market_research(
    topic: str,
    scope: str = "regional",
    timeframe: str = "current",
    sources: list[str] | None = None,
    output_path: str | None = None,
) -> dict[str, Any]:
    """Execute Research conduct_market_research for source-backed market intelligence."""

    arguments: dict[str, Any] = {
        "topic": topic,
        "scope": scope,
        "timeframe": timeframe,
    }

    if sources is not None:
        arguments["sources"] = sources
    if output_path is not None:
        arguments["outputPath"] = output_path

    return await call_research_tool("conduct_market_research", arguments)


async def analyze_competition(
    region: str,
    competitors: list[str] | None = None,
    analysis_type: str = "comprehensive",
    timeframe: str = "last 12 months",
    output_path: str | None = None,
    match_threshold: float | None = None,
) -> dict[str, Any]:
    """Execute Research analyze_competition for operator and basin intelligence."""

    arguments: dict[str, Any] = {
        "region": region,
        "analysisType": analysis_type,
        "timeframe": timeframe,
    }

    if competitors is not None:
        arguments["competitors"] = competitors
    if output_path is not None:
        arguments["outputPath"] = output_path
    if match_threshold is not None:
        arguments["matchThreshold"] = match_threshold

    return await call_research_tool("analyze_competition", arguments)
