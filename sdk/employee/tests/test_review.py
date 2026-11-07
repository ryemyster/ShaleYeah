import pytest
from shaleyeah_mcp import MCPClientConfig, MCPClientError

from shaleyeah_employee.review import EmployeeReviewSupervisor


@pytest.mark.asyncio
async def test_reporter_resume_dispatches_only_the_trusted_exact_revision_operation():
    calls = []

    async def credential():
        return "fixture-only-credential"

    async def client(config, name, arguments):
        calls.append((name, arguments))
        assert config.endpoint == "https://reporter.invalid/mcp"
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

    supervisor = EmployeeReviewSupervisor(
        MCPClientConfig(endpoint="https://reporter.invalid/mcp", credential=credential),
        execution_tool="release_report",
        client=client,
    )
    result = await supervisor.resume("review.1")
    assert result["state"] == "completed"
    assert calls[-1] == (
        "release_report",
        {"reviewId": "review.1", "packetDigest": "a" * 64, "grantId": "grant.1"},
    )


@pytest.mark.asyncio
async def test_review_checkpoint_never_dispatches_pending_or_foreign_authority():
    async def credential():
        return "fixture-only-credential"

    async def client(config, name, arguments):
        assert name == "get_review_status"
        return {
            "structuredContent": {
                "success": True,
                "analysis": {"reviewId": "another-review", "state": "approved"},
            }
        }

    supervisor = EmployeeReviewSupervisor(
        MCPClientConfig(endpoint="https://reporter.invalid/mcp", credential=credential),
        execution_tool="release_report",
        client=client,
    )
    with pytest.raises(MCPClientError) as caught:
        await supervisor.resume("review.1")
    assert caught.value.code == "invalid_review_checkpoint"
