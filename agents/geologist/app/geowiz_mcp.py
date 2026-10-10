from __future__ import annotations

import inspect
import os
from contextvars import ContextVar
from functools import wraps
from pathlib import Path
from typing import Any

from shaleyeah_mcp import FileBearerCredential, MCPClientConfig, MCPClientError, call_tool

GEOWIZ_DEFAULT_URL = "http://127.0.0.1:3001/mcp"
_BINDING: ContextVar[tuple[MCPClientConfig, dict[str, Any] | None] | None] = ContextVar("geologist_backend_binding", default=None)


def bind_backend(function, config: MCPClientConfig, expected_profile: dict[str, Any] | None):
    """Keep each employee's backend settings out of model arguments and global key state."""
    if inspect.iscoroutinefunction(function):
        @wraps(function)
        async def bound(*args, **kwargs):
            token = _BINDING.set((config, expected_profile))
            try:
                return await function(*args, **kwargs)
            finally:
                _BINDING.reset(token)
    else:
        @wraps(function)
        def bound(*args, **kwargs):
            token = _BINDING.set((config, expected_profile))
            try:
                return function(*args, **kwargs)
            finally:
                _BINDING.reset(token)
    return bound


async def _missing_credential() -> str:
    raise MCPClientError("authentication_required", "auth_required")


def _backend_config() -> MCPClientConfig:
    binding = _BINDING.get()
    if binding:
        return binding[0]
    reference = os.getenv("GEOWIZ_MCP_ACCESS_TOKEN_FILE")
    try:
        total_timeout = float(os.getenv("GEOWIZ_MCP_TIMEOUT_SECONDS", "30"))
        request_timeout = float(os.getenv("GEOWIZ_MCP_REQUEST_TIMEOUT_SECONDS", "10"))
        attempts = int(os.getenv("GEOWIZ_MCP_PREFLIGHT_ATTEMPTS", "2"))
    except (ValueError, TypeError):
        raise MCPClientError("invalid_configuration", "user_action") from None
    return MCPClientConfig(
        endpoint=os.getenv("GEOWIZ_MCP_URL", GEOWIZ_DEFAULT_URL),
        credential=FileBearerCredential(Path(reference)) if reference else _missing_credential,
        allow_loopback_http=True,
        total_timeout=total_timeout,
        request_timeout=request_timeout,
        preflight_attempts=attempts,
    )


def geowiz_backend_url() -> str:
    """Return a validated credential-free destination for execution/status/planning."""
    return _backend_config().endpoint


async def call_geowiz_tool(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    """Call the installed MCP client; geology mappings and configuration stay here."""
    config = _backend_config()
    if tool_name == "analyze_formation":
        binding = _BINDING.get()
        if not binding or not binding[1]:
            raise MCPClientError("invalid_configuration", "user_action")
        discovery = await call_tool(config, "get_model_profile", {})
        payload = discovery.get("structuredContent") or {}
        if discovery.get("isError") or payload.get("success") is not True or payload.get("analysis") != binding[1]:
            raise MCPClientError("model_binding_mismatch", "user_action")
    return {
        "backendUrl": config.endpoint,
        "mcpServer": "geowiz",
        "toolName": tool_name,
        **await call_tool(config, tool_name, arguments),
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
