import copy
import json

import httpx2 as httpx
import pytest
from test_events import CONTEXT, PRODUCER
from test_transport_boundary import backend, config

from shaleyeah_mcp import MCPClientConfig, MCPClientError, call_tool
from shaleyeah_mcp.events import EventEmitter


def observer(*, fail_after=None, required=True):
    records = []

    async def sink(record):
        if fail_after is not None and len(records) >= fail_after:
            raise RuntimeError("private-export-credential")
        records.append(copy.deepcopy(record))

    return EventEmitter(CONTEXT, PRODUCER, sink, required=required), records


@pytest.mark.asyncio
async def test_native_mcp_metadata_correlates_without_serializing_tool_arguments(monkeypatch):
    state = backend(monkeypatch)
    events, records = observer()
    result = await call_tool(config(), "echo", {"value": "private-source-body"}, events=events)
    assert result["isError"] is False
    assert [record["status"] for record in records] == ["started", "succeeded"]
    assert "private-source-body" not in json.dumps(records)
    correlation = state["metadata"][0]["org.shaleyeah/correlation"]
    assert correlation["context"] == CONTEXT
    assert correlation["parentEventId"] == records[0]["eventId"]
    assert correlation["spanId"] == records[0]["spanId"]
    assert records[1]["spanId"] == records[0]["spanId"]
    assert records[1]["measurements"]["toolLatencyMs"] >= 0
    assert "modelConfidence" not in records[1]


@pytest.mark.asyncio
async def test_observed_preflight_retry_is_explicit_and_never_replays_dispatch(monkeypatch):
    state = backend(monkeypatch, setup_errors=[httpx.ConnectError("private-credential")])
    events, records = observer()
    await call_tool(config(preflight_attempts=2, retry_delay=0), "echo", {"value": "kept"}, events=events)
    assert [record["status"] for record in records] == ["started", "retried", "started", "succeeded"]
    assert state["connections"] == 2 and state["dispatches"] == 1
    assert records[1]["attempt"] == 1 and records[-1]["attempt"] == 2
    assert "private-credential" not in json.dumps(records)


@pytest.mark.asyncio
async def test_required_start_audit_failure_stops_before_connection_or_dispatch(monkeypatch):
    state = backend(monkeypatch)
    events, _records = observer(fail_after=0)
    with pytest.raises(MCPClientError) as failure:
        await call_tool(config(), "echo", {"value": "kept"}, events=events)
    assert failure.value.code == "audit_unavailable"
    assert failure.value.effect_unknown is False
    assert state["connections"] == state["dispatches"] == 0
    assert "private-export-credential" not in str(failure.value)


@pytest.mark.asyncio
async def test_required_completion_audit_failure_keeps_execution_uncertain_without_replay(monkeypatch):
    state = backend(monkeypatch)
    events, records = observer(fail_after=1)
    with pytest.raises(MCPClientError) as failure:
        await call_tool(config(preflight_attempts=3), "echo", {"value": "kept"}, events=events)
    assert failure.value.code == "audit_unavailable"
    assert failure.value.effect_unknown is True
    assert state["connections"] == state["dispatches"] == 1
    assert [record["status"] for record in records] == ["started"]
    assert events.health["failures"] == 1


@pytest.mark.asyncio
async def test_real_returned_failure_is_never_logged_as_success(monkeypatch):
    state = backend(monkeypatch, result_error=True)
    events, records = observer()
    result = await call_tool(config(), "echo", {"value": "private-failed-result"}, events=events)
    assert result["isError"] is True
    assert [record["status"] for record in records] == ["started", "failed"]
    assert state["dispatches"] == 1
    assert "private-failed-result" not in json.dumps(records)


@pytest.mark.asyncio
async def test_connection_loss_after_dispatch_records_failed_uncertain_effect(monkeypatch):
    state = backend(monkeypatch, call_error=httpx.ConnectError("private-credential"))
    events, records = observer()
    with pytest.raises(MCPClientError):
        await call_tool(config(preflight_attempts=3), "echo", {"value": "kept"}, events=events)
    assert [record["status"] for record in records] == ["started", "failed"]
    assert records[-1]["effectUnknown"] is True
    assert records[-1]["errorCode"] == "connection_failed"
    assert state["dispatches"] == 1
    assert "private-credential" not in json.dumps(records)


@pytest.mark.asyncio
async def test_optional_export_outage_keeps_dispatch_and_exposes_health(monkeypatch):
    state = backend(monkeypatch)
    events, _records = observer(fail_after=0, required=False)
    result = await call_tool(config(), "echo", {"value": "kept"}, events=events)
    assert result["isError"] is False and state["dispatches"] == 1
    assert events.health["failures"] == 2


@pytest.mark.asyncio
async def test_total_deadline_records_failure_after_cancellation_without_replay(monkeypatch):
    state = backend(monkeypatch, call_delay=5)
    events, records = observer()
    original = config()
    bounded = MCPClientConfig(
        endpoint=original.endpoint, credential=original.credential, allow_loopback_http=True,
        total_timeout=0.08, request_timeout=0.05, preflight_attempts=3,
    )
    with pytest.raises(MCPClientError) as failure:
        await call_tool(bounded, "echo", {"value": "kept"}, events=events)
    assert failure.value.code == "timeout"
    assert state["dispatches"] == 1
    assert [record["status"] for record in records] == ["started", "failed"]
    assert records[-1]["effectUnknown"] is True
    assert records[-1]["errorCode"] == "timeout"
