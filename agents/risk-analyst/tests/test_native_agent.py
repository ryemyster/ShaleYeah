from pathlib import Path

from shaleyeah_employee.models import ConfiguredModel
from shaleyeah_mcp import MCPClientConfig


def test_native_risk_analyst_owns_its_tools_and_exact_risk_review_boundary():
    from app.agent import create_risk_analyst_agent

    agent = create_risk_analyst_agent()
    assert agent.name == "risk_analyst"
    assert isinstance(agent.model, ConfiguredModel)
    assert not agent.sub_agents
    names = {getattr(tool, "__name__", getattr(tool, "name", "")) for tool in agent.tools}
    assert names >= {
        "risk_analyst_backend_status",
        "calculate_risk",
        "compare_risk_scenarios",
        "draft_risk",
        "prepare_risk_review",
        "risk_review_status",
        "record_risk_assessment",
    }
    write = next(
        tool for tool in agent.tools if getattr(tool, "name", "") == "record_risk_assessment"
    )
    assert write._require_confirmation is True
    assert "Stand-alone Agent with Progressive Disclosure (Skills)" in agent.instruction


def test_discovery_and_tools_share_the_operator_selected_external_connection():
    from app.agent import create_risk_analyst_agent

    async def credential():
        raise AssertionError("Discovery must not resolve credentials")

    agent = create_risk_analyst_agent(
        backend_config=MCPClientConfig(
            endpoint="https://operator.example/mcp", credential=credential
        )
    )
    status = next(
        tool
        for tool in agent.tools
        if getattr(tool, "__name__", "") == "risk_analyst_backend_status"
    )()
    assert status["url"] == "https://operator.example/mcp"
    assert status["independentBackend"] is True
    assert status["reviewBoundary"]["risk"] == "exact-authenticated-human-review-required"
    assert status["reviewBoundary"]["capitalCommitment"] == "unsupported"


def test_agent_module_is_owned_by_risk_analyst_instead_of_another_employee():
    from app import agent

    assert Path(agent.__file__).resolve().is_relative_to(Path(__file__).resolve().parents[1])
