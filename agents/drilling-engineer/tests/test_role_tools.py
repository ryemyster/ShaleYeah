import copy
import json

import pytest
from shaleyeah_mcp import MCPClientConfig, MCPClientError


async def no_credential():
    raise AssertionError("Mapping tests must not resolve credentials")


@pytest.mark.asyncio
async def test_role_tools_preserve_task_document_provision_and_review_bindings(monkeypatch):
    from app import drilling_mcp as role

    calls = []

    async def client(config, name, arguments, **kwargs):
        calls.append((name, arguments))
        return {
            "isError": False,
            "structuredContent": {"success": True, "analysis": {"operationalApproval": False}},
            "content": [{"type": "text", "text": "duplicate encoding"}],
        }

    monkeypatch.setattr(role, "call_tool", client)
    tools = role.DrillingEngineerTools(
        MCPClientConfig(endpoint="https://operator.example/mcp", credential=no_credential)
    )
    await tools.read_drilling_inputs("task.drilling", "r1")
    await tools.read_drilling_source("source.corpus", "r2", 20, 100)
    await tools.read_drilling_evidence(
        "task.drilling", "r1", "evidence.contract", "r2", "transfer", 0, 6
    )
    result = await tools.cite_drilling_evidence(
        "task.drilling", "r1", "evidence.contract", "r2", "transfer", "Café 🛢 LLC"
    )
    assert "content" not in result
    await tools.get_context_source_metadata("source.corpus", "r2", "export")
    selected = [
        {"evidenceRef": {"id": "evidence.contract", "revision": "r2"}, "sectionId": "transfer"}
    ]
    await tools.design_drilling_program("task.drilling", "r1")
    await tools.estimate_well_costs("task.drilling", "r1")
    await tools.assess_drilling_risks("task.drilling", "r1")
    proposal = {"version": "0.1.0", "summary": "Proposed memo", "observations": []}
    await tools.draft_drilling_packet("task.drilling", "r1", json.dumps(proposal), "r3")
    await tools.prepare_drilling_review('{"work":{}}')
    await tools.drilling_review_status("review.drilling")
    await tools.record_drilling_packet("review.drilling", "a" * 64, "grant.drilling")
    assert [name for name, _ in calls] == [
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
    ]
    assert calls[2][1] == {
        "taskRef": {"id": "task.drilling", "revision": "r1"},
        **selected[0],
        "offset": 0,
        "maxChars": 6,
    }
    assert calls[3][1] == {
        "taskRef": {"id": "task.drilling", "revision": "r1"},
        **selected[0],
        "quote": "Café 🛢 LLC",
    }
    assert calls[8][1] == {
        "taskRef": {"id": "task.drilling", "revision": "r1"},
        "proposal": proposal,
        "revision": "r3",
    }
    assert "riskProfile" not in json.dumps(calls)


@pytest.mark.asyncio
async def test_current_cited_work_is_verified_before_host_context_is_retained(monkeypatch):
    from app import drilling_mcp as role

    work = {
        "scope": {"taskId": "task.drilling"},
        "taskRevision": "r1",
        "artifact": {"revision": "r1"},
        "findings": [{"value": 0}],
    }
    drilling = {
        "version": "0.1.0",
        "summary": "Proposed memo",
        "observations": [],
        "operationalApproval": False,
    }
    retained, calls = [], []

    class Hooks:
        async def review_context(self, actual):
            retained.append(actual)
            return {"host": "context"}

        async def record_review(self, receipt):
            retained.append(receipt)

    async def client(config, name, args, **kwargs):
        calls.append((name, args))
        if name == "draft_drilling_packet":
            return {
                "structuredContent": {
                    "success": True,
                    "analysis": {"work": work, "drilling": drilling},
                }
            }
        assert name == "prepare_drilling_review" and args["candidate"]["context"] == {
            "host": "context"
        }
        return {"structuredContent": {"success": True, "analysis": {"state": "awaiting-review"}}}

    monkeypatch.setattr(role, "call_tool", client)
    tools = role.DrillingEngineerTools(
        MCPClientConfig(endpoint="https://operator.example/mcp", credential=no_credential),
        context_hooks=Hooks(),
    )
    candidate = {"work": work, "drilling": drilling, "evaluations": []}
    for mutate in [
        lambda value: value["work"]["findings"][0].update(value=False),
        lambda value: value["drilling"].update(operationalApproval=True),
    ]:
        forged = copy.deepcopy(candidate)
        mutate(forged)
        with pytest.raises(MCPClientError) as caught:
            await tools.prepare_drilling_review(json.dumps(forged))
        assert caught.value.code == "source_fidelity_mismatch"
        assert not retained
    await tools.prepare_drilling_review(json.dumps(candidate))
    assert retained == [work, {"state": "awaiting-review"}]
    assert calls[-2][1]["proposal"] == {
        key: drilling[key] for key in ("version", "summary", "observations")
    }


@pytest.mark.asyncio
@pytest.mark.parametrize("text", ['{"work":{},"work":{}}', '{"work":NaN}', "[]", '{"work":1e309}'])
async def test_invalid_review_json_never_dispatches(monkeypatch, text):
    from app import drilling_mcp as role

    async def forbidden(*args, **kwargs):
        raise AssertionError("Invalid JSON must not dispatch")

    monkeypatch.setattr(role, "call_tool", forbidden)
    tools = role.DrillingEngineerTools(
        MCPClientConfig(endpoint="https://operator.example/mcp", credential=no_credential)
    )
    with pytest.raises(MCPClientError):
        await tools.prepare_drilling_review(text)


@pytest.mark.asyncio
async def test_shared_review_supervisor_translates_only_fixed_drilling_operations():
    from app.review_supervision import ReviewSupervisor

    calls = []

    async def client(config, name, args):
        calls.append(name)
        value = (
            {
                "reviewId": "review.drilling",
                "state": "approved",
                "packetDigest": "a" * 64,
                "grantId": "grant.drilling",
            }
            if name == "drilling_review_status"
            else {"stored": True}
        )
        return {"structuredContent": {"success": True, "analysis": value}}

    supervisor = ReviewSupervisor(
        MCPClientConfig(endpoint="https://operator.example/mcp", credential=no_credential),
        client=client,
    )
    assert (await supervisor.resume("review.drilling"))["state"] == "completed"
    assert calls == ["drilling_review_status", "record_drilling_packet"]
