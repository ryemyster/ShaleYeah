from pathlib import Path


PACKAGE_ROOT = Path(__file__).resolve().parents[1]


def test_python_mcp_client_module_exists_for_geowiz_execution() -> None:
    client = (PACKAGE_ROOT / "app" / "geowiz_mcp.py").read_text()

    assert "from mcp import ClientSession" in client
    assert "streamablehttp_client" in client
    assert "async def call_geowiz_tool" in client

    for function_name in (
        "analyze_geowiz_formation",
        "assess_geowiz_quality",
        "process_geowiz_well_logs",
        "process_geowiz_gis",
        "process_geowiz_access_database",
        "process_geowiz_document",
        "process_geowiz_seismic_data",
        "process_geowiz_aries_database",
        "save_geowiz_finding",
    ):
        assert f"async def {function_name}" in client

    for geowiz_tool_name in (
        "analyze_formation",
        "assess_quality",
        "process_well_logs",
        "process_gis",
        "process_access_database",
        "process_document",
        "process_seismic_data",
        "process_aries_database",
        "save_finding",
    ):
        assert f'"{geowiz_tool_name}"' in client

    assert '"pageSize"' in client
    assert "GEOWIZ_MCP_URL" in client


def test_adk_root_agent_exposes_migrated_geowiz_execution_tools() -> None:
    agent = (PACKAGE_ROOT / "app" / "agent.py").read_text()

    assert "from google.adk.tools import FunctionTool" in agent
    assert "from app.geowiz_mcp import (" in agent

    for function_name in (
        "analyze_geowiz_formation",
        "assess_geowiz_quality",
        "process_geowiz_well_logs",
        "process_geowiz_gis",
        "process_geowiz_access_database",
        "process_geowiz_document",
        "process_geowiz_seismic_data",
        "process_geowiz_aries_database",
        "save_geowiz_finding",
    ):
        assert function_name in agent

    assert '"executionBoundary": "adk-mcp"' in agent
    assert '"analyze_formation": "analyze_geowiz_formation"' in agent
    assert '"process_access_database": "process_geowiz_access_database"' in agent
    assert '"process_aries_database": "process_geowiz_aries_database"' in agent
    assert '"process_document": "process_geowiz_document"' in agent
    assert '"process_seismic_data": "process_geowiz_seismic_data"' in agent
    assert '"process_well_logs": "process_geowiz_well_logs"' in agent
    assert '"process_gis": "process_geowiz_gis"' in agent
    assert "FunctionTool(save_geowiz_finding, require_confirmation=True)" in agent


def test_python_project_declares_adk_and_mcp_dependencies() -> None:
    pyproject = (PACKAGE_ROOT / "pyproject.toml").read_text()

    assert '"mcp>=' in pyproject
    assert '"google-adk[gcp]>=' in pyproject
    assert '"pytest>=' in pyproject
