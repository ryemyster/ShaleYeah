from pathlib import Path

from shaleyeah_employee.models import ConfiguredModel
from shaleyeah_mcp import MCPClientConfig


def test_native_drilling_agent_owns_citation_and_memo_tools_and_requires_confirmation_for_recording():
    from app.agent import create_drilling_engineer_agent

    agent = create_drilling_engineer_agent()
    assert agent.name == "drilling_engineer"
    assert isinstance(agent.model, ConfiguredModel)
    assert not agent.sub_agents
    names = {getattr(tool, "__name__", getattr(tool, "name", "")) for tool in agent.tools}
    assert names == {
        "drilling_engineer_backend_status",
        "read_drilling_inputs",
        "read_drilling_source",
        "read_drilling_evidence",
        "cite_drilling_evidence",
        "get_context_source_metadata",
        "design_drilling_program",
        "estimate_well_costs",
        "assess_drilling_risks",
        "draft_drilling_packet",
        "prepare_drilling_review",
        "drilling_review_status",
        "record_drilling_packet",
    }
    write = next(
        tool for tool in agent.tools if getattr(tool, "name", "") == "record_drilling_packet"
    )
    assert write._require_confirmation is True
    assert "Stand-alone Agent with Progressive Disclosure (Skills)" in agent.instruction
    assert "qualified human" in agent.instruction


def test_discovery_uses_operator_selected_backend_without_resolving_credentials():
    from app.agent import create_drilling_engineer_agent

    async def credential():
        raise AssertionError("Discovery must not resolve credentials")

    agent = create_drilling_engineer_agent(
        backend_config=MCPClientConfig(
            endpoint="https://operator.example/mcp", credential=credential
        )
    )
    status = next(
        tool
        for tool in agent.tools
        if getattr(tool, "__name__", "") == "drilling_engineer_backend_status"
    )()
    assert status["url"] == "https://operator.example/mcp"
    assert status["independentBackend"] is True
    assert status["reviewBoundary"]["packet"] == "exact-enrolled-human-review-required"
    for key in (
        "operationalApproval",
        "spud",
        "wellControl",
        "safetyCertification",
        "professionalAcceptance",
        "capitalCommitment",
    ):
        assert status["reviewBoundary"][key] == "unsupported"


def test_agent_module_is_owned_by_drilling_engineer():
    from app import agent

    assert Path(agent.__file__).resolve().is_relative_to(Path(__file__).resolve().parents[1])
