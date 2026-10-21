import asyncio
import copy
import json
import os

import pytest

from shaleyeah_mcp.events import (
    EventEmitter,
    EventExportError,
    create_jsonl_sink,
    load_jsonl_emitter,
)

CONTEXT = {"runId":"diligence-run-1","traceId":"1234567890abcdef1234567890abcdef","scope":{"customerId":"operator-fixture","assetId":"well-fixture","taskId":"task-fixture","employeeId":"geologist"},"taskRevision":"r1","qualification":"fixture"}
PRODUCER = {"id": "geologist", "version": "0.1.0"}


@pytest.mark.asyncio
async def test_complete_correlated_trace_separates_human_and_model_time(tmp_path):
    records = []

    async def sink(record):
        records.append(copy.deepcopy(record))

    emitter = EventEmitter(CONTEXT, PRODUCER, sink)
    first = await emitter.emit("task", "started")
    await emitter.emit("context", "succeeded", refs=[{"kind": "context", "id": "context-1", "revision": "r1", "sha256": "b" * 64}], parentEventId=first["eventId"])
    await emitter.emit("model", "succeeded", measurements={"modelLatencyMs": 12}, modelConfidence=0)
    await emitter.emit("work-product", "succeeded", refs=[{"kind": "work-product", "id": "work-1", "revision": "r1", "sha256": "c" * 64}])
    await emitter.emit("evaluation", "blocked", refs=[{"kind": "evaluation", "id": "eval-1", "revision": "r1", "sha256": "d" * 64}])
    await emitter.emit("review", "revision-requested", measurements={"humanReviewSeconds": 45, "corrections": 1, "reworkCount": 1})
    assert [record["sequence"] for record in records] == list(range(1, 7))
    assert len({record["eventId"] for record in records}) == 6
    assert all(record["context"] == CONTEXT for record in records)
    assert records[1]["parentEventId"] == first["eventId"]
    assert records[2]["modelConfidence"] == 0
    assert "humanReviewSeconds" not in records[2]["measurements"]
    assert "modelLatencyMs" not in records[-1]["measurements"]
    private = tmp_path / "events.jsonl"
    local = EventEmitter(CONTEXT, PRODUCER, create_jsonl_sink(private))
    await local.emit("tool", "failed", toolName="assess_quality", errorCode="source_unavailable")
    exported = json.loads(private.read_text())
    assert exported["status"] == "failed"
    assert private.stat().st_mode & 0o077 == 0


@pytest.mark.asyncio
async def test_required_sink_failure_prevents_dispatch_and_hides_error_values():
    async def down(_record):
        raise RuntimeError("private-secret-value")

    emitter = EventEmitter(CONTEXT, PRODUCER, down, required=True)
    calls = []
    with pytest.raises(EventExportError) as failure:
        await emitter.emit("tool", "started")
        calls.append("dispatched")
    assert not calls
    assert "private-secret-value" not in str(failure.value)
    assert emitter.health["failures"] == 1
    assert emitter.health["lastErrorCode"] == "audit_unavailable"


@pytest.mark.asyncio
async def test_optional_export_failure_is_visible_and_does_not_fake_delivery():
    async def down(_record):
        raise RuntimeError("private-secret-value")

    emitter = EventEmitter(CONTEXT, PRODUCER, down, required=False)
    receipt = await emitter.emit("tool", "failed")
    assert receipt["emitted"] is False
    assert emitter.health["failures"] == 1
    assert emitter.health["lastErrorCode"] == "audit_unavailable"


@pytest.mark.asyncio
async def test_sink_timeout_is_bounded():
    async def hung(_record):
        await asyncio.sleep(10)

    emitter = EventEmitter(CONTEXT, PRODUCER, hung, timeout_seconds=0.01)
    with pytest.raises(EventExportError):
        await emitter.emit("tool", "started")
    assert emitter.health["failures"] == 1


@pytest.mark.asyncio
async def test_backward_clock_and_concurrent_emit_have_monotonic_sequence():
    records = []
    clocks = iter(["2026-10-11T22:00:00Z", "2026-10-11T21:59:00Z"])

    async def sink(record):
        await asyncio.sleep(0)
        records.append(record)

    emitter = EventEmitter(CONTEXT, PRODUCER, sink, clock=lambda: next(clocks))
    await asyncio.gather(emitter.emit("tool", "started"), emitter.emit("tool", "retried"))
    assert [record["sequence"] for record in records] == [1, 2]
    assert records[1]["observedAt"] < records[0]["observedAt"]
    assert records[1]["status"] == "retried"


@pytest.mark.asyncio
async def test_input_and_sink_mutation_cannot_change_owner_or_later_events():
    context = copy.deepcopy(CONTEXT)
    records = []

    async def sink(record):
        records.append(copy.deepcopy(record))
        record["context"]["scope"]["customerId"] = "sink-mutated"

    emitter = EventEmitter(context, PRODUCER, sink)
    context["scope"]["customerId"] = "caller-mutated"
    await emitter.emit("tool", "started", context={"authority": "model-approved"})
    await emitter.emit("tool", "succeeded")
    assert all(record["context"] == CONTEXT for record in records)
    public = emitter.context
    public["scope"]["customerId"] = "public-mutated"
    assert emitter.context == CONTEXT


@pytest.mark.asyncio
async def test_sensitive_bodies_never_reach_injected_siem_sink():
    records = []

    async def sink(record):
        records.append(record)

    emitter = EventEmitter(CONTEXT, PRODUCER, sink, sensitive_values=("private-secret-value",))
    await emitter.emit("tool", "failed", toolName="private-secret-value", errorCode="source_unavailable", arguments={"secret": "private-secret-value"}, prompt="confidential source body")
    text = json.dumps(records)
    assert "private-secret-value" not in text
    assert "confidential source body" not in text
    assert records[0]["redaction"]["droppedFields"] == 2
    assert records[0]["redaction"]["redactedValues"] == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", ["shared", "symlink", "directory", "hardlink"])
async def test_jsonl_refuses_unsafe_files_without_logging_values(tmp_path, kind):
    file = tmp_path / "events.jsonl"
    if kind == "directory":
        file.mkdir()
    else:
        file.write_text("")
        file.chmod(0o644 if kind == "shared" else 0o600)
        if kind == "symlink":
            target = tmp_path / "link.jsonl"
            target.symlink_to(file)
            file = target
        elif kind == "hardlink":
            os.link(file, tmp_path / "other.jsonl")
    emitter = EventEmitter(CONTEXT, PRODUCER, create_jsonl_sink(file))
    with pytest.raises(EventExportError):
        await emitter.emit("task", "started")


@pytest.mark.asyncio
async def test_independent_employees_keep_separate_sequence_and_owner():
    records = []

    async def sink(record):
        records.append(record)

    other = copy.deepcopy(CONTEXT)
    other["scope"]["customerId"] = "other-operator"
    emitters = [EventEmitter(context, PRODUCER, sink) for context in [CONTEXT, other]]
    await asyncio.gather(*(emitter.emit("task", "started") for emitter in emitters))
    assert {record["context"]["scope"]["customerId"] for record in records} == {"operator-fixture", "other-operator"}
    assert [record["sequence"] for record in records] == [1, 1]


@pytest.mark.asyncio
async def test_queued_event_keeps_references_observed_at_submission():
    started, release = asyncio.Event(), asyncio.Event()
    records = []

    async def sink(record):
        if not records:
            started.set()
            await release.wait()
        records.append(record)

    emitter = EventEmitter(CONTEXT, PRODUCER, sink)
    first = asyncio.create_task(emitter.emit("task", "started"))
    await started.wait()
    refs = [{"kind": "source", "id": "source-1", "revision": "r1", "sha256": "a" * 64}]
    second = asyncio.create_task(emitter.emit("source", "succeeded", refs=refs))
    await asyncio.sleep(0)
    refs[0]["sha256"] = "b" * 64
    release.set()
    await asyncio.gather(first, second)
    assert records[1]["refs"][0]["sha256"] == "a" * 64


@pytest.mark.asyncio
async def test_unknown_content_is_discarded_without_copying_or_inspecting():
    class PrivateContent:
        def __deepcopy__(self, memo):
            raise RuntimeError("private-secret-value")

    records = []

    async def sink(record):
        records.append(record)

    emitter = EventEmitter(CONTEXT, PRODUCER, sink)
    await emitter.emit("tool", "failed", arguments=PrivateContent())
    assert len(records) == 1
    assert records[0]["redaction"]["droppedFields"] == 1


@pytest.mark.asyncio
async def test_same_employee_restart_uses_distinct_streams():
    records = []

    async def sink(record):
        records.append(record)

    for _ in range(2):
        await EventEmitter(CONTEXT, PRODUCER, sink).emit("task", "started")
    assert len({record["streamId"] for record in records}) == 2
    assert [record["sequence"] for record in records] == [1, 1]


@pytest.mark.asyncio
async def test_private_operator_file_loads_jsonl_binding_without_model_credentials(tmp_path):
    from shaleyeah_contracts.events import EventValidationError
    file = tmp_path / "events.json"
    output = tmp_path / "events.jsonl"
    file.write_text(json.dumps({"version": "0.1.0", "context": CONTEXT, "producer": PRODUCER, "jsonlFile": str(output), "required": True, "timeoutMs": 5000}))
    file.chmod(0o600)
    emitter = load_jsonl_emitter(file)
    await emitter.emit("task", "started")
    assert json.loads(output.read_text())["context"] == CONTEXT
    file.chmod(0o644)
    with pytest.raises(EventValidationError, match="invalid_event_configuration"):
        load_jsonl_emitter(file)


@pytest.mark.parametrize("change", [
    {"version": "2"}, {"jsonlFile": "relative.jsonl"}, {"required": "false"}, {"timeoutMs": 0},
    {"secret": "private-do-not-emit"},
])
def test_private_event_settings_reject_unsupported_or_unsafe_config(tmp_path, change):
    from shaleyeah_contracts.events import EventValidationError
    file = tmp_path / "events.json"
    settings = {"version": "0.1.0", "context": CONTEXT, "producer": PRODUCER, "jsonlFile": str(tmp_path / "out.jsonl"), "required": True, "timeoutMs": 5000}
    file.write_text(json.dumps({**settings, **change}))
    file.chmod(0o600)
    with pytest.raises(EventValidationError, match="invalid_event_configuration"):
        load_jsonl_emitter(file)
