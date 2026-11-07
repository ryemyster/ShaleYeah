from __future__ import annotations

from typing import Any

from shaleyeah_mcp import call_tool, load_mcp_config

RISK_ANALYSIS_DEFAULT_URL = "http://localhost:3005/mcp"


def risk_analysis_backend_url() -> str:
    """Return the validated configured MCP endpoint without resolving credentials."""
    return load_mcp_config("RISK_ANALYSIS", RISK_ANALYSIS_DEFAULT_URL).endpoint


async def call_risk_analysis_tool(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    """Call the selected modern MCP profile with separately resolved authority."""
    config = load_mcp_config("RISK_ANALYSIS", RISK_ANALYSIS_DEFAULT_URL)
    result = await call_tool(config, tool_name, arguments)
    return {
        "backendUrl": config.endpoint,
        "mcpServer": "risk-analysis",
        "toolName": tool_name,
        **result,
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
