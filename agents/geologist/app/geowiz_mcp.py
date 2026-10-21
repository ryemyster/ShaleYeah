from __future__ import annotations

import inspect
import json
import math
import os
from contextvars import ContextVar
from functools import wraps
from pathlib import Path
from typing import Any

from shaleyeah_mcp import FileBearerCredential, MCPClientConfig, MCPClientError, call_tool

GEOWIZ_DEFAULT_URL = "http://127.0.0.1:3001/mcp"
_BINDING: ContextVar[tuple[MCPClientConfig, dict[str, Any] | None, Any] | None] = ContextVar("geologist_backend_binding", default=None)


def bind_backend(function, config: MCPClientConfig, expected_profile: dict[str, Any] | None, events=None):
    """Keep each employee's backend settings out of model arguments and global key state."""
    if inspect.iscoroutinefunction(function):
        @wraps(function)
        async def bound(*args, **kwargs):
            token = _BINDING.set((config, expected_profile, events))
            try:
                return await function(*args, **kwargs)
            finally:
                _BINDING.reset(token)
    else:
        @wraps(function)
        def bound(*args, **kwargs):
            token = _BINDING.set((config, expected_profile, events))
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
    binding = _BINDING.get()
    event_options = {"events": binding[2]} if binding and binding[2] is not None else {}
    if tool_name == "analyze_formation":
        binding = _BINDING.get()
        if not binding or not binding[1]:
            raise MCPClientError("invalid_configuration", "user_action")
        discovery = await call_tool(config, "get_model_profile", {}, **event_options)
        payload = discovery.get("structuredContent") or {}
        if discovery.get("isError") or payload.get("success") is not True or payload.get("analysis") != binding[1]:
            raise MCPClientError("model_binding_mismatch", "user_action")
    return {
        "backendUrl": config.endpoint,
        "mcpServer": "geowiz",
        "toolName": tool_name,
        **await call_tool(config, tool_name, arguments, **event_options),
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
    density_assumptions_json: str | None = None,
    review_confidence_json: str | None = None,
) -> dict[str, Any]:
    """Review approved LAS 2 observations; geology and model notes remain unreviewed.

    density_assumptions_json: Explicit matrixDensity, fluidDensity, unit (g/cm3
        or kg/m3), and basis. Omit to use declared LAS density parameters.
    review_confidence_json: Optional reviewer value (0-1) and basis; not measured
        model confidence. Never substitute a default for missing calibration.
    """

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
    if density_assumptions_json is not None:
        arguments["densityAssumptions"] = _review_input(density_assumptions_json, density=True)
    if review_confidence_json is not None:
        arguments["reviewConfidence"] = _review_input(review_confidence_json, density=False)

    return await call_geowiz_tool("analyze_formation", arguments)


def _review_input(text: str, *, density: bool) -> dict[str, Any]:
    """Validate explicit scenario fields before any credential resolution."""
    try:
        if len(text) > 2048:
            raise ValueError
        def pairs(items):
            result = {}
            for key, value in items:
                if key in result:
                    raise ValueError
                result[key] = value
            return result
        value = json.loads(text, object_pairs_hook=pairs)
        fields = {"matrixDensity", "fluidDensity", "unit", "basis"} if density else {"value", "basis"}
        if type(value) is not dict or set(value) != fields:
            raise ValueError
        if type(value["basis"]) is not str or not 1 <= len(value["basis"].strip()) <= 256:
            raise ValueError
        numbers = ("matrixDensity", "fluidDensity") if density else ("value",)
        for field in numbers:
            number = value[field]
            if type(number) not in (int, float) or not math.isfinite(number):
                raise ValueError
            if (density and number <= 0) or (not density and not 0 <= number <= 1):
                raise ValueError
        if density and value["unit"] not in ("g/cm3", "kg/m3"):
            raise ValueError
        return value
    except (ValueError, TypeError, OverflowError, RecursionError):
        raise MCPClientError("invalid_assumptions", "user_action") from None


async def process_geowiz_well_logs(
    file_path: str,
    format: str = "auto",
    quality_assessment: bool = True,
    well_name: str | None = None,
    well_id: str | None = None,
    cursor: str | None = None,
    page_size: int | None = None,
) -> dict[str, Any]:
    """Review approved LAS observations without inferring formations or pay."""

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
    review_id: str,
    packet_digest: str,
    grant_id: str,
) -> dict[str, Any]:
    """Save the exact backend-reviewed finding under its current bound grant.

    Obtain these references from get_geowiz_review_status after the enrolled human
    reviews the private packet. Confirmation alone cannot create a grant.
    """
    return await call_geowiz_tool("save_finding", {
        "reviewId": review_id, "packetDigest": packet_digest, "grantId": grant_id,
    })


async def prepare_geowiz_review(candidate_json: str, expected_head: str | None = None) -> dict[str, Any]:
    """Prepare exact canonical work, context, reported eval evidence and proposed finding.

    Returns a durable review reference only. Human inspection/decision is separate.
    expected_head is the previous packetDigest, or omitted for the first candidate.
    """
    try:
        if len(candidate_json.encode("utf8")) > 2_000_000:
            raise ValueError
        def pairs(items):
            values = {}
            for key, value in items:
                if key in values:
                    raise ValueError
                values[key] = value
            return values
        def reject_constant(_value):
            raise ValueError
        candidate = json.loads(candidate_json, object_pairs_hook=pairs,
                               parse_constant=reject_constant)
        if type(candidate) is not dict:
            raise ValueError
    except (ValueError, TypeError, RecursionError):
        raise MCPClientError("invalid_review_packet", "user_action") from None
    return await call_geowiz_tool("prepare_review", {"candidate": candidate, "expectedHead": expected_head})


async def get_geowiz_review_status(review_id: str | None = None) -> dict[str, Any]:
    """Read scoped restart-safe state; cannot inspect human-only evidence or decide."""
    return await call_geowiz_tool("get_review_status", {"reviewId": review_id} if review_id else {})
