from pathlib import Path

from shaleyeah_employee.models import ConfiguredModel
from shaleyeah_mcp import MCPClientConfig


def test_native_title_agent_owns_citation_and_memo_tools_and_requires_confirmation_for_recording():
    from app.agent import create_title_analyst_agent

    agent = create_title_analyst_agent()
    assert agent.name == "title_analyst"
    assert isinstance(agent.model, ConfiguredModel)
    assert not agent.sub_agents
    names = {getattr(tool, "__name__", getattr(tool, "name", "")) for tool in agent.tools}
    assert names == {
        "title_analyst_backend_status",
        "read_title_inputs",
        "read_title_source",
        "read_title_instrument",
        "cite_title_instrument",
        "get_context_source_metadata",
        "examine_ownership",
        "trace_chain_of_title",
        "check_burdens",
        "analyze_lease",
        "draft_title_packet",
        "prepare_title_review",
        "title_review_status",
        "record_title_packet",
    }
    write = next(tool for tool in agent.tools if getattr(tool, "name", "") == "record_title_packet")
    assert write._require_confirmation is True
    assert "Stand-alone Agent with Progressive Disclosure (Skills)" in agent.instruction
    assert "qualified human" in agent.instruction


def test_discovery_uses_operator_selected_backend_without_resolving_credentials():
    from app.agent import create_title_analyst_agent

    async def credential():
        raise AssertionError("Discovery must not resolve credentials")

    agent = create_title_analyst_agent(
        backend_config=MCPClientConfig(
            endpoint="https://operator.example/mcp", credential=credential
        )
    )
    status = next(
        tool
        for tool in agent.tools
        if getattr(tool, "__name__", "") == "title_analyst_backend_status"
    )()
    assert status["url"] == "https://operator.example/mcp"
    assert status["independentBackend"] is True
    assert status["reviewBoundary"]["packet"] == "exact-enrolled-human-review-required"
    for key in (
        "titleClearance",
        "legalOpinion",
        "filing",
        "externalTransfer",
        "leaseAcceptance",
        "capitalCommitment",
    ):
        assert status["reviewBoundary"][key] == "unsupported"


def test_agent_module_is_owned_by_title_analyst():
    from app import agent

    assert Path(agent.__file__).resolve().is_relative_to(Path(__file__).resolve().parents[1])
