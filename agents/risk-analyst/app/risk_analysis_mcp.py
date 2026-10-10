from __future__ import annotations

import os
from typing import Any

RISK_ANALYSIS_DEFAULT_URL = "http://localhost:3005"


def risk_analysis_backend_url() -> str:
    """Return the configured Risk Analysis-compatible MCP backend URL."""

    return os.getenv("RISK_ANALYSIS_MCP_URL", RISK_ANALYSIS_DEFAULT_URL)


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


async def call_risk_analysis_tool(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    """Call a Risk Analysis MCP tool over Streamable HTTP."""

    try:
        from mcp import ClientSession
        from mcp.client.streamable_http import streamablehttp_client
    except ImportError as exc:
        raise RuntimeError(
            "Python MCP client is required for ADK Risk Analysis execution. "
            "Run `agents-cli install` from agents/risk-analyst."
        ) from exc

    backend_url = risk_analysis_backend_url()
    async with streamablehttp_client(backend_url) as (read_stream, write_stream, _):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            result = await session.call_tool(tool_name, arguments)
            return {
                "backendUrl": backend_url,
                "mcpServer": "risk-analysis",
                "toolName": tool_name,
                "content": serialize_mcp_content(result.content),
                "isError": bool(getattr(result, "isError", False)),
            }


async def assess_investment_risk(
    project_data: dict[str, Any],
    risk_profile: str = "moderate",
    analysis_depth: str = "standard",
    output_path: str | None = None,
    match_threshold: float | None = None,
) -> dict[str, Any]:
    """Execute Risk Analysis assess_investment_risk for a project package."""

    arguments: dict[str, Any] = {
        "projectData": project_data,
        "riskProfile": risk_profile,
        "analysisDepth": analysis_depth,
    }

    if output_path is not None:
        arguments["outputPath"] = output_path
    if match_threshold is not None:
        arguments["matchThreshold"] = match_threshold

    return await call_risk_analysis_tool("assess_investment_risk", arguments)


async def monte_carlo_simulation(
    variables: dict[str, Any],
    iterations: int = 10000,
    target_irr: float = 0.15,
    output_path: str | None = None,
) -> dict[str, Any]:
    """Execute Risk Analysis monte_carlo_simulation for uncertainty analysis."""

    arguments: dict[str, Any] = {
        "variables": variables,
        "iterations": iterations,
        "targetIRR": target_irr,
    }

    if output_path is not None:
        arguments["outputPath"] = output_path

    return await call_risk_analysis_tool("monte_carlo_simulation", arguments)
