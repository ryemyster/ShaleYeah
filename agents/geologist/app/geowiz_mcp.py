from __future__ import annotations

import json
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


def _validate_schema(value: Any, schema: dict[str, Any], label: str) -> None:
    from jsonschema import SchemaError, ValidationError
    from jsonschema.validators import validator_for

    try:
        validator = validator_for(schema)
        validator.check_schema(schema)
        validator(schema).validate(value)
    except (SchemaError, ValidationError) as exc:
        raise RuntimeError(f"Invalid MCP {label} for the advertised schema") from exc


async def _discover_tool(session: Any, name: str) -> Any:
    cursor = None
    selected = None
    seen_cursors: set[str] = set()
    for _ in range(32):
        page = await session.list_tools(**({"cursor": cursor} if cursor else {}))
        matches = [tool for tool in page.tools if tool.name == name]
        if len(matches) > 1 or (matches and selected is not None):
            raise RuntimeError(f"MCP tool discovery is ambiguous: {name}")
        if matches:
            selected = matches[0]
        cursor = getattr(page, "nextCursor", None)
        if not cursor:
            if selected is not None:
                return selected
            raise RuntimeError(f"MCP tool was not advertised: {name}")
        if cursor in seen_cursors:
            raise RuntimeError("MCP tool discovery cursor repeated")
        seen_cursors.add(cursor)
    raise RuntimeError("MCP tool discovery exceeded 32 pages")


def _legacy_failure(payload: Any, depth: int = 0) -> bool:
    if not isinstance(payload, dict):
        return False
    if depth > 3:
        raise RuntimeError("Legacy MCP result nesting exceeded supported depth")
    if payload.get("success") is False:
        return True
    if payload.get("error_type") in (
        "auth_required",
        "user_action",
        "retryable",
        "permanent",
    ) and isinstance(payload.get("error"), (str, dict)):
        return True
    # Only the documented legacy success wrappers are examined, never arbitrary domain fields.
    if payload.get("success") is True:
        return any(_legacy_failure(payload.get(key), depth + 1) for key in ("data", "analysis"))
    return False


def _read_result(result: Any, output_schema: dict[str, Any] | None) -> dict[str, Any]:
    content = serialize_mcp_content(result.content)
    structured = getattr(result, "structuredContent", None)
    is_error = bool(getattr(result, "isError", False))
    json_values = []
    for block in content:
        if block.get("type") == "text":
            try:
                json_values.append(json.loads(block["text"]))
            except (ValueError, KeyError, TypeError):
                pass
    if structured is not None:
        if not isinstance(structured, dict):
            raise RuntimeError("MCP structured result must be an object")
        if any(value != structured for value in json_values):
            raise RuntimeError("MCP structured and JSON text results conflict")
        is_error = is_error or _legacy_failure(structured)
    else:
        is_error = is_error or any(_legacy_failure(value) for value in json_values)
    if not is_error and output_schema is not None:
        if structured is None:
            raise RuntimeError("MCP output schema requires structuredContent")
        _validate_schema(structured, output_schema, "output result")
    return {"content": content, "structuredContent": structured, "isError": is_error}


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
            tool = await _discover_tool(session, tool_name)
            _validate_schema(arguments, tool.inputSchema, "input arguments")
            result = await session.call_tool(tool_name, arguments)
            return {
                "backendUrl": backend_url,
                "mcpServer": "geowiz",
                "toolName": tool_name,
                **_read_result(result, getattr(tool, "outputSchema", None)),
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
