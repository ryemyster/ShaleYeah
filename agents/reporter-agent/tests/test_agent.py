import pytest
from shaleyeah_employee.models import ConfiguredModel
from shaleyeah_mcp import MCPClientConfig

from app.agent import create_reporter_agent, reporter_backend_status


def test_standalone_native_tools_and_human_publication_boundary():
    agent = create_reporter_agent()
    assert agent.name == "reporter"
    assert isinstance(agent.model, ConfiguredModel)
    assert not agent.sub_agents
    assert "Stand-alone Agent with Progressive Disclosure (Skills)" in agent.instruction
    assert "human" in agent.instruction
    assert "exact" in agent.instruction
    assert "source" in agent.instruction
    assert (
        reporter_backend_status()["architectureMode"]
        == "stand-alone-with-progressive-disclosure-skills"
    )
    assert {getattr(tool, "__name__", getattr(tool, "name", "")) for tool in agent.tools} >= {
        "draft_report",
        "read_reviewed_source",
        "prepare_report_review",
        "report_review_status",
        "release_report",
    }
    release = next(tool for tool in agent.tools if getattr(tool, "name", "") == "release_report")
    assert release._require_confirmation is True


def test_factory_discovery_uses_the_same_explicit_external_backend_as_its_execution_tools():
    async def credential():
        return "fixture-private-token"

    agent = create_reporter_agent(
        backend_config=MCPClientConfig(
            endpoint="https://external.internal/mcp", credential=credential
        )
    )
    status = next(
        tool for tool in agent.tools if getattr(tool, "__name__", "") == "reporter_backend_status"
    )
    assert status()["url"] == "https://external.internal/mcp"


@pytest.mark.asyncio
async def test_role_tool_uses_configured_external_backend_and_shared_client(monkeypatch):
    from app import reporter_mcp

    calls = []

    async def credential():
        return "fixture-private-token"

    async def client(config, name, arguments, **kwargs):
        calls.append((config.endpoint, name, arguments))
        return {"structuredContent": {"success": True, "analysis": {"status": "awaiting-review"}}}

    monkeypatch.setattr(reporter_mcp, "call_tool", client)
    tools = reporter_mcp.ReporterTools(
        MCPClientConfig(endpoint="https://external.internal/mcp", credential=credential)
    )
    await tools.draft_report(
        ["product.source"], "Owner", "Review", "private-review-v1", ["Not certification"]
    )
    assert calls == [
        (
            "https://external.internal/mcp",
            "draft_report",
            {
                "sourceIds": ["product.source"],
                "requirements": {
                    "audience": "Owner",
                    "purpose": "Review",
                    "templateId": "private-review-v1",
                    "disclosures": ["Not certification"],
                },
            },
        )
    ]


@pytest.mark.asyncio
@pytest.mark.parametrize("candidate", ['{"work": {}, "work": {}}', '{"work": NaN}', "[]"])
async def test_invalid_review_json_is_rejected_before_credential_or_tool_access(
    monkeypatch, candidate
):
    from shaleyeah_mcp import MCPClientError

    from app import reporter_mcp

    async def forbidden(*args, **kwargs):
        raise AssertionError("Invalid review input must not dispatch")

    monkeypatch.setattr(reporter_mcp, "call_tool", forbidden)
    tools = reporter_mcp.ReporterTools(
        MCPClientConfig(endpoint="https://external.internal/mcp", credential=forbidden)
    )
    with pytest.raises(MCPClientError) as caught:
        await tools.prepare_report_review(candidate)
    assert caught.value.code == "invalid_arguments"
