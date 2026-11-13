"""Market supervision maps business state to the common backend-enforced review component."""

import pytest
from shaleyeah_mcp import MCPClientConfig, MCPClientError


async def credential():
    return "synthetic-market-credential"


@pytest.mark.asyncio
async def test_supervisor_uses_market_operations_and_only_the_current_bound_grant():
    from app.review_supervision import ReviewSupervisor

    calls = []
    state = {"reviewId": "review.market", "state": "awaiting-review", "packetDigest": "a" * 64}

    async def client(config, name, arguments):
        calls.append((name, arguments))
        result = (
            {"stored": True, "recordId": "market.record"}
            if name == "record_market_scenarios"
            else dict(state)
        )
        return {"structuredContent": {"success": True, "analysis": result}}

    supervisor = ReviewSupervisor(
        MCPClientConfig(endpoint="https://market.invalid/mcp", credential=credential), client=client
    )
    assert (await supervisor.prepare({"exact": "candidate"}, expected_head=None))[
        "state"
    ] == "awaiting-review"
    assert (await supervisor.resume("review.market"))["state"] == "awaiting-review"
    assert all(name != "record_market_scenarios" for name, _ in calls)
    state.update(state="approved", grantId="grant.human")
    completed = await supervisor.resume("review.market")
    assert completed["state"] == "completed" and completed["outcome"]["stored"] is True
    assert calls == [
        ("prepare_market_review", {"candidate": {"exact": "candidate"}, "expectedHead": None}),
        ("market_review_status", {"reviewId": "review.market"}),
        ("market_review_status", {"reviewId": "review.market"}),
        (
            "record_market_scenarios",
            {"reviewId": "review.market", "packetDigest": "a" * 64, "grantId": "grant.human"},
        ),
    ]


@pytest.mark.asyncio
async def test_supervisor_does_not_turn_a_backend_denial_into_success():
    from app.review_supervision import ReviewSupervisor

    async def denied(*args):
        return {"isError": True, "structuredContent": {"success": False}}

    supervisor = ReviewSupervisor(
        MCPClientConfig(endpoint="https://market.invalid/mcp", credential=credential), client=denied
    )
    with pytest.raises(MCPClientError) as error:
        await supervisor.resume("review.market")
    assert error.value.code == "review_blocked"
