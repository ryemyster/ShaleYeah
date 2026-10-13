from __future__ import annotations

from typing import Any

from shaleyeah_mcp import call_tool, load_mcp_config

INFRASTRUCTURE_DEFAULT_URL = "http://localhost:3012/mcp"


def infrastructure_backend_url() -> str:
    """Return the validated configured MCP endpoint without resolving credentials."""
    return load_mcp_config("INFRASTRUCTURE", INFRASTRUCTURE_DEFAULT_URL).endpoint


async def call_infrastructure_tool(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    """Call the selected modern MCP profile with separately resolved authority."""
    config = load_mcp_config("INFRASTRUCTURE", INFRASTRUCTURE_DEFAULT_URL)
    result = await call_tool(config, tool_name, arguments)
    return {
        "backendUrl": config.endpoint,
        "mcpServer": "infrastructure",
        "toolName": tool_name,
        **result,
    }

async def plan_pipeline(
    well_count: int,
    expected_production: float,
    location: str,
    match_threshold: float | None = None,
) -> dict[str, Any]:
    """Execute Infrastructure plan_pipeline for gathering, routing, and takeaway risk."""

    arguments: dict[str, Any] = {
        "wellCount": well_count,
        "expectedProduction": expected_production,
        "location": location,
    }

    if match_threshold is not None:
        arguments["matchThreshold"] = match_threshold

    return await call_infrastructure_tool("plan_pipeline", arguments)


async def size_facilities(
    well_count: int,
    expected_production: float,
    location: str,
    match_threshold: float | None = None,
) -> dict[str, Any]:
    """Execute Infrastructure size_facilities for tanks, separators, compression, and SWD."""

    arguments: dict[str, Any] = {
        "wellCount": well_count,
        "expectedProduction": expected_production,
        "location": location,
    }

    if match_threshold is not None:
        arguments["matchThreshold"] = match_threshold

    return await call_infrastructure_tool("size_facilities", arguments)


async def estimate_costs(
    well_count: int,
    compressors: int,
    swd_wells: int,
    location: str,
    match_threshold: float | None = None,
) -> dict[str, Any]:
    """Execute Infrastructure estimate_costs for pipeline, facility, compression, and SWD CAPEX."""

    arguments: dict[str, Any] = {
        "wellCount": well_count,
        "compressors": compressors,
        "swdWells": swd_wells,
        "location": location,
    }

    if match_threshold is not None:
        arguments["matchThreshold"] = match_threshold

    return await call_infrastructure_tool("estimate_costs", arguments)


async def assess_compliance(
    well_count: int,
    location: str,
    environmental_constraints: list[str] | None = None,
    match_threshold: float | None = None,
) -> dict[str, Any]:
    """Execute Infrastructure assess_compliance for permits, timelines, and review risks."""

    arguments: dict[str, Any] = {
        "wellCount": well_count,
        "location": location,
    }

    if environmental_constraints is not None:
        arguments["environmentalConstraints"] = environmental_constraints
    if match_threshold is not None:
        arguments["matchThreshold"] = match_threshold

    return await call_infrastructure_tool("assess_compliance", arguments)
