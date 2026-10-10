from __future__ import annotations

import os
from typing import Any

TITLE_DEFAULT_URL = "http://localhost:3010"


def title_backend_url() -> str:
    """Return the configured Title-compatible MCP backend URL."""

    return os.getenv("TITLE_MCP_URL", TITLE_DEFAULT_URL)


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


async def call_title_tool(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    """Call a Title MCP tool over Streamable HTTP."""

    try:
        from mcp import ClientSession
        from mcp.client.streamable_http import streamablehttp_client
    except ImportError as exc:
        raise RuntimeError(
            "Python MCP client is required for ADK Title execution. "
            "Run `agents-cli install` from agents/title-analyst."
        ) from exc

    backend_url = title_backend_url()
    async with streamablehttp_client(backend_url) as (read_stream, write_stream, _):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            result = await session.call_tool(tool_name, arguments)
            return {
                "backendUrl": backend_url,
                "mcpServer": "title",
                "toolName": tool_name,
                "content": serialize_mcp_content(result.content),
                "isError": bool(getattr(result, "isError", False)),
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
