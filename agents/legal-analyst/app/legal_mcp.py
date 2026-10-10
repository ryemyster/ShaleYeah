from __future__ import annotations

import os
from typing import Any

LEGAL_DEFAULT_URL = "http://localhost:3006"


def legal_backend_url() -> str:
    """Return the configured Legal-compatible MCP backend URL."""

    return os.getenv("LEGAL_MCP_URL", LEGAL_DEFAULT_URL)


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


async def call_legal_tool(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    """Call a Legal MCP tool over Streamable HTTP."""

    try:
        from mcp import ClientSession
        from mcp.client.streamable_http import streamablehttp_client
    except ImportError as exc:
        raise RuntimeError(
            "Python MCP client is required for ADK Legal execution. "
            "Run `agents-cli install` from agents/legal-analyst."
        ) from exc

    backend_url = legal_backend_url()
    async with streamablehttp_client(backend_url) as (read_stream, write_stream, _):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            result = await session.call_tool(tool_name, arguments)
            return {
                "backendUrl": backend_url,
                "mcpServer": "legal",
                "toolName": tool_name,
                "content": serialize_mcp_content(result.content),
                "isError": bool(getattr(result, "isError", False)),
            }


async def analyze_legal_framework(
    jurisdiction: str,
    project_type: str,
    assets: list[str],
    timeline: str | None = None,
    match_threshold: float | None = None,
) -> dict[str, Any]:
    """Execute Legal analyze_legal_framework for regulatory and legal exposure diligence."""

    arguments: dict[str, Any] = {
        "jurisdiction": jurisdiction,
        "projectType": project_type,
        "assets": assets,
    }

    if timeline is not None:
        arguments["timeline"] = timeline
    if match_threshold is not None:
        arguments["matchThreshold"] = match_threshold

    return await call_legal_tool("analyze_legal_framework", arguments)


async def review_contract(
    contract_type: str,
    key_terms: list[str],
    parties: list[str],
    risk_profile: str = "moderate",
    match_threshold: float | None = None,
) -> dict[str, Any]:
    """Execute Legal review_contract for oil and gas contract-risk diligence."""

    arguments: dict[str, Any] = {
        "contractType": contract_type,
        "keyTerms": key_terms,
        "parties": parties,
        "riskProfile": risk_profile,
    }

    if match_threshold is not None:
        arguments["matchThreshold"] = match_threshold

    return await call_legal_tool("review_contract", arguments)


async def assess_compliance(
    jurisdiction: str,
    project_type: str,
    asset_count: int,
) -> dict[str, Any]:
    """Execute Legal assess_compliance for environmental, safety, and tax requirements."""

    return await call_legal_tool(
        "assess_compliance",
        {
            "jurisdiction": jurisdiction,
            "projectType": project_type,
            "assetCount": asset_count,
        },
    )
