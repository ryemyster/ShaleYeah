"""Real native ADK/SQLite restart with offline native provider HTTP boundaries."""

import asyncio
import json
from secrets import token_urlsafe

import httpx
import httpx2
import pytest
from test_model_provider import configuration
from test_working_context import SCOPE, opened, policy, seeded

from app.agent import geowiz_backend_status
from app.context_runtime import GeologistRuntime
from app.model_provider import native_adapter
from app.working_context import ContextError


def test_status_exposes_the_private_draft_and_human_review_boundary():
    status = geowiz_backend_status()
    assert status["reviewBoundary"]["privateDrafts"] == "current-grants-required"
    assert status["reviewBoundary"]["sharedKnowledge"] == "authenticated-human-review-required"
    assert status["reviewBoundary"]["protectedActions"] == "executing-backend-authority-required"


def model_config(provider):
    value = configuration(provider)
    for profile in (value.agent, value.synthesis, value.judge):
        profile["owner"] = {"customerId": SCOPE["customerId"], "employeeId": SCOPE["employeeId"]}
        profile["limits"]["maxInputChars"] = 262144
        profile["limits"]["timeoutMs"] = 30000
    return value


def offline(provider):
    calls = []
    key = token_urlsafe(32)
    package = httpx if provider == "gemini" else httpx2

    async def respond(value):
        body = json.loads(value.content)
        assert value.headers["x-goog-api-key" if provider == "gemini" else "x-api-key"] == key
        calls.append((str(value.url), body))
        if "countTokens" in str(value.url) or "count_tokens" in str(value.url):
            response = {"totalTokens": 400} if provider == "gemini" else {"input_tokens": 400}
        elif provider == "gemini":
            response = {
                "candidates": [
                    {
                        "content": {
                            "role": "model",
                            "parts": [{"text": "Controlled native output"}],
                        },
                        "finishReason": "STOP",
                    }
                ]
            }
        else:
            response = {
                "id": "fixture",
                "type": "message",
                "role": "assistant",
                "model": "claude-fixture-001",
                "content": [{"type": "text", "text": "Controlled native output"}],
                "stop_reason": "end_turn",
                "usage": {"input_tokens": 400, "output_tokens": 1},
            }
        return package.Response(200, json=response)

    return calls, {
        "resolve_credential": lambda *_: asyncio.sleep(0, result=key),
        "adapter_factory": lambda profile, secret: native_adapter(
            profile, secret, transport=package.MockTransport(respond)
        ),
    }


@pytest.mark.asyncio
@pytest.mark.parametrize("provider", ["gemini", "anthropic"])
async def test_native_database_restart_restores_context_without_replaying_old_transcript(
    tmp_path, provider
):
    catalog, authority, task, _source, work = await seeded(
        tmp_path / "context",
        configuration=policy(budget={"maxItems": 16, "maxBytes": 65536, "maxTokens": 16000}),
    )
    calls, native = offline(provider)
    runtime = await GeologistRuntime.open(catalog, model_config(provider), **native)
    result = await runtime.run("Initial private task")
    assert result["status"] == "ready"
    assert result["context"]["measurements"]["counter"]["qualification"] == "provider-count"
    first = await runtime.sessions.get_session(
        app_name=runtime.app_name, user_id=runtime.user_id, session_id=runtime.session_id
    )
    assert len(first.events) >= 2
    assert first.state["taskRevision"] == task["revision"]
    await runtime.close()

    catalog = await opened(
        tmp_path / "context",
        authority,
        configuration=policy(budget={"maxItems": 16, "maxBytes": 65536, "maxTokens": 16000}),
    )
    runtime = await GeologistRuntime.open(catalog, model_config(provider), **native)
    restored = await runtime.sessions.get_session(
        app_name=runtime.app_name, user_id=runtime.user_id, session_id=runtime.session_id
    )
    assert len(restored.events) == len(first.events)
    result = await runtime.run("Continue the checkpoint")
    assert result["context"]["records"][work["artifact"]["id"]]["confidence"] == 0
    assert result["context"]["checkpoint"]["pendingReviewRefs"]
    latest = json.dumps(calls[-1][1])
    assert "Initial private task" not in latest
    assert "8400" in latest and "2.65" in latest
    assert len(calls) == 4
    await runtime.close()


@pytest.mark.asyncio
async def test_revoked_source_never_loads_native_history_or_calls_provider(tmp_path, monkeypatch):
    catalog, authority, *_ = await seeded(tmp_path / "context")
    calls, native = offline("gemini")
    runtime = await GeologistRuntime.open(catalog, model_config("gemini"), **native)
    from google.adk.sessions import DatabaseSessionService

    loaded = []
    original = DatabaseSessionService.get_session

    async def observe(*args, **kwargs):
        loaded.append(True)
        return await original(*args, **kwargs)

    monkeypatch.setattr(DatabaseSessionService, "get_session", observe)
    authority.source["evidence"]["hash"]["value"] = "a" * 64
    result = await runtime.run("Resume")
    assert result["status"] == "blocked"
    assert loaded == [] and calls == []
    await runtime.close()


@pytest.mark.asyncio
async def test_native_session_identity_owner_state_and_single_writer_are_enforced(tmp_path):
    catalog, authority, *_ = await seeded(tmp_path / "context")
    calls, native = offline("gemini")
    runtime = await GeologistRuntime.open(catalog, model_config("gemini"), **native)
    with pytest.raises(ContextError):
        await runtime.sessions.get_session(
            app_name=runtime.app_name, user_id="foreign", session_id=runtime.session_id
        )
    with pytest.raises(ContextError):
        await runtime.sessions.create_session(
            app_name=runtime.app_name, user_id=runtime.user_id, session_id="foreign"
        )
    with pytest.raises(ContextError):
        await runtime.sessions.create_session(
            app_name=runtime.app_name,
            user_id=runtime.user_id,
            session_id=runtime.session_id,
            state={"user:private": "cross-task"},
        )
    other = await opened(tmp_path / "context", authority)
    with pytest.raises(ContextError, match="writer"):
        await GeologistRuntime.open(other, model_config("gemini"), **native)
    await other.close()
    assert calls == []
    await runtime.close()


@pytest.mark.asyncio
async def test_context_limit_stops_generation_and_emits_blocked_manifest(tmp_path):
    catalog, *_ = await seeded(
        tmp_path / "context",
        configuration=policy(budget={"maxItems": 16, "maxBytes": 65536, "maxTokens": 1200}),
    )
    calls, native = offline("gemini")
    runtime = await GeologistRuntime.open(catalog, model_config("gemini"), **native)
    result = await runtime.run("Resume")
    assert result["status"] == "blocked"
    assert result["context"]["manifest"]["blockers"]
    assert all("countTokens" in url for url, _ in calls)
    await runtime.close()


@pytest.mark.asyncio
async def test_context_block_is_observed_as_blocked_without_a_successful_model_event(tmp_path):
    from shaleyeah_mcp.events import EventEmitter

    observed = []

    async def sink(record):
        observed.append(record)

    emitter = EventEmitter(
        {
            "runId": "context-run",
            "traceId": "1234567890abcdef1234567890abcdef",
            "scope": SCOPE,
            "taskRevision": "r1",
            "qualification": "fixture",
        },
        {"id": "geologist", "version": "0.1.0"},
        sink,
    )
    catalog, *_ = await seeded(
        tmp_path / "context",
        configuration=policy(budget={"maxItems": 16, "maxBytes": 65536, "maxTokens": 1200}),
    )
    _calls, native = offline("gemini")
    runtime = await GeologistRuntime.open(catalog, model_config("gemini"), events=emitter, **native)
    result = await runtime.run("Resume")
    assert result["status"] == "blocked"
    assert any(
        record["eventType"] == "context" and record["status"] == "blocked" for record in observed
    )
    assert observed[-1]["eventType"] == "agent" and observed[-1]["status"] == "blocked"
    assert not any(
        record["eventType"] == "model" and record["status"] == "succeeded" for record in observed
    )
    assert "8400" not in json.dumps(observed)
    await runtime.close()


@pytest.mark.asyncio
async def test_native_history_growth_and_secret_inputs_fail_before_persistence(tmp_path):
    catalog, *_ = await seeded(tmp_path / "context", configuration=policy(maxRecords=6))
    calls, native = offline("gemini")
    secret = await native["resolve_credential"]({}, "ref", "agent")
    runtime = await GeologistRuntime.open(catalog, model_config("gemini"), **native)
    result = await runtime.run(secret)
    assert result["status"] == "blocked" and result["code"] == "secret_in_context"
    assert calls == []
    session = await runtime.sessions.create_session(
        app_name=runtime.app_name,
        user_id=runtime.user_id,
        session_id=runtime.session_id,
        state={"taskRevision": "r1", "nativeEventCount": 6},
    )
    from google.adk.events import Event

    with pytest.raises(ContextError, match="record_limit"):
        await runtime.sessions.append_event(session, Event(author="user"))
    await runtime.close()


@pytest.mark.asyncio
async def test_native_source_capture_state_listing_and_deletion_purge_history(tmp_path):
    catalog, _, _, source, _ = await seeded(tmp_path / "context")
    calls, native = offline("gemini")
    runtime = await GeologistRuntime.open(catalog, model_config("gemini"), **native)
    await runtime.run("Resume")
    listed = await runtime.sessions.list_sessions(
        app_name=runtime.app_name, user_id=runtime.user_id
    )
    assert len(listed.sessions) == 1 and listed.sessions[0].events == []
    await runtime.after_tool(
        None, {}, None, {"structuredContent": {"analysis": {"sourceArtifact": source}}}
    )
    await runtime.delete(source["artifact"])
    assert catalog._deleted(source["artifact"]["id"], source["artifact"]["revision"])
    import sqlite3

    with sqlite3.connect(catalog.root / "sessions.sqlite") as database:
        assert database.execute("SELECT COUNT(*) FROM events").fetchone()[0] == 0
    result = await runtime.run("Resume")
    assert result["status"] == "blocked"
    assert len(calls) == 2
    await runtime.close()


@pytest.mark.asyncio
async def test_mutating_a_counted_request_cannot_bypass_the_dispatch_budget(tmp_path):
    catalog, *_ = await seeded(tmp_path / "context")
    _calls, native = offline("gemini")
    runtime = await GeologistRuntime.open(catalog, model_config("gemini"), **native)
    await runtime.run("Resume")
    runtime._packet["request"].contents[0].parts[0].text += "Uncounted extra material"
    with pytest.raises(ContextError, match="revision_mismatch"):
        await runtime.before_dispatch(runtime._packet["request"])
    await runtime.reset_history()
    assert runtime.catalog._head(SCOPE["taskId"]) == "r1"
    await runtime.close()


@pytest.mark.asyncio
async def test_native_expiry_purge_clears_history_and_catalog_without_model_replay(tmp_path):
    from datetime import timedelta

    from test_working_context import NOW

    catalog, authority, *_ = await seeded(tmp_path / "context")
    calls, native = offline("gemini")
    runtime = await GeologistRuntime.open(catalog, model_config("gemini"), **native)
    await runtime.run("Resume")
    grant = authority.grant

    async def permit_cleanup(*args):
        value = await grant(*args)
        value["expiresAt"] = (NOW + timedelta(days=1)).isoformat()
        return value

    catalog.grant_provider = permit_cleanup
    catalog.clock = lambda: NOW + timedelta(minutes=61)
    assert await runtime.purge_expired() == 5
    assert (
        catalog.db.execute(
            "SELECT COUNT(*) FROM records WHERE namespace=? AND body IS NOT NULL",
            (catalog.namespace,),
        ).fetchone()[0]
        == 0
    )
    assert len(calls) == 2
    await runtime.close()
