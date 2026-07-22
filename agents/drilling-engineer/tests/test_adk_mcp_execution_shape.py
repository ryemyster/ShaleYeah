from pathlib import Path


PACKAGE_ROOT = Path(__file__).resolve().parents[1]


def test_python_mcp_client_module_exists_for_drilling_execution() -> None:
    client = (PACKAGE_ROOT / "app" / "drilling_mcp.py").read_text()

    assert "from mcp import ClientSession" in client
    assert "streamablehttp_client" in client
    assert "async def call_drilling_tool" in client

    for function_name in (
        "design_drilling_program",
        "estimate_well_costs",
        "assess_drilling_risks",
    ):
        assert f"async def {function_name}" in client

    for drilling_tool_name in (
        "design_drilling_program",
        "estimate_well_costs",
        "assess_drilling_risks",
    ):
        assert f'"{drilling_tool_name}"' in client

    assert "DRILLING_MCP_URL" in client


def test_adk_root_agent_exposes_migrated_drilling_execution_tools() -> None:
    agent = (PACKAGE_ROOT / "app" / "agent.py").read_text()

    assert "from app.drilling_mcp import (" in agent

    for function_name in (
        "design_drilling_program",
        "estimate_well_costs",
        "assess_drilling_risks",
    ):
        assert function_name in agent

    assert '"executionBoundary": "adk-mcp"' in agent
    assert '"design": "design_drilling_program"' in agent
    assert '"costs": "estimate_well_costs"' in agent
    assert '"risks": "assess_drilling_risks"' in agent
    assert '"requiresReviewForFinalDrillingProgram": True' in agent


def test_python_project_declares_adk_and_mcp_dependencies() -> None:
    pyproject = (PACKAGE_ROOT / "pyproject.toml").read_text()

    assert '"mcp>=' in pyproject
    assert '"google-adk[gcp]>=' in pyproject
    assert '"pytest>=' in pyproject
