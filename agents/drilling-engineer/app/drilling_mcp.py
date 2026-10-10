from __future__ import annotations

import os
from typing import Any

DRILLING_DEFAULT_URL = "http://localhost:3003"


def drilling_backend_url() -> str:
    """Return the configured Drilling-compatible MCP backend URL."""

    return os.getenv("DRILLING_MCP_URL", DRILLING_DEFAULT_URL)


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


async def call_drilling_tool(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    """Call a Drilling MCP tool over Streamable HTTP."""

    try:
        from mcp import ClientSession
        from mcp.client.streamable_http import streamablehttp_client
    except ImportError as exc:
        raise RuntimeError(
            "Python MCP client is required for ADK Drilling execution. "
            "Run `agents-cli install` from agents/drilling-engineer."
        ) from exc

    backend_url = drilling_backend_url()
    async with streamablehttp_client(backend_url) as (read_stream, write_stream, _):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            result = await session.call_tool(tool_name, arguments)
            return {
                "backendUrl": backend_url,
                "mcpServer": "drilling",
                "toolName": tool_name,
                "content": serialize_mcp_content(result.content),
                "isError": bool(getattr(result, "isError", False)),
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
