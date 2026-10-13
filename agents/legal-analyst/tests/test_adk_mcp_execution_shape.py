from pathlib import Path

PACKAGE_ROOT = Path(__file__).resolve().parents[1]


def test_python_mcp_client_module_exists_for_legal_execution() -> None:
    client = (PACKAGE_ROOT / "app" / "legal_mcp.py").read_text()

    assert "from shaleyeah_mcp import call_tool, load_mcp_config" in client
    assert "load_mcp_config" in client
    assert "async def call_legal_tool" in client
    assert "async def analyze_legal_framework" in client
    assert "async def review_contract" in client
    assert "async def assess_compliance" in client
    assert '"analyze_legal_framework"' in client
    assert '"review_contract"' in client
    assert '"assess_compliance"' in client
    assert '"projectType"' in client
    assert '"contractType"' in client
    assert '"keyTerms"' in client
    assert '"riskProfile"' in client
    assert '"assetCount"' in client
    assert 'load_mcp_config("LEGAL"' in client


def test_adk_root_agent_exposes_migrated_legal_tools() -> None:
    agent = (PACKAGE_ROOT / "app" / "agent.py").read_text()

    assert "from app.legal_mcp import (" in agent
    assert "analyze_legal_framework" in agent
    assert "review_contract" in agent
    assert "assess_compliance" in agent
    assert '"executionBoundary": "adk-mcp"' in agent
    assert '"analyze_legal_framework": "analyze_legal_framework"' in agent
    assert '"review_contract": "review_contract"' in agent
    assert '"assess_compliance": "assess_compliance"' in agent
    assert "requiresHumanLegalReviewForBindingAction" in agent


def test_python_project_declares_adk_and_mcp_dependencies() -> None:
    pyproject = (PACKAGE_ROOT / "pyproject.toml").read_text()

    assert '"shaleyeah-mcp-client==0.3.0"' in pyproject
    assert '"google-adk[gcp]>=' in pyproject
    assert '"pytest>=' in pyproject
