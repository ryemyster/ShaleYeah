from __future__ import annotations

from typing import Any

from shaleyeah_mcp import call_tool, load_mcp_config

TITLE_DEFAULT_URL = "http://localhost:3010/mcp"


def title_backend_url() -> str:
    """Return the validated configured MCP endpoint without resolving credentials."""
    return load_mcp_config("TITLE", TITLE_DEFAULT_URL).endpoint


async def call_title_tool(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    """Call the selected modern MCP profile with separately resolved authority."""
    config = load_mcp_config("TITLE", TITLE_DEFAULT_URL)
    result = await call_tool(config, tool_name, arguments)
    return {
        "backendUrl": config.endpoint,
        "mcpServer": "title",
        "toolName": tool_name,
        **result,
    }

async def examine_title_ownership(
    county: str,
    state: str,
    property_description: str | None = None,
    tract_id: str | None = None,
    cursor: str | None = None,
    page_size: int | None = None,
    output_path: str | None = None,
    match_threshold: float | None = None,
) -> dict[str, Any]:
    """Execute Title examine_ownership for WI/NRI ownership diligence."""

    arguments: dict[str, Any] = {"county": county, "state": state}

    if property_description is not None:
        arguments["propertyDescription"] = property_description
    if tract_id is not None:
        arguments["tractId"] = tract_id
    if cursor is not None:
        arguments["cursor"] = cursor
    if page_size is not None:
        arguments["pageSize"] = page_size
    if output_path is not None:
        arguments["outputPath"] = output_path
    if match_threshold is not None:
        arguments["matchThreshold"] = match_threshold

    return await call_title_tool("examine_ownership", arguments)


async def analyze_title_lease(
    primary_term: str,
    county: str,
    state: str,
    exam_period: str = "20 years",
    output_path: str | None = None,
) -> dict[str, Any]:
    """Execute Title analyze_lease for lease-term diligence."""

    arguments: dict[str, Any] = {
        "primaryTerm": primary_term,
        "county": county,
        "state": state,
        "examPeriod": exam_period,
    }

    if output_path is not None:
        arguments["outputPath"] = output_path

    return await call_title_tool("analyze_lease", arguments)


async def check_title_burdens(
    property_description: str,
    county: str,
    state: str,
    output_path: str | None = None,
) -> dict[str, Any]:
    """Execute Title check_burdens for encumbrance diligence."""

    arguments: dict[str, Any] = {
        "propertyDescription": property_description,
        "county": county,
        "state": state,
    }

    if output_path is not None:
        arguments["outputPath"] = output_path

    return await call_title_tool("check_burdens", arguments)


async def trace_title_chain_of_title(
    property_description: str,
    county: str,
    state: str,
    exam_period: str = "20 years",
    cursor: str | None = None,
    page_size: int | None = None,
    output_path: str | None = None,
) -> dict[str, Any]:
    """Execute Title trace_chain_of_title for conveyance-chain diligence."""

    arguments: dict[str, Any] = {
        "propertyDescription": property_description,
        "county": county,
        "state": state,
        "examPeriod": exam_period,
    }

    if cursor is not None:
        arguments["cursor"] = cursor
    if page_size is not None:
        arguments["pageSize"] = page_size
    if output_path is not None:
        arguments["outputPath"] = output_path

    return await call_title_tool("trace_chain_of_title", arguments)
