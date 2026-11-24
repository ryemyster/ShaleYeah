import pytest
from shaleyeah_mcp import MCPClientConfig, MCPClientError

from app.reporter_mcp import ReporterTools
from app.review_supervision import ReviewSupervisor


async def credential():
    return "fixture-private-credential"


@pytest.mark.asyncio
async def test_native_role_tools_preserve_the_declared_operations_and_exact_bindings(monkeypatch):
    from app import reporter_mcp

    calls = []
    expected = {"id": "reporter-synthesis", "revision": "r1"}

    async def client(config, name, arguments, **kwargs):
        calls.append((name, arguments, kwargs))
        return {
            "structuredContent": {
                "success": True,
                "analysis": expected
                if name == "get_model_profile"
                else {"state": "awaiting-review"},
            }
        }

    monkeypatch.setattr(reporter_mcp, "call_tool", client)
    tools = ReporterTools(
        MCPClientConfig(endpoint="https://external.internal/mcp", credential=credential),
        expected_profile=expected,
    )
    await tools.read_reviewed_source("product.source")
    await tools.synthesize_report(["product.source"])
    await tools.prepare_report_review('{"work": {}}', "a" * 64)
    await tools.report_review_status()
    await tools.report_review_status("review.1")
    await tools.release_report("review.1", "a" * 64, "grant.1")
    assert [name for name, _, _ in calls] == [
        "get_reviewed_source",
        "get_model_profile",
        "synthesize_report",
        "prepare_review",
        "get_review_status",
        "get_review_status",
        "release_report",
    ]
    assert calls[-1][1] == {"reviewId": "review.1", "packetDigest": "a" * 64, "grantId": "grant.1"}
    assert "credential" not in str(calls)
    with pytest.raises(MCPClientError):
        await ReporterTools(tools.backend).synthesize_report(["product.source"])
    tools.expected_profile = {"id": "another-profile"}
    with pytest.raises(MCPClientError) as caught:
        await tools.synthesize_report(["product.source"])
    assert caught.value.code == "model_binding_mismatch"


@pytest.mark.asyncio
async def test_restart_supervisor_executes_only_the_backend_bound_report_release():
    calls = []

    async def client(config, name, arguments):
        calls.append((name, arguments))
        analysis = (
            {
                "reviewId": "review.1",
                "state": "approved",
                "packetDigest": "a" * 64,
                "grantId": "grant.1",
            }
            if name == "get_review_status"
            else {"stored": True}
        )
        return {"structuredContent": {"success": True, "analysis": analysis}}

    supervisor = ReviewSupervisor(
        MCPClientConfig(endpoint="https://external.internal/mcp", credential=credential),
        client=client,
    )
    assert (await supervisor.resume("review.1"))["state"] == "completed"
    assert calls[-1][0] == "release_report"
