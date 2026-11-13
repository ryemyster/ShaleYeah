import copy
import json

import pytest
from shaleyeah_mcp import MCPClientConfig, MCPClientError


async def no_credential():
    raise AssertionError("Mapping tests must not resolve credentials")


@pytest.mark.asyncio
async def test_role_tools_preserve_task_document_provision_and_review_bindings(monkeypatch):
    from app import legal_mcp as role

    calls = []

    async def client(config, name, arguments, **kwargs):
        calls.append((name, arguments))
        return {
            "isError": False,
            "structuredContent": {"success": True, "analysis": {"legalClearance": False}},
            "content": [{"type": "text", "text": "duplicate encoding"}],
        }

    monkeypatch.setattr(role, "call_tool", client)
    tools = role.LegalAnalystTools(
        MCPClientConfig(endpoint="https://operator.example/mcp", credential=no_credential)
    )
    await tools.read_legal_inputs("task.legal", "r1")
    await tools.read_legal_source("source.corpus", "r2", 20, 100)
    await tools.read_legal_provision(
        "task.legal", "r1", "document.contract", "r2", "transfer", 0, 6
    )
    result = await tools.cite_legal_source(
        "task.legal", "r1", "document.contract", "r2", "transfer", "Café 🛢 LLC"
    )
    assert "content" not in result
    await tools.get_context_source_metadata("source.corpus", "r2", "export")
    selected = [
        {"documentRef": {"id": "document.contract", "revision": "r2"}, "sectionId": "transfer"}
    ]
    await tools.compare_legal_sources("task.legal", "r1", json.dumps(selected))
    proposal = {"version": "0.1.0", "title": "Proposed memo", "issues": []}
    await tools.draft_legal_memo("task.legal", "r1", json.dumps(proposal), "r3")
    await tools.prepare_legal_review('{"work":{}}')
    await tools.legal_review_status("review.legal")
    await tools.record_legal_memo("review.legal", "a" * 64, "grant.legal")
    assert [name for name, _ in calls] == [
        "read_legal_inputs",
        "read_legal_source",
        "read_legal_provision",
        "cite_legal_source",
        "get_context_source_metadata",
        "compare_legal_sources",
        "draft_legal_memo",
        "prepare_legal_review",
        "legal_review_status",
        "record_legal_memo",
    ]
    assert calls[2][1] == {
        "taskRef": {"id": "task.legal", "revision": "r1"},
        **selected[0],
        "offset": 0,
        "maxChars": 6,
    }
    assert calls[3][1] == {
        "taskRef": {"id": "task.legal", "revision": "r1"},
        **selected[0],
        "quote": "Café 🛢 LLC",
    }
    assert calls[6][1] == {
        "taskRef": {"id": "task.legal", "revision": "r1"},
        "proposal": proposal,
        "revision": "r3",
    }
    assert "riskProfile" not in json.dumps(calls)


@pytest.mark.asyncio
async def test_current_cited_work_is_verified_before_host_context_is_retained(monkeypatch):
    from app import legal_mcp as role

    work = {
        "scope": {"taskId": "task.legal"},
        "taskRevision": "r1",
        "artifact": {"revision": "r1"},
        "findings": [{"value": 0}],
    }
    legal = {"version": "0.1.0", "title": "Proposed memo", "issues": [], "legalClearance": False}
    retained, calls = [], []

    class Hooks:
        async def review_context(self, actual):
            retained.append(actual)
            return {"host": "context"}

        async def record_review(self, receipt):
            retained.append(receipt)

    async def client(config, name, args, **kwargs):
        calls.append((name, args))
        if name == "draft_legal_memo":
            return {
                "structuredContent": {"success": True, "analysis": {"work": work, "legal": legal}}
            }
        assert name == "prepare_legal_review" and args["candidate"]["context"] == {
            "host": "context"
        }
        return {"structuredContent": {"success": True, "analysis": {"state": "awaiting-review"}}}

    monkeypatch.setattr(role, "call_tool", client)
    tools = role.LegalAnalystTools(
        MCPClientConfig(endpoint="https://operator.example/mcp", credential=no_credential),
        context_hooks=Hooks(),
    )
    candidate = {"work": work, "legal": legal, "evaluations": []}
    for mutate in [
        lambda value: value["work"]["findings"][0].update(value=False),
        lambda value: value["legal"].update(legalClearance=True),
    ]:
        forged = copy.deepcopy(candidate)
        mutate(forged)
        with pytest.raises(MCPClientError) as caught:
            await tools.prepare_legal_review(json.dumps(forged))
        assert caught.value.code == "source_fidelity_mismatch"
        assert not retained
    await tools.prepare_legal_review(json.dumps(candidate))
    assert retained == [work, {"state": "awaiting-review"}]
    assert calls[-2][1]["proposal"] == {key: legal[key] for key in ("version", "title", "issues")}


@pytest.mark.asyncio
@pytest.mark.parametrize("text", ['{"work":{},"work":{}}', '{"work":NaN}', "[]", '{"work":1e309}'])
async def test_invalid_review_json_never_dispatches(monkeypatch, text):
    from app import legal_mcp as role

    async def forbidden(*args, **kwargs):
        raise AssertionError("Invalid JSON must not dispatch")

    monkeypatch.setattr(role, "call_tool", forbidden)
    tools = role.LegalAnalystTools(
        MCPClientConfig(endpoint="https://operator.example/mcp", credential=no_credential)
    )
    with pytest.raises(MCPClientError):
        await tools.prepare_legal_review(text)


@pytest.mark.asyncio
async def test_shared_review_supervisor_translates_only_fixed_legal_operations():
    from app.review_supervision import ReviewSupervisor

    calls = []

    async def client(config, name, args):
        calls.append(name)
        value = (
            {
                "reviewId": "review.legal",
                "state": "approved",
                "packetDigest": "a" * 64,
                "grantId": "grant.legal",
            }
            if name == "legal_review_status"
            else {"stored": True}
        )
        return {"structuredContent": {"success": True, "analysis": value}}

    supervisor = ReviewSupervisor(
        MCPClientConfig(endpoint="https://operator.example/mcp", credential=no_credential),
        client=client,
    )
    assert (await supervisor.resume("review.legal"))["state"] == "completed"
    assert calls == ["legal_review_status", "record_legal_memo"]
