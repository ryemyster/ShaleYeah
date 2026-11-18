import json

import pytest
from shaleyeah_mcp import MCPClientConfig, MCPClientError


async def no_credential():
    raise AssertionError("Mapping tests must not resolve credentials")


@pytest.mark.asyncio
async def test_role_tools_preserve_exact_task_model_revisions_and_current_review_names(monkeypatch):
    from app import risk_analysis_mcp as role

    calls = []

    async def client(config, name, arguments, **kwargs):
        calls.append((name, arguments))
        return {
            "isError": False,
            "structuredContent": {"success": True, "analysis": {"riskAccepted": False}},
            "content": [{"type": "text", "text": "duplicate"}],
        }

    monkeypatch.setattr(role, "call_tool", client)
    tools = role.RiskAnalystTools(
        MCPClientConfig(endpoint="https://operator.example/mcp", credential=no_credential)
    )
    await tools.read_risk_inputs("task.risk", "r1")
    await tools.read_risk_source("source.register", "r2", 20, 100)
    result = await tools.calculate_risk("task.risk", "r1", "joint.base", "r2")
    assert result["structuredContent"]["analysis"]["riskAccepted"] is False
    assert "content" not in result
    await tools.compare_risk_scenarios("task.risk", "r1", [{"id": "joint.base", "revision": "r2"}])
    await tools.draft_risk("task.risk", "r1", "joint.base", "r2", "r3")
    await tools.prepare_risk_review('{"work":{}}')
    await tools.risk_review_status("review.risk")
    await tools.record_risk_assessment("review.risk", "a" * 64, "grant.risk")
    assert [name for name, _ in calls] == [
        "read_risk_inputs",
        "read_risk_source",
        "calculate_risk",
        "compare_risk_scenarios",
        "draft_risk",
        "prepare_risk_review",
        "risk_review_status",
        "record_risk_assessment",
    ]
    assert calls[2][1] == {
        "taskRef": {"id": "task.risk", "revision": "r1"},
        "modelRef": {"id": "joint.base", "revision": "r2"},
    }
    assert calls[4][1] == {
        "taskRef": {"id": "task.risk", "revision": "r1"},
        "modelRef": {"id": "joint.base", "revision": "r2"},
        "revision": "r3",
    }


@pytest.mark.asyncio
async def test_model_work_is_verified_before_retention_and_boolean_is_not_a_numeric_value(
    monkeypatch,
):
    from app import risk_analysis_mcp as role

    work = {
        "scope": {"taskId": "task.risk"},
        "taskRevision": "r1",
        "artifact": {"revision": "r1"},
        "findings": [{"value": 1}],
    }
    risk = {"definition": {"modelRef": {"id": "joint.base", "revision": "r1"}}}
    recorded = []

    class Hooks:
        async def review_context(self, actual):
            recorded.append(actual)
            return {"host": "context"}

        async def record_review(self, receipt):
            recorded.append(receipt)

    async def client(config, name, args, **kwargs):
        if name == "draft_risk":
            return {
                "structuredContent": {"success": True, "analysis": {"work": work, "risk": risk}}
            }
        assert name == "prepare_risk_review" and args["candidate"]["context"] == {"host": "context"}
        return {"structuredContent": {"success": True, "analysis": {"state": "awaiting-review"}}}

    monkeypatch.setattr(role, "call_tool", client)
    tools = role.RiskAnalystTools(
        MCPClientConfig(endpoint="https://operator.example/mcp", credential=no_credential),
        context_hooks=Hooks(),
    )
    candidate = {"work": work, "risk": risk, "evaluations": []}
    forged = json.loads(json.dumps(candidate))
    forged["work"]["findings"][0]["value"] = True
    with pytest.raises(MCPClientError) as caught:
        await tools.prepare_risk_review(json.dumps(forged))
    assert caught.value.code == "source_fidelity_mismatch"
    assert not recorded
    await tools.prepare_risk_review(json.dumps(candidate))
    assert recorded == [work, {"state": "awaiting-review"}]


@pytest.mark.asyncio
async def test_shared_review_supervisor_translates_only_fixed_role_operations():
    from app.review_supervision import ReviewSupervisor

    calls = []

    async def client(config, name, args):
        calls.append(name)
        value = (
            {
                "reviewId": "review.risk",
                "state": "approved",
                "packetDigest": "a" * 64,
                "grantId": "grant.risk",
            }
            if name == "risk_review_status"
            else {"stored": True}
        )
        return {"structuredContent": {"success": True, "analysis": value}}

    supervisor = ReviewSupervisor(
        MCPClientConfig(endpoint="https://operator.example/mcp", credential=no_credential),
        client=client,
    )
    assert (await supervisor.resume("review.risk"))["state"] == "completed"
    assert calls == ["risk_review_status", "record_risk_assessment"]


@pytest.mark.asyncio
@pytest.mark.parametrize("text", ['{"work":{},"work":{}}', '{"work":NaN}', "[]", '{"work":1e309}'])
async def test_invalid_review_json_never_dispatches(monkeypatch, text):
    from app import risk_analysis_mcp as role

    async def forbidden(*args, **kwargs):
        raise AssertionError("Invalid JSON must not dispatch")

    monkeypatch.setattr(role, "call_tool", forbidden)
    tools = role.RiskAnalystTools(
        MCPClientConfig(endpoint="https://operator.example/mcp", credential=no_credential)
    )
    with pytest.raises(MCPClientError):
        await tools.prepare_risk_review(text)
