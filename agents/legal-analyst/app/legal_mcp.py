from __future__ import annotations

from typing import Any

from shaleyeah_mcp import call_tool, load_mcp_config

LEGAL_DEFAULT_URL = "http://localhost:3006/mcp"


def legal_backend_url() -> str:
    """Return the validated configured MCP endpoint without resolving credentials."""
    return load_mcp_config("LEGAL", LEGAL_DEFAULT_URL).endpoint


async def call_legal_tool(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    """Call the selected modern MCP profile with separately resolved authority."""
    config = load_mcp_config("LEGAL", LEGAL_DEFAULT_URL)
    result = await call_tool(config, tool_name, arguments)
    return {
        "backendUrl": config.endpoint,
        "mcpServer": "legal",
        "toolName": tool_name,
        **result,
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
