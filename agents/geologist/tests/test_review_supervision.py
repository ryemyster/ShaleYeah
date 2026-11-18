import pytest
from shaleyeah_mcp import MCPClientConfig, MCPClientError

from app import geowiz_mcp
from app.review_supervision import ReviewSupervisor


@pytest.mark.asyncio
async def test_resume_obeys_durable_backend_state_and_retries_exact_bound_action():
    calls = []
    state = "awaiting-review"
    receipt = {"reviewId": "review.fixture", "packetDigest": "a" * 64, "state": state, "expiresAt": "2026-12-01T00:00:00Z"}

    async def client(_config, name, arguments):
        calls.append((name, arguments))
        if name == "save_finding":
            return {"isError": False, "structuredContent": {"success": True, "analysis": {"stored": True, "findingId": "finding.fixture", "uri": "urn:geowiz:fixture"}}}
        return {"isError": False, "structuredContent": {"success": True, "analysis": {**receipt, "state": state, **({"grantId": "grant.fixture"} if state == "approved" else {})}}}

    config = MCPClientConfig(endpoint="http://127.0.0.1:3001/mcp", credential=lambda: "unused-fixture-credential", allow_loopback_http=True)
    supervisor = ReviewSupervisor(config, client=client)
    assert (await supervisor.resume("review.fixture"))["state"] == "awaiting-review"
    assert all(name != "save_finding" for name, _ in calls)
    for state in ("changes-requested", "rejected"):
        assert (await supervisor.resume("review.fixture"))["state"] == state
    state = "approved"
    result = await supervisor.resume("review.fixture")
    assert result["state"] == "completed"
    assert calls[-1] == ("save_finding", {"reviewId": "review.fixture", "packetDigest": "a" * 64, "grantId": "grant.fixture"})
    state = "completed"
    receipt["outcome"] = result["outcome"]
    before = len(calls)
    assert (await ReviewSupervisor(config, client=client).resume("review.fixture"))["outcome"] == result["outcome"]
    assert len(calls) == before + 1


@pytest.mark.asyncio
async def test_missing_grant_backend_failure_and_boolean_cannot_resume():
    async def client(_config, name, _arguments):
        assert name == "get_review_status"
        return {"isError": False, "structuredContent": {"success": True, "analysis": {"reviewId": "review.fixture", "packetDigest": "a" * 64, "state": "approved", "approved": True}}}
    config = MCPClientConfig(endpoint="http://127.0.0.1:3001/mcp", credential=lambda: "unused-fixture-credential", allow_loopback_http=True)
    with pytest.raises(MCPClientError):
        await ReviewSupervisor(config, client=client).resume("review.fixture")


@pytest.mark.asyncio
@pytest.mark.parametrize("body", [{"isError": True}, {"structuredContent": {"success": False}}, {"isError": False, "structuredContent": {"success": True, "analysis": {"reviewId": "wrong", "state": "approved"}}}])
async def test_failed_or_foreign_checkpoint_is_not_completion(body):
    async def client(*_):
        return body
    config = MCPClientConfig(endpoint="http://127.0.0.1:3001/mcp", credential=lambda: "unused-fixture-credential", allow_loopback_http=True)
    with pytest.raises(MCPClientError):
        await ReviewSupervisor(config, client=client).resume("review.fixture")


@pytest.mark.asyncio
async def test_review_tool_mappings_validate_json_before_transport(monkeypatch):
    calls = []
    async def client(name, args):
        calls.append((name, args))
        return {"isError": True}
    monkeypatch.setattr(geowiz_mcp, "call_geowiz_tool", client)
    await geowiz_mcp.prepare_geowiz_review('{"work":{}}', "a" * 64)
    await geowiz_mcp.get_geowiz_review_status("review.fixture")
    assert calls == [("prepare_review", {"candidate": {"work": {}}, "expectedHead": "a" * 64}), ("get_review_status", {"reviewId": "review.fixture"})]
    for value in ("[]", "bad", '{"work":{},"work":{}}', '{"work":NaN}', "x" * 2_000_001):
        with pytest.raises(MCPClientError):
            await geowiz_mcp.prepare_geowiz_review(value)
    assert len(calls) == 2


@pytest.mark.asyncio
async def test_prepare_retains_exact_candidate_and_cas_checkpoint():
    calls = []
    async def client(_config, name, arguments):
        calls.append((name, arguments))
        return {"isError": False, "structuredContent": {"success": True, "analysis": {"reviewId": "review.fixture", "packetDigest": "a" * 64, "state": "awaiting-review", "expiresAt": "2026-12-01T00:00:00Z"}}}
    config = MCPClientConfig(endpoint="http://127.0.0.1:3001/mcp", credential=lambda: "unused-fixture-credential", allow_loopback_http=True)
    supervisor = ReviewSupervisor(config, client=client)
    candidate = {"work": {"assumptions": ["review me"]}, "context": {}, "evaluations": [], "finding": {}}
    receipt = await supervisor.prepare(candidate, expected_head=None)
    assert receipt["state"] == "awaiting-review"
    assert calls == [("prepare_review", {"candidate": candidate, "expectedHead": None})]


@pytest.mark.asyncio
async def test_pinned_native_sqlite_confirmation_restart_does_not_supply_backend_authority(tmp_path, monkeypatch):
    """Qualify the pinned native pause separately from the durable business grant."""
    import asyncio
    import json
    from secrets import token_urlsafe

    import httpx
    from google.adk.runners import Runner
    from google.adk.sessions import DatabaseSessionService
    from google.genai import types
    from test_model_provider import configuration

    from app import geowiz_mcp
    from app.agent import create_geologist_agent
    from app.model_provider import native_adapter

    config = configuration("gemini")
    config.agent["limits"].update(maxInputChars=65536, timeoutMs=10000)
    key = token_urlsafe(32)
    calls = []
    dispatches = []

    async def respond(request):
        calls.append(json.loads(request.content))
        part = {"functionCall": {"name": "save_geowiz_finding", "args": {"review_id": "review.fixture", "packet_digest": "a" * 64, "grant_id": "grant.forged"}}} if len(calls) == 1 else {"text": "Offline transport completion"}
        return httpx.Response(200, json={"candidates": [{"content": {"role": "model", "parts": [part]}, "finishReason": "STOP"}]})

    async def client(_config, name, values):
        dispatches.append((name, values))
        return {"isError": True, "structuredContent": {"success": False, "reviewError": {"code": "approval_required"}}}

    monkeypatch.setattr(geowiz_mcp, "call_tool", client)
    backend = MCPClientConfig(endpoint="http://127.0.0.1:3001/mcp", credential=lambda: "unused-fixture-credential", allow_loopback_http=True)
    def agent():
        return create_geologist_agent(config, backend_config=backend, resolve_credential=lambda *_: asyncio.sleep(0, result=key), adapter_factory=lambda settings, secret: native_adapter(settings, secret, transport=httpx.MockTransport(respond)))
    url = f"sqlite+aiosqlite:///{tmp_path / 'native.sqlite'}"
    service = DatabaseSessionService(db_url=url)
    await service.create_session(app_name="review_restart", user_id="worker", session_id="task")
    runner = Runner(agent=agent(), app_name="review_restart", session_service=service)
    events = [event async for event in runner.run_async(user_id="worker", session_id="task", new_message=types.Content(role="user", parts=[types.Part(text="Attempt an unreviewed save")]))]
    confirmation = next(part.function_call for event in events if event.content for part in event.content.parts if part.function_call and part.function_call.name == "adk_request_confirmation")
    assert not dispatches
    await runner.close()
    await service.close()

    service = DatabaseSessionService(db_url=url)
    restored = await service.get_session(app_name="review_restart", user_id="worker", session_id="task")
    assert any(event.actions.requested_tool_confirmations for event in restored.events)
    runner = Runner(agent=agent(), app_name="review_restart", session_service=service)
    try:
        message = types.Content(role="user", parts=[types.Part(function_response=types.FunctionResponse(id=confirmation.id, name="adk_request_confirmation", response={"confirmed": True}))])
        resumed = [event async for event in runner.run_async(user_id="worker", session_id="task", new_message=message)]
        assert dispatches == [("save_finding", {"reviewId": "review.fixture", "packetDigest": "a" * 64, "grantId": "grant.forged"})]
        responses = [part.function_response.response for event in resumed if event.content for part in event.content.parts if part.function_response and part.function_response.name == "save_geowiz_finding"]
        assert responses and responses[0]["isError"] is True
    finally:
        await runner.close()
        await service.close()
