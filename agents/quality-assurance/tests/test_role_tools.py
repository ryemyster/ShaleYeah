import json

import pytest
from shaleyeah_mcp import MCPClientConfig, MCPClientError


async def credential():
    raise AssertionError("A mocked role mapping must not resolve credentials")


@pytest.mark.asyncio
async def test_role_tools_preserve_exact_observed_and_disposition_references(monkeypatch):
    from app import qa_mcp

    calls = []

    async def client(config, name, arguments, **kwargs):
        calls.append((config.endpoint, name, arguments))
        return {
            "isError": False,
            "structuredContent": {"success": True, "analysis": {"status": "FAIL"}},
        }

    monkeypatch.setattr(qa_mcp, "call_tool", client)
    tools = qa_mcp.QATools(
        MCPClientConfig(endpoint="https://operator.example/mcp", credential=credential)
    )
    result = await tools.run_quality_checks("task.qa", "r1", "profile.qa", "r2")
    assert result["structuredContent"]["analysis"]["status"] == "FAIL"
    await tools.read_quality_report("result.qa", "r3")
    await tools.triage_quality_result("result.qa", "r3")
    await tools.draft_disposition(
        "result.qa", "r3", "defer", "Await review", "data-owner", "2026-11-01T00:00:00Z"
    )
    await tools.prepare_disposition_review('{"work":{}}', "a" * 64)
    await tools.disposition_review_status("review.qa")
    await tools.disposition_review_status()
    await tools.record_disposition("review.qa", "b" * 64, "grant.qa")
    assert [name for _, name, _ in calls] == [
        "run_quality_tests",
        "generate_quality_report",
        "triage_quality_result",
        "draft_disposition",
        "prepare_review",
        "get_review_status",
        "get_review_status",
        "record_disposition",
    ]
    assert calls[0][2] == {
        "taskRef": {"id": "task.qa", "revision": "r1"},
        "profileRef": {"id": "profile.qa", "revision": "r2"},
    }
    assert calls[1][2] == {"resultRef": {"id": "result.qa", "revision": "r3"}}
    assert calls[-1][2] == {
        "reviewId": "review.qa",
        "packetDigest": "b" * 64,
        "grantId": "grant.qa",
    }


@pytest.mark.asyncio
async def test_native_preparation_uses_the_host_context_manifest_instead_of_model_context(
    monkeypatch,
):
    from app import qa_mcp

    manifest = {"kind": "context-manifest", "scope": {"employeeId": "employee.qa"}}
    work = {"artifact": {"id": "work.qa", "revision": "r1"}}
    disposition = {
        "proposal": {"action": "defer"},
        "observedReport": {"resultRef": {"id": "result.qa", "revision": "r1"}},
    }
    candidate = {"work": work, "disposition": disposition, "evaluations": []}

    class Hooks:
        async def review_context(self, work):
            assert work == candidate["work"]
            return manifest

        async def record_review(self, receipt):
            assert receipt == {"reviewId": "review.qa", "state": "awaiting-review"}

    async def client(config, name, arguments, **kwargs):
        if name == "draft_disposition":
            return {
                "structuredContent": {
                    "success": True,
                    "analysis": {"work": work, "disposition": disposition},
                },
                "isError": False,
            }
        assert arguments["candidate"]["context"] == manifest
        return {
            "isError": False,
            "structuredContent": {
                "success": True,
                "analysis": {"reviewId": "review.qa", "state": "awaiting-review"},
            },
        }

    monkeypatch.setattr(qa_mcp, "call_tool", client)
    tools = qa_mcp.QATools(
        MCPClientConfig(endpoint="https://operator.example/mcp", credential=credential),
        context_hooks=Hooks(),
    )
    await tools.prepare_disposition_review(json.dumps(candidate))
    with pytest.raises(MCPClientError) as caught:
        await tools.prepare_disposition_review(
            json.dumps({**candidate, "context": {"scope": "invented"}})
        )

    assert caught.value.code == "context_binding_mismatch"


@pytest.mark.asyncio
async def test_an_edited_work_claim_cannot_enter_context_before_backend_fidelity_verification(
    monkeypatch,
):
    from app import qa_mcp

    class Hooks:
        async def review_context(self, work):
            raise AssertionError("Unverified model work must not enter the catalog")

    async def client(config, name, arguments, **kwargs):
        assert name == "draft_disposition"
        return {
            "isError": False,
            "structuredContent": {
                "success": True,
                "analysis": {"work": {"artifact": {"revision": "r1"}}, "disposition": {}},
            },
        }

    monkeypatch.setattr(qa_mcp, "call_tool", client)
    tools = qa_mcp.QATools(
        MCPClientConfig(endpoint="https://operator.example/mcp", credential=credential),
        context_hooks=Hooks(),
    )
    candidate = {
        "work": {"artifact": {"revision": "r1"}, "findings": [{"value": "PASS"}]},
        "disposition": {
            "observedReport": {"resultRef": {"id": "result.qa", "revision": "r1"}},
            "proposal": {"action": "defer"},
        },
    }
    with pytest.raises(MCPClientError) as caught:
        await tools.prepare_disposition_review(json.dumps(candidate))
    assert caught.value.code == "source_fidelity_mismatch"


@pytest.mark.asyncio
async def test_supervisor_resumes_only_the_exact_backend_approved_disposition():
    from app.review_supervision import ReviewSupervisor

    calls = []

    async def client(config, name, arguments):
        calls.append((name, arguments))
        analysis = (
            {
                "reviewId": "review.qa",
                "state": "approved",
                "packetDigest": "a" * 64,
                "grantId": "grant.qa",
            }
            if name == "get_review_status"
            else {"stored": True}
        )
        return {"structuredContent": {"success": True, "analysis": analysis}}

    supervisor = ReviewSupervisor(
        MCPClientConfig(endpoint="https://operator.example/mcp", credential=credential),
        client=client,
    )
    assert (await supervisor.resume("review.qa"))["state"] == "completed"
    assert calls[-1] == (
        "record_disposition",
        {"reviewId": "review.qa", "packetDigest": "a" * 64, "grantId": "grant.qa"},
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("candidate", ['{"work":{},"work":{}}', '{"work":NaN}', "[]"])
async def test_invalid_disposition_json_never_dispatches(monkeypatch, candidate):
    from app import qa_mcp

    async def forbidden(*args, **kwargs):
        raise AssertionError("Invalid model JSON must not contact the backend")

    monkeypatch.setattr(qa_mcp, "call_tool", forbidden)
    tools = qa_mcp.QATools(
        MCPClientConfig(endpoint="https://operator.example/mcp", credential=forbidden)
    )
    with pytest.raises(MCPClientError) as caught:
        await tools.prepare_disposition_review(candidate)
    assert caught.value.code == "invalid_arguments"
