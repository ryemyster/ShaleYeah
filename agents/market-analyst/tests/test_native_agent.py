"""Native factory and confirmation wiring; role output quality is evaluated separately."""

from pathlib import Path

from shaleyeah_employee.models import ConfiguredModel
from shaleyeah_mcp import MCPClientConfig


def test_native_market_agent_uses_installed_model_and_exact_source_bound_tools():
    from app.agent import create_market_analyst_agent

    agent = create_market_analyst_agent()
    assert agent.name == "market_analyst"
    assert isinstance(agent.model, ConfiguredModel)
    assert not agent.sub_agents
    names = {getattr(tool, "__name__", getattr(tool, "name", "")) for tool in agent.tools}
    assert names == {
        "analyze_market_conditions",
        "competitive_market_analysis",
        "market_analyst_backend_status",
        "read_market_inputs",
        "read_market_source",
        "get_context_source_metadata",
        "calculate_market_scenarios",
        "draft_market_scenario",
        "prepare_market_review",
        "market_review_status",
        "record_market_scenarios",
    }
    write = next(
        tool for tool in agent.tools if getattr(tool, "name", "") == "record_market_scenarios"
    )
    assert write._require_confirmation is True
    assert "Stand-alone Agent with Progressive Disclosure (Skills)" in agent.instruction


def test_discovery_uses_the_host_backend_without_resolving_its_credential():
    from app.agent import create_market_analyst_agent

    async def credential():
        raise AssertionError("Discovery cannot resolve a credential")

    agent = create_market_analyst_agent(
        backend_config=MCPClientConfig(
            endpoint="https://operator.example/mcp", credential=credential
        )
    )
    status = next(
        tool
        for tool in agent.tools
        if getattr(tool, "__name__", "") == "market_analyst_backend_status"
    )()
    assert status["url"] == "https://operator.example/mcp"
    assert status["independentBackend"] is True
    assert status["reviewBoundary"]["scenarioPacket"] == "exact-enrolled-human-review-required"
    for key in ("trading", "contracts", "bids", "capitalCommitment"):
        assert status["reviewBoundary"][key] == "unsupported"


def test_agent_is_package_owned_and_has_no_displaced_planning_or_npm_runtime():
    from app import agent

    root = Path(__file__).resolve().parents[1]
    assert Path(agent.__file__).resolve().is_relative_to(root)
    assert agent.app.name == "app"
    assert not hasattr(agent, "plan_market_tool_call")
    for path in ("package.json", "tsconfig.json", "biome.json", "src/agent"):
        assert not (root / path).exists()
