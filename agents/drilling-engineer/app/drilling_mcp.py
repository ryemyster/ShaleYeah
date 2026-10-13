from __future__ import annotations

from typing import Any

from shaleyeah_mcp import call_tool, load_mcp_config

DRILLING_DEFAULT_URL = "http://localhost:3003/mcp"


def drilling_backend_url() -> str:
    """Return the validated configured MCP endpoint without resolving credentials."""
    return load_mcp_config("DRILLING", DRILLING_DEFAULT_URL).endpoint


async def call_drilling_tool(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    """Call the selected modern MCP profile with separately resolved authority."""
    config = load_mcp_config("DRILLING", DRILLING_DEFAULT_URL)
    result = await call_tool(config, tool_name, arguments)
    return {
        "backendUrl": config.endpoint,
        "mcpServer": "drilling",
        "toolName": tool_name,
        **result,
    }

async def design_drilling_program(
    well_parameters: dict[str, Any],
    constraints: dict[str, Any] | None = None,
    match_threshold: float | None = None,
) -> dict[str, Any]:
    """Execute Drilling design_drilling_program for a proposed well."""

    arguments: dict[str, Any] = {"wellParameters": well_parameters}

    if constraints is not None:
        arguments["constraints"] = constraints
    if match_threshold is not None:
        arguments["matchThreshold"] = match_threshold

    return await call_drilling_tool("design_drilling_program", arguments)


async def estimate_well_costs(
    well_parameters: dict[str, Any],
    location: str | None = None,
    match_threshold: float | None = None,
) -> dict[str, Any]:
    """Execute Drilling estimate_well_costs for a proposed well."""

    arguments: dict[str, Any] = {"wellParameters": well_parameters}

    if location is not None:
        arguments["location"] = location
    if match_threshold is not None:
        arguments["matchThreshold"] = match_threshold

    return await call_drilling_tool("estimate_well_costs", arguments)


async def assess_drilling_risks(
    well_parameters: dict[str, Any],
    environmental_constraints: list[str] | None = None,
    match_threshold: float | None = None,
) -> dict[str, Any]:
    """Execute Drilling assess_drilling_risks for a proposed well."""

    arguments: dict[str, Any] = {"wellParameters": well_parameters}

    if environmental_constraints is not None:
        arguments["environmentalConstraints"] = environmental_constraints
    if match_threshold is not None:
        arguments["matchThreshold"] = match_threshold

    return await call_drilling_tool("assess_drilling_risks", arguments)
