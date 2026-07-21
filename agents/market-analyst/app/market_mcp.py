from __future__ import annotations

import os
from typing import Any

MARKET_DEFAULT_URL = "http://localhost:3007"


def market_backend_url() -> str:
    """Return the configured Market-compatible MCP backend URL."""

    return os.getenv("MARKET_MCP_URL", MARKET_DEFAULT_URL)


def serialize_mcp_content(content: Any) -> list[dict[str, Any]]:
    """Convert MCP content blocks into JSON-safe dictionaries."""

    serialized: list[dict[str, Any]] = []
    for item in content or []:
        if hasattr(item, "model_dump"):
            serialized.append(item.model_dump(mode="json"))
        elif isinstance(item, dict):
            serialized.append(item)
        else:
            serialized.append({"type": "unknown", "value": str(item)})
    return serialized


async def call_market_tool(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    """Call a Market MCP tool over Streamable HTTP."""

    try:
        from mcp import ClientSession
        from mcp.client.streamable_http import streamablehttp_client
    except ImportError as exc:
        raise RuntimeError(
            "Python MCP client is required for ADK Market execution. "
            "Run `agents-cli install` from agents/market-analyst."
        ) from exc

    backend_url = market_backend_url()
    async with streamablehttp_client(backend_url) as (read_stream, write_stream, _):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            result = await session.call_tool(tool_name, arguments)
            return {
                "backendUrl": backend_url,
                "mcpServer": "market",
                "toolName": tool_name,
                "content": serialize_mcp_content(result.content),
                "isError": bool(getattr(result, "isError", False)),
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
