from pathlib import Path

from shaleyeah_employee.models import ConfiguredModel
from shaleyeah_mcp import MCPClientConfig


def test_native_qa_employee_uses_own_tools_and_authenticated_disposition_boundary():
    from app.agent import create_qa_agent

    agent = create_qa_agent()
    assert agent.name == "quality_assurance"
    assert isinstance(agent.model, ConfiguredModel)
    assert not agent.sub_agents
    names = {getattr(tool, "__name__", getattr(tool, "name", "")) for tool in agent.tools}
    assert names >= {
        "qa_backend_status",
        "run_quality_checks",
        "read_quality_report",
        "prepare_disposition_review",
        "disposition_review_status",
        "record_disposition",
    }
    write = next(tool for tool in agent.tools if getattr(tool, "name", "") == "record_disposition")
    assert write._require_confirmation is True
    assert "FAIL" in agent.instruction and "human" in agent.instruction
    assert "Stand-alone Agent with Progressive Disclosure (Skills)" in agent.instruction


def test_backend_discovery_and_tools_share_the_explicit_external_connection():
    from app.agent import create_qa_agent

    async def credential():
        raise AssertionError("Status must not resolve credentials")

    agent = create_qa_agent(
        backend_config=MCPClientConfig(
            endpoint="https://operator.example/mcp", credential=credential
        )
    )
    status = next(
        tool for tool in agent.tools if getattr(tool, "__name__", "") == "qa_backend_status"
    )
    value = status()
    assert value["url"] == "https://operator.example/mcp"
    assert (
        value["reviewBoundary"]["criticalDisposition"]
        == "exact-authenticated-human-review-required"
    )


def test_employee_module_belongs_to_qa_package_not_another_role():
    from app import agent

    assert Path(agent.__file__).resolve().is_relative_to(Path(__file__).resolve().parents[1])
