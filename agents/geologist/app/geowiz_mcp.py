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


async def analyze_geowiz_formation(
    file_path: str,
    formations: list[str] | None = None,
    analysis_type: str = "standard",
    formation_name: str | None = None,
    formation_id: str | None = None,
    match_threshold: float | None = None,
) -> dict[str, Any]:
    """Execute Geowiz analyze_formation for LAS/DLIS/WITSML artifacts."""

    arguments: dict[str, Any] = {
        "filePath": file_path,
        "analysisType": analysis_type,
    }

    if formations is not None:
        arguments["formations"] = formations
    if formation_name is not None:
        arguments["formationName"] = formation_name
    if formation_id is not None:
        arguments["formationId"] = formation_id
    if match_threshold is not None:
        arguments["matchThreshold"] = match_threshold

    return await call_geowiz_tool("analyze_formation", arguments)


async def process_geowiz_well_logs(
    file_path: str,
    format: str = "auto",
    quality_assessment: bool = True,
    well_name: str | None = None,
    well_id: str | None = None,
    cursor: str | None = None,
    page_size: int | None = None,
) -> dict[str, Any]:
    """Execute Geowiz process_well_logs for LAS/DLIS/WITSML artifacts."""

    arguments: dict[str, Any] = {
        "filePath": file_path,
        "format": format,
        "qualityAssessment": quality_assessment,
    }

    if well_name is not None:
        arguments["wellName"] = well_name
    if well_id is not None:
        arguments["wellId"] = well_id
    if cursor is not None:
        arguments["cursor"] = cursor
    if page_size is not None:
        arguments["pageSize"] = page_size

    return await call_geowiz_tool("process_well_logs", arguments)


async def process_geowiz_gis(
    file_path: str,
    analysis_type: str = "standard",
    quality_assessment: bool = True,
    oil_gas_analysis: bool = True,
) -> dict[str, Any]:
    """Execute Geowiz process_gis for SHP/GeoJSON/KML artifacts."""

    return await call_geowiz_tool(
        "process_gis",
        {
            "filePath": file_path,
            "analysisType": analysis_type,
            "qualityAssessment": quality_assessment,
            "oilGasAnalysis": oil_gas_analysis,
        },
    )


async def process_geowiz_access_database(
    file_path: str,
    extract_tables: list[str] | None = None,
    output_format: str = "summary",
    cursor: str | None = None,
    page_size: int | None = None,
) -> dict[str, Any]:
    """Execute Geowiz process_access_database for ACCDB/MDB artifacts."""

    arguments: dict[str, Any] = {
        "filePath": file_path,
        "outputFormat": output_format,
    }

    if extract_tables is not None:
        arguments["extractTables"] = extract_tables
    if cursor is not None:
        arguments["cursor"] = cursor
    if page_size is not None:
        arguments["pageSize"] = page_size

    return await call_geowiz_tool("process_access_database", arguments)


async def process_geowiz_document(
    file_path: str,
    extraction_type: str = "all",
) -> dict[str, Any]:
    """Execute Geowiz process_document for PDF/DOCX/PPTX artifacts."""

    return await call_geowiz_tool(
        "process_document",
        {
            "filePath": file_path,
            "extractionType": extraction_type,
        },
    )


async def process_geowiz_seismic_data(
    file_path: str,
    analysis_type: str = "all",
) -> dict[str, Any]:
    """Execute Geowiz process_seismic_data for SEGY/SGY/seismic3d artifacts."""

    return await call_geowiz_tool(
        "process_seismic_data",
        {
            "filePath": file_path,
            "analysisType": analysis_type,
        },
    )


async def process_geowiz_aries_database(
    file_path: str,
    analysis_type: str = "all",
) -> dict[str, Any]:
    """Execute Geowiz process_aries_database for ARIES ADB artifacts."""

    return await call_geowiz_tool(
        "process_aries_database",
        {
            "filePath": file_path,
            "analysisType": analysis_type,
        },
    )


async def save_geowiz_finding(
    finding_type: str,
    title: str,
    summary: str,
    confidence: float,
    data_source: str,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Persist a reviewed geological finding through Geowiz save_finding."""

    arguments: dict[str, Any] = {
        "findingType": finding_type,
        "title": title,
        "summary": summary,
        "confidence": confidence,
        "dataSource": data_source,
    }

    if metadata is not None:
        arguments["metadata"] = metadata

    return await call_geowiz_tool("save_finding", arguments)
