from __future__ import annotations

import os
from typing import Any

INFRASTRUCTURE_DEFAULT_URL = "http://localhost:3012"


def infrastructure_backend_url() -> str:
    """Return the configured Infrastructure-compatible MCP backend URL."""

    return os.getenv("INFRASTRUCTURE_MCP_URL", INFRASTRUCTURE_DEFAULT_URL)


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


async def call_infrastructure_tool(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    """Call an Infrastructure MCP tool over Streamable HTTP."""

    try:
        from mcp import ClientSession
        from mcp.client.streamable_http import streamablehttp_client
    except ImportError as exc:
        raise RuntimeError(
            "Python MCP client is required for ADK Infrastructure Planner execution. "
            "Run `agents-cli install` from agents/infrastructure-planner."
        ) from exc

    backend_url = infrastructure_backend_url()
    async with streamablehttp_client(backend_url) as (read_stream, write_stream, _):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            result = await session.call_tool(tool_name, arguments)
            return {
                "backendUrl": backend_url,
                "mcpServer": "infrastructure",
                "toolName": tool_name,
                "content": serialize_mcp_content(result.content),
                "isError": bool(getattr(result, "isError", False)),
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
