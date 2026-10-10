from __future__ import annotations

import os
from typing import Any

RESEARCH_DEFAULT_URL = "http://localhost:3008"


def research_backend_url() -> str:
    """Return the configured Research-compatible MCP backend URL."""

    return os.getenv("RESEARCH_MCP_URL", RESEARCH_DEFAULT_URL)


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


async def call_research_tool(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    """Call a Research MCP tool over Streamable HTTP."""

    try:
        from mcp import ClientSession
        from mcp.client.streamable_http import streamablehttp_client
    except ImportError as exc:
        raise RuntimeError(
            "Python MCP client is required for ADK Research Analyst execution. "
            "Run `agents-cli install` from agents/research-analyst."
        ) from exc

    backend_url = research_backend_url()
    async with streamablehttp_client(backend_url) as (read_stream, write_stream, _):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            result = await session.call_tool(tool_name, arguments)
            return {
                "backendUrl": backend_url,
                "mcpServer": "research",
                "toolName": tool_name,
                "content": serialize_mcp_content(result.content),
                "isError": bool(getattr(result, "isError", False)),
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
