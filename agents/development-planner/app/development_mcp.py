from __future__ import annotations

from typing import Any

from shaleyeah_mcp import call_tool, load_mcp_config

DEVELOPMENT_DEFAULT_URL = "http://localhost:3011/mcp"


def development_backend_url() -> str:
    """Return the validated configured MCP endpoint without resolving credentials."""
    return load_mcp_config("DEVELOPMENT", DEVELOPMENT_DEFAULT_URL).endpoint


async def call_development_tool(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    """Call the selected modern MCP profile with separately resolved authority."""
    config = load_mcp_config("DEVELOPMENT", DEVELOPMENT_DEFAULT_URL)
    result = await call_tool(config, tool_name, arguments)
    return {
        "backendUrl": config.endpoint,
        "mcpServer": "development",
        "toolName": tool_name,
        **result,
    }

async def create_development_plan(
    project: dict[str, Any],
    timeline: str | None = None,
    constraints: dict[str, Any] | None = None,
    output_path: str | None = None,
    match_threshold: float | None = None,
) -> dict[str, Any]:
    """Execute Development create_development_plan for a proposed project."""

    arguments: dict[str, Any] = {"project": project}

    if timeline is not None:
        arguments["timeline"] = timeline
    if constraints is not None:
        arguments["constraints"] = constraints
    if output_path is not None:
        arguments["outputPath"] = output_path
    if match_threshold is not None:
        arguments["matchThreshold"] = match_threshold

    return await call_development_tool("create_development_plan", arguments)


async def estimate_project_timeline(
    project_name: str,
    well_count: int,
    budget: float,
    constraints: list[str] | None = None,
    match_threshold: float | None = None,
) -> dict[str, Any]:
    """Execute Development estimate_project_timeline for project phasing."""

    arguments: dict[str, Any] = {
        "projectName": project_name,
        "wellCount": well_count,
        "budget": budget,
    }

    if constraints is not None:
        arguments["constraints"] = constraints
    if match_threshold is not None:
        arguments["matchThreshold"] = match_threshold

    return await call_development_tool("estimate_project_timeline", arguments)


async def monitor_development_progress(
    project_id: str,
    metrics: list[str] | None = None,
    reporting_period: str = "monthly",
    output_path: str | None = None,
) -> dict[str, Any]:
    """Execute Development monitor_development_progress for current status."""

    arguments: dict[str, Any] = {
        "projectId": project_id,
        "reportingPeriod": reporting_period,
    }

    if metrics is not None:
        arguments["metrics"] = metrics
    if output_path is not None:
        arguments["outputPath"] = output_path

    return await call_development_tool("monitor_development_progress", arguments)
