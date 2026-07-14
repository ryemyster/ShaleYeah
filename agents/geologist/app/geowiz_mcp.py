from __future__ import annotations

import os
from typing import Any

GEOWIZ_DEFAULT_URL = "http://localhost:3001"


def geowiz_backend_url() -> str:
    """Return the configured Geowiz-compatible MCP backend URL."""

    return os.getenv("GEOWIZ_MCP_URL", GEOWIZ_DEFAULT_URL)


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


async def call_geowiz_tool(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    """Call a Geowiz MCP tool over Streamable HTTP."""

    try:
        from mcp import ClientSession
        from mcp.client.streamable_http import streamablehttp_client
    except ImportError as exc:
        raise RuntimeError(
            "Python MCP client is required for ADK Geowiz execution. "
            "Run `agents-cli install` from agents/geologist."
        ) from exc

    backend_url = geowiz_backend_url()
    async with streamablehttp_client(backend_url) as (read_stream, write_stream, _):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            result = await session.call_tool(tool_name, arguments)
            return {
                "backendUrl": backend_url,
                "mcpServer": "geowiz",
                "toolName": tool_name,
                "content": serialize_mcp_content(result.content),
                "isError": bool(getattr(result, "isError", False)),
            }


async def assess_geowiz_quality(
    file_path: str,
    data_type: str = "las",
    completeness_threshold: float = 0.8,
    accuracy_threshold: float = 0.85,
) -> dict[str, Any]:
    """Execute Geowiz assess_quality for a geology artifact."""

    return await call_geowiz_tool(
        "assess_quality",
        {
            "filePath": file_path,
            "dataType": data_type,
            "thresholds": {
                "completeness": completeness_threshold,
                "accuracy": accuracy_threshold,
            },
        },
    )
