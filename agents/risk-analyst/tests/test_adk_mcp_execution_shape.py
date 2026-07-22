from pathlib import Path


PACKAGE_ROOT = Path(__file__).resolve().parents[1]


def test_python_mcp_client_module_exists_for_risk_analysis_execution() -> None:
    client = (PACKAGE_ROOT / "app" / "risk_analysis_mcp.py").read_text()

    assert "from mcp import ClientSession" in client
    assert "streamablehttp_client" in client
    assert "async def call_risk_analysis_tool" in client
    assert "async def assess_investment_risk" in client
    assert "async def monte_carlo_simulation" in client
    assert '"assess_investment_risk"' in client
    assert '"monte_carlo_simulation"' in client
    assert '"projectData"' in client
    assert '"riskProfile"' in client
    assert '"analysisDepth"' in client
    assert '"targetIRR"' in client
    assert "RISK_ANALYSIS_MCP_URL" in client


def test_adk_root_agent_exposes_migrated_risk_analysis_tools() -> None:
    agent = (PACKAGE_ROOT / "app" / "agent.py").read_text()

    assert "from app.risk_analysis_mcp import (" in agent
    assert "assess_investment_risk" in agent
    assert "monte_carlo_simulation" in agent
    assert '"executionBoundary": "adk-mcp"' in agent
    assert '"assess_investment_risk"' in agent
    assert '"monte_carlo_simulation"' in agent
    assert "requiresReviewForFinalApproval" in agent


def test_python_project_declares_adk_and_mcp_dependencies() -> None:
    pyproject = (PACKAGE_ROOT / "pyproject.toml").read_text()

    assert '"mcp>=' in pyproject
    assert '"google-adk[gcp]>=' in pyproject
    assert '"pytest>=' in pyproject
