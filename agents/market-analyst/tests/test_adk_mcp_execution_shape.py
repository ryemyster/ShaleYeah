from pathlib import Path

PACKAGE_ROOT = Path(__file__).resolve().parents[1]


def test_python_mcp_client_module_exists_for_market_execution() -> None:
    client = (PACKAGE_ROOT / "app" / "market_mcp.py").read_text()

    assert "from shaleyeah_mcp import call_tool, load_mcp_config" in client
    assert "load_mcp_config" in client
    assert "async def call_market_tool" in client
    assert "async def analyze_market_conditions" in client
    assert "async def competitive_market_analysis" in client
    assert '"analyze_market_conditions"' in client
    assert '"competitive_analysis"' in client
    assert '"commodity"' in client
    assert '"region"' in client
    assert '"timeframe"' in client
    assert '"competitors"' in client
    assert '"metrics"' in client
    assert 'load_mcp_config("MARKET"' in client


def test_adk_root_agent_exposes_migrated_market_tools() -> None:
    agent = (PACKAGE_ROOT / "app" / "agent.py").read_text()

    assert "from app.market_mcp import (" in agent
    assert "analyze_market_conditions" in agent
    assert "competitive_market_analysis" in agent
    assert '"executionBoundary": "adk-mcp"' in agent
    assert '"analyze_market_conditions": "analyze_market_conditions"' in agent
    assert '"competitive_analysis": "competitive_market_analysis"' in agent
    assert "requiresReviewForFinalBidOrInvestmentRecommendation" in agent


def test_python_project_declares_adk_and_mcp_dependencies() -> None:
    pyproject = (PACKAGE_ROOT / "pyproject.toml").read_text()

    assert '"shaleyeah-mcp-client==0.3.0"' in pyproject
    assert '"google-adk[gcp]>=' in pyproject
    assert '"pytest>=' in pyproject
