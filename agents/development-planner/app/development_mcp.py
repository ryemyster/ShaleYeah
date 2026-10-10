from __future__ import annotations

import os
from typing import Any

DEVELOPMENT_DEFAULT_URL = "http://localhost:3011"


def development_backend_url() -> str:
    """Return the configured Development-compatible MCP backend URL."""

    return os.getenv("DEVELOPMENT_MCP_URL", DEVELOPMENT_DEFAULT_URL)


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


async def call_development_tool(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    """Call a Development MCP tool over Streamable HTTP."""

    try:
        from mcp import ClientSession
        from mcp.client.streamable_http import streamablehttp_client
    except ImportError as exc:
        raise RuntimeError(
            "Python MCP client is required for ADK Development Planner execution. "
            "Run `agents-cli install` from agents/development-planner."
        ) from exc

    backend_url = development_backend_url()
    async with streamablehttp_client(backend_url) as (read_stream, write_stream, _):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            result = await session.call_tool(tool_name, arguments)
            return {
                "backendUrl": backend_url,
                "mcpServer": "development",
                "toolName": tool_name,
                "content": serialize_mcp_content(result.content),
                "isError": bool(getattr(result, "isError", False)),
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
