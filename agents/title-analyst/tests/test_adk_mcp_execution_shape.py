from pathlib import Path


PACKAGE_ROOT = Path(__file__).resolve().parents[1]


def test_python_mcp_client_module_exists_for_title_execution() -> None:
    client = (PACKAGE_ROOT / "app" / "title_mcp.py").read_text()

    assert "from mcp import ClientSession" in client
    assert "streamablehttp_client" in client
    assert "async def call_title_tool" in client

    for function_name in (
        "examine_title_ownership",
        "analyze_title_lease",
        "check_title_burdens",
        "trace_title_chain_of_title",
    ):
        assert f"async def {function_name}" in client

    for title_tool_name in (
        "examine_ownership",
        "analyze_lease",
        "check_burdens",
        "trace_chain_of_title",
    ):
        assert f'"{title_tool_name}"' in client

    assert '"propertyDescription"' in client
    assert '"tractId"' in client
    assert '"pageSize"' in client
    assert "TITLE_MCP_URL" in client


def test_adk_root_agent_exposes_migrated_title_tools() -> None:
    agent = (PACKAGE_ROOT / "app" / "agent.py").read_text()

    assert "from app.title_mcp import (" in agent
    assert "examine_title_ownership" in agent
    assert "analyze_title_lease" in agent
    assert "check_title_burdens" in agent
    assert "trace_title_chain_of_title" in agent
    assert '"executionBoundary": "adk-mcp"' in agent
    assert '"examine_ownership": "examine_title_ownership"' in agent
    assert '"analyze_lease": "analyze_title_lease"' in agent
    assert '"check_burdens": "check_title_burdens"' in agent
    assert '"trace_chain_of_title": "trace_title_chain_of_title"' in agent
    assert "requiresReviewForLegalOpinion" in agent


def test_python_project_declares_adk_and_mcp_dependencies() -> None:
    pyproject = (PACKAGE_ROOT / "pyproject.toml").read_text()

    assert '"mcp>=' in pyproject
    assert '"google-adk[gcp]>=' in pyproject
    assert '"pytest>=' in pyproject
