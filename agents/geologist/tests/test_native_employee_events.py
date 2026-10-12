import copy
import json

import pytest
from shaleyeah_mcp import FileBearerCredential, MCPClientConfig
from shaleyeah_mcp.events import EventEmitter, EventExportError
from test_provider_journey import reference, run_fixture

from app import geowiz_mcp


@pytest.mark.asyncio
async def test_native_model_error_callback_records_failure_without_provider_prose(tmp_path, monkeypatch):
    import httpx
    import test_provider_journey

    from app.model_provider import ModelProviderError, native_adapter

    config, _value, keys = reference("gemini", tmp_path)
    emitter, records = observer()

    def denied(settings, secret, **_options):
        return native_adapter(settings, secret, transport=httpx.MockTransport(
            lambda _request: httpx.Response(401, json={"error": {"message": "private-provider-credential"}})))

    monkeypatch.setattr(test_provider_journey, "native_adapter", denied)
    backend = MCPClientConfig(endpoint="http://127.0.0.1:3001/mcp", credential=FileBearerCredential(tmp_path / "agent-key"), allow_loopback_http=True)
    with pytest.raises(ModelProviderError):
        await run_fixture(config, keys["agent"], backend, "assess_geowiz_quality", {"file_path": "private-source.las"}, "model-denied", event_emitter=emitter)
    model = [record for record in records if record["eventType"] == "model"]
    assert [record["status"] for record in model] == ["started", "failed"]
    assert model[-1]["parentEventId"] == model[0]["eventId"]
    assert model[-1]["errorCode"] == "model_failed"
    assert "private-provider-credential" not in json.dumps(records)


@pytest.mark.asyncio
async def test_native_tool_error_callback_never_marks_the_agent_turn_successful(tmp_path, monkeypatch):
    config, _value, keys = reference("gemini", tmp_path)
    emitter, records = observer()

    async def broken(*_args, **_options):
        raise ValueError("private-tool-body")

    monkeypatch.setattr(geowiz_mcp, "call_tool", broken)
    backend = MCPClientConfig(endpoint="http://127.0.0.1:3001/mcp", credential=FileBearerCredential(tmp_path / "agent-key"), allow_loopback_http=True)
    with pytest.raises(ValueError):
        await run_fixture(config, keys["agent"], backend, "assess_geowiz_quality", {"file_path": "private-source.las"}, "tool-failed", event_emitter=emitter)
    assert any(record["eventType"] == "tool" and record["status"] == "failed" for record in records)
    assert not any(record["eventType"] == "agent" and record["status"] == "succeeded" for record in records)
    assert "private-tool-body" not in json.dumps(records)


def observer():
    records = []

    async def sink(record):
        records.append(copy.deepcopy(record))

    context = {"runId": "native-run", "traceId": "1234567890abcdef1234567890abcdef", "scope": {"customerId": "fixture", "assetId": "asset-1", "taskId": "task-1", "employeeId": "geologist"}, "taskRevision": "r1", "qualification": "fixture"}
    return EventEmitter(context, {"id": "geologist", "version": "0.1.0"}, sink), records


@pytest.mark.asyncio
@pytest.mark.parametrize("provider", ["gemini", "anthropic"])
async def test_native_callbacks_capture_model_versions_without_content_or_credentials(provider, tmp_path, monkeypatch):
    config, _value, keys = reference(provider, tmp_path)
    emitter, records = observer()
    calls = []

    async def client(_settings, name, arguments, **options):
        calls.append((name, options))
        return {"structuredContent": {"success": True}, "isError": False, "content": []}

    monkeypatch.setattr(geowiz_mcp, "call_tool", client)
    backend = MCPClientConfig(endpoint="http://127.0.0.1:3001/mcp", credential=FileBearerCredential(tmp_path / "agent-key"), allow_loopback_http=True)
    await run_fixture(config, keys["agent"], backend, "assess_geowiz_quality", {"file_path": "private-source.las"}, "native-trace", event_emitter=emitter)
    model = [record for record in records if record["eventType"] == "model"]
    assert [record["status"] for record in model] == ["started", "succeeded", "started", "succeeded"]
    assert model[1]["versions"]["model"]["revision"] == config.agent["modelRevision"]
    assert model[1]["versions"]["model"]["reportedRevision"] == "fixture-native-001"
    assert model[1]["versions"]["runtime"] == {"id": "google-adk", "version": "2.4.0"}
    assert model[1]["measurements"]["modelLatencyMs"] >= 0
    assert records[0]["eventType"] == "agent" and records[-1]["status"] == "succeeded"
    assert calls[0][1]["events"] is emitter
    text = json.dumps(records)
    assert "private-source.las" not in text and "Offline contract control" not in text
    assert all(key not in text for key in keys.values())


@pytest.mark.asyncio
async def test_native_confirmation_pause_records_review_required_without_dispatch(tmp_path, monkeypatch):
    config, _value, keys = reference("gemini", tmp_path)
    emitter, records = observer()
    calls = []

    async def client(*args, **kwargs):
        calls.append(args)
        raise AssertionError("unapproved dispatch")

    monkeypatch.setattr(geowiz_mcp, "call_tool", client)
    backend = MCPClientConfig(endpoint="http://127.0.0.1:3001/mcp", credential=FileBearerCredential(tmp_path / "agent-key"), allow_loopback_http=True)
    await run_fixture(config, keys["agent"], backend, "save_geowiz_finding", {"finding_type": "formation", "title": "Draft", "summary": "private-body", "confidence": 0.1, "data_source": "fixture.las"}, "review-pause", backend_calls=calls, event_emitter=emitter)
    assert not calls
    assert any(record["eventType"] == "review" and record["status"] == "review-required" for record in records)
    assert not any(record["status"] == "approved" for record in records)
    assert records[-1]["status"] == "review-required"
    assert "private-body" not in json.dumps(records)


@pytest.mark.asyncio
async def test_required_agent_start_audit_failure_stops_the_native_run(tmp_path):
    config, _value, keys = reference("gemini", tmp_path)
    emitter, _records = observer()

    async def unavailable(_record):
        raise RuntimeError("private-sink-key")

    guarded = EventEmitter(emitter.context, {"id": "geologist", "version": "0.1.0"}, unavailable)
    backend = MCPClientConfig(endpoint="http://127.0.0.1:3001/mcp", credential=FileBearerCredential(tmp_path / "agent-key"), allow_loopback_http=True)
    with pytest.raises(EventExportError):
        await run_fixture(config, keys["agent"], backend, "assess_geowiz_quality", {"file_path": "private-source.las"}, "audit-stop", event_emitter=guarded)
    assert guarded.health["failures"] == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("provider", ["gemini", "anthropic"])
async def test_native_adk_and_actual_protected_geowiz_share_redacted_trace_and_source_hash(provider, tmp_path):
    import hashlib
    import os
    from datetime import UTC, datetime
    from pathlib import Path

    import rfc8785
    from shaleyeah_evaluations import EvaluationContext
    from shaleyeah_evaluations.runner import run_case
    from shaleyeah_mcp.events import load_jsonl_emitter
    from test_employee_events import RECORDS
    from test_eval_adapter import fixture, performance
    from test_provider_journey import REPO, protected_geowiz, source_hash

    from app.employee_events import GeologistEvents, VerifiedReview

    config, value, keys = reference(provider, tmp_path)
    async with protected_geowiz(tmp_path, value, employee_events=True) as (backend, _receipt, _audit, output):
        backend_settings = json.loads((tmp_path / "backend-events.json").read_text())
        settings = {**backend_settings, "producer": {"id": "geologist", "version": "0.1.0"}, "jsonlFile": str(tmp_path / "agent-events.jsonl")}
        file = tmp_path / "agent-events.json"
        file.write_text(json.dumps(settings))
        file.chmod(0o600)
        emitter = load_jsonl_emitter(file)
        recorder = GeologistEvents(emitter)
        scope = settings["context"]["scope"]
        task = copy.deepcopy(RECORDS["task"])
        task.update(id=scope["taskId"], scope=scope, revision=settings["context"]["taskRevision"])
        task_receipt = await recorder.record_task(task)
        manifest = copy.deepcopy(RECORDS["context"])
        manifest.update(scope=scope, taskRevision=settings["context"]["taskRevision"])
        source_config = json.loads((tmp_path / "sources.json").read_text())
        manifest["selectedEvidence"] = [source_config["sources"][0]["evidence"]]
        manifest["workingArtifactRefs"] = []
        await recorder.record_context(manifest, parent_event_id=task_receipt["eventId"])
        native_events, _calls = await run_fixture(config, keys["agent"], backend, "analyze_geowiz_formation", {"file_path": str(REPO / "servers/geowiz/tests/sample-files/sample.las")}, "protected-events", event_emitter=emitter)
        actual_source = next(part.function_response.response["structuredContent"]["analysis"]["sourceArtifact"]
            for event in native_events if event.content for part in event.content.parts
            if part.function_response and part.function_response.name == "analyze_geowiz_formation")
        value_fixture = fixture()
        work = copy.deepcopy(value_fixture["trace"]["workProduct"])
        work.update(scope=scope, taskRevision=settings["context"]["taskRevision"], evidence=[actual_source["evidence"]], inputs=[actual_source["artifact"]])
        for finding in work["findings"]:
            if finding["evidenceIds"]:
                finding["evidenceIds"] = [actual_source["evidence"]["id"]]
        for assumption in work["assumptions"]:
            assumption["evidenceIds"] = [actual_source["evidence"]["id"]]
        await recorder.record_work(work)
        runtime = copy.deepcopy(value_fixture["trustedRuntime"])
        runtime.update(scope=scope, task_revision=settings["context"]["taskRevision"], product_ref=work["artifact"],
            source_artifacts=[actual_source], evaluated_at=datetime.now(UTC).isoformat())
        trace = copy.deepcopy(value_fixture["trace"])
        trace["workProduct"] = work
        candidate = {"id": "fixture." + provider, "version": "r1",
            "model": {"provider": provider, "id": config.agent["model"], "revision": config.agent["modelRevision"]},
            "runtime": {"id": "google-adk", "version": "2.4.0"}, "harness": {"id": "adk-runner", "version": "2.4.0"}, "qualification": "fixture"}
        report = await run_case(profile=performance(), trace=trace, context=EvaluationContext.from_trusted_runtime(**runtime), candidate=candidate)
        await recorder.record_evaluation(report, product=work)
        request = copy.deepcopy(RECORDS["reviewRequest"])
        request.update(scope=scope, taskRevision=settings["context"]["taskRevision"], productRef=work["artifact"])
        await recorder.record_review_request(request)
        decision = copy.deepcopy(RECORDS["reviewDecision"])
        decision.update(scope=scope, taskRevision=settings["context"]["taskRevision"], productRef=work["artifact"])
        proof = VerifiedReview(principal_id=decision["reviewer"]["principalId"], decision_hash=hashlib.sha256(rfc8785.dumps(decision)).hexdigest(),
            policy_id=decision["reviewer"]["authorityPolicy"]["id"], policy_version=decision["reviewer"]["authorityPolicy"]["version"])
        await recorder.record_review(request, decision, verified=proof, measurements={"humanReviewSeconds": 45, "corrections": 1, "reworkCount": 1})
        agent = [json.loads(line) for line in (tmp_path / "agent-events.jsonl").read_text().splitlines()]
        server = [json.loads(line) for line in (tmp_path / "backend-events.jsonl").read_text().splitlines()]
        assert [record["status"] for record in server] == ["started", "succeeded", "started", "succeeded"]
        ids = {record["eventId"] for record in agent}
        assert all(record["parentEventId"] in ids for record in server)
        assert all(record["context"] == settings["context"] for record in [*agent, *server])
        assert any(ref["kind"] == "source" and ref["sha256"] == source_hash() for record in agent for ref in record["refs"])
        text = json.dumps([*agent, *server]) + "".join(output)
        assert all(secret not in text for secret in keys.values())
        assert "credentialRef" not in text
        assert str(tmp_path) not in text
        assert "8400.0" not in text
        assert {"task", "context", "work-product", "evaluation", "review", "tool", "model", "agent", "source"} <= {record["eventType"] for record in [*agent, *server]}
        # This fixture has no qualitative judge; successful transport cannot manufacture a passing evaluation.
        assert report["status"] == "infra-error" and report["promotionBlocked"]
        assert any(record["eventType"] == "evaluation" and record["status"] == report["status"] for record in agent)
        if export := os.getenv("GEOLOGIST_EVENT_TRACE_DIR"):
            directory = Path(export)
            directory.mkdir(parents=True, exist_ok=True, mode=0o700)
            for name, records in (("agent", agent), ("geowiz", server)):
                fd = os.open(directory / (provider + "-" + name + ".jsonl"), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                with os.fdopen(fd, "w") as handle:
                    handle.write("\n".join(json.dumps(record) for record in records) + "\n")
