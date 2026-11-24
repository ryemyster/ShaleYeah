import copy
import json

import pytest
from shaleyeah_mcp import MCPClientConfig, MCPClientError


async def no_credential():
    raise AssertionError("Mapping tests must not resolve credentials")


@pytest.mark.asyncio
async def test_role_tools_preserve_task_document_provision_and_review_bindings(monkeypatch):
    from app import title_mcp as role

    calls = []

    async def client(config, name, arguments, **kwargs):
        calls.append((name, arguments))
        return {
            "isError": False,
            "structuredContent": {"success": True, "analysis": {"titleClearance": False}},
            "content": [{"type": "text", "text": "duplicate encoding"}],
        }

    monkeypatch.setattr(role, "call_tool", client)
    tools = role.TitleAnalystTools(
        MCPClientConfig(endpoint="https://operator.example/mcp", credential=no_credential)
    )
    await tools.read_title_inputs("task.title", "r1")
    await tools.read_title_source("source.corpus", "r2", 20, 100)
    await tools.read_title_instrument(
        "task.title", "r1", "instrument.contract", "r2", "transfer", 0, 6
    )
    result = await tools.cite_title_instrument(
        "task.title", "r1", "instrument.contract", "r2", "transfer", "Café 🛢 LLC"
    )
    assert "content" not in result
    await tools.get_context_source_metadata("source.corpus", "r2", "export")
    selected = [
        {"instrumentRef": {"id": "instrument.contract", "revision": "r2"}, "sectionId": "transfer"}
    ]
    await tools.examine_ownership("task.title", "r1")
    await tools.trace_chain_of_title("task.title", "r1")
    await tools.check_burdens("task.title", "r1")
    await tools.analyze_lease("task.title", "r1")
    proposal = {"version": "0.1.0", "title": "Proposed memo", "observations": []}
    await tools.draft_title_packet("task.title", "r1", json.dumps(proposal), "r3")
    await tools.prepare_title_review('{"work":{}}')
    await tools.title_review_status("review.title")
    await tools.record_title_packet("review.title", "a" * 64, "grant.title")
    assert [name for name, _ in calls] == [
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
    ]
    assert calls[2][1] == {
        "taskRef": {"id": "task.title", "revision": "r1"},
        **selected[0],
        "offset": 0,
        "maxChars": 6,
    }
    assert calls[3][1] == {
        "taskRef": {"id": "task.title", "revision": "r1"},
        **selected[0],
        "quote": "Café 🛢 LLC",
    }
    assert calls[9][1] == {
        "taskRef": {"id": "task.title", "revision": "r1"},
        "proposal": proposal,
        "revision": "r3",
    }
    assert "riskProfile" not in json.dumps(calls)


@pytest.mark.asyncio
async def test_current_cited_work_is_verified_before_host_context_is_retained(monkeypatch):
    from app import title_mcp as role

    work = {
        "scope": {"taskId": "task.title"},
        "taskRevision": "r1",
        "artifact": {"revision": "r1"},
        "findings": [{"value": 0}],
    }
    title = {
        "version": "0.1.0",
        "title": "Proposed memo",
        "observations": [],
        "titleClearance": False,
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
        if name == "draft_title_packet":
            return {
                "structuredContent": {"success": True, "analysis": {"work": work, "title": title}}
            }
        assert name == "prepare_title_review" and args["candidate"]["context"] == {
            "host": "context"
        }
        return {"structuredContent": {"success": True, "analysis": {"state": "awaiting-review"}}}

    monkeypatch.setattr(role, "call_tool", client)
    tools = role.TitleAnalystTools(
        MCPClientConfig(endpoint="https://operator.example/mcp", credential=no_credential),
        context_hooks=Hooks(),
    )
    candidate = {"work": work, "title": title, "evaluations": []}
    for mutate in [
        lambda value: value["work"]["findings"][0].update(value=False),
        lambda value: value["title"].update(titleClearance=True),
    ]:
        forged = copy.deepcopy(candidate)
        mutate(forged)
        with pytest.raises(MCPClientError) as caught:
            await tools.prepare_title_review(json.dumps(forged))
        assert caught.value.code == "source_fidelity_mismatch"
        assert not retained
    await tools.prepare_title_review(json.dumps(candidate))
    assert retained == [work, {"state": "awaiting-review"}]
    assert calls[-2][1]["proposal"] == {
        key: title[key] for key in ("version", "title", "observations")
    }


@pytest.mark.asyncio
@pytest.mark.parametrize("text", ['{"work":{},"work":{}}', '{"work":NaN}', "[]", '{"work":1e309}'])
async def test_invalid_review_json_never_dispatches(monkeypatch, text):
    from app import title_mcp as role

    async def forbidden(*args, **kwargs):
        raise AssertionError("Invalid JSON must not dispatch")

    monkeypatch.setattr(role, "call_tool", forbidden)
    tools = role.TitleAnalystTools(
        MCPClientConfig(endpoint="https://operator.example/mcp", credential=no_credential)
    )
    with pytest.raises(MCPClientError):
        await tools.prepare_title_review(text)


@pytest.mark.asyncio
async def test_shared_review_supervisor_translates_only_fixed_title_operations():
    from app.review_supervision import ReviewSupervisor

    calls = []

    async def client(config, name, args):
        calls.append(name)
        value = (
            {
                "reviewId": "review.title",
                "state": "approved",
                "packetDigest": "a" * 64,
                "grantId": "grant.title",
            }
            if name == "title_review_status"
            else {"stored": True}
        )
        return {"structuredContent": {"success": True, "analysis": value}}

    supervisor = ReviewSupervisor(
        MCPClientConfig(endpoint="https://operator.example/mcp", credential=no_credential),
        client=client,
    )
    assert (await supervisor.resume("review.title"))["state"] == "completed"
    assert calls == ["title_review_status", "record_title_packet"]
