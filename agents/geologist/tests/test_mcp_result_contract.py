"""Geology tool mappings and result passthrough; protocol conformance lives in the helper."""

import pytest
from shaleyeah_mcp import MCPClientError

from app import geowiz_mcp


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "wrapper, arguments",
    [
        (geowiz_mcp.assess_geowiz_quality, {"file_path": "licensed.las"}),
        (
            geowiz_mcp.analyze_geowiz_formation,
            {
                "file_path": "licensed.las",
                "formations": ["fixture"],
                "formation_name": "fixture",
                "formation_id": "formation-1",
                "match_threshold": 0.8,
            },
        ),
        (
            geowiz_mcp.process_geowiz_well_logs,
            {
                "file_path": "licensed.las",
                "well_name": "fixture",
                "well_id": "well-1",
                "cursor": "page-2",
                "page_size": 10,
            },
        ),
        (geowiz_mcp.process_geowiz_gis, {"file_path": "licensed.geojson"}),
        (
            geowiz_mcp.process_geowiz_access_database,
            {
                "file_path": "licensed.accdb",
                "extract_tables": ["wells"],
                "cursor": "page-2",
                "page_size": 10,
            },
        ),
        (geowiz_mcp.process_geowiz_document, {"file_path": "licensed.pdf"}),
        (geowiz_mcp.process_geowiz_seismic_data, {"file_path": "licensed.segy"}),
        (geowiz_mcp.process_geowiz_aries_database, {"file_path": "licensed.adb"}),
        (
            geowiz_mcp.save_geowiz_finding,
            {
                "finding_type": "formation",
                "title": "Draft",
                "summary": "Unaccepted",
                "confidence": 0.1,
                "data_source": "licensed.las",
                "metadata": {"reviewStatus": "draft"},
            },
        ),
    ],
)
async def test_role_hooks_preserve_arguments_and_backend_failures(monkeypatch, wrapper, arguments):
    calls = []
    expected = {"provider": "gemini", "model": "fixture-001"}

    async def installed_client(settings, name, values):
        if name == "get_model_profile":
            return {"structuredContent": {"success": True, "analysis": expected}, "isError": False}
        calls.append((settings.endpoint, name, values))
        return {
            "content": [],
            "structuredContent": {"success": False, "status": "partial"},
            "isError": True,
        }

    monkeypatch.setattr(geowiz_mcp, "call_tool", installed_client)
    monkeypatch.delenv("GEOWIZ_MCP_URL", raising=False)
    result = await geowiz_mcp.bind_backend(wrapper, geowiz_mcp._backend_config(), expected)(**arguments)
    assert len(calls) == 1
    assert calls[0][0] == "http://127.0.0.1:3001/mcp"
    assert calls[0][1] == wrapper.__name__.replace("_geowiz", "")
    assert result["toolName"] == calls[0][1]
    assert result["mcpServer"] == "geowiz"
    assert result["isError"] is True
    assert result["structuredContent"] == {"success": False, "status": "partial"}
    values = calls[0][2]
    if "file_path" in arguments:
        assert values["filePath"] == arguments["file_path"]
    if "page_size" in arguments:
        assert values["pageSize"] == arguments["page_size"]
        assert values["cursor"] == arguments["cursor"]


@pytest.mark.asyncio
async def test_typed_client_failure_propagates_without_fabricating_role_success(monkeypatch):
    async def installed_client(*_):
        raise MCPClientError("forbidden", "user_action")

    monkeypatch.setattr(geowiz_mcp, "call_tool", installed_client)
    with pytest.raises(MCPClientError) as error:
        await geowiz_mcp.assess_geowiz_quality("fixture.las")
    assert error.value.code == "forbidden"
