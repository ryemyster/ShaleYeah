"""Generic employee hooks report source-bound drafts without claiming approval."""

import copy

import pytest
from shaleyeah_contracts.events import EventValidationError
from shaleyeah_mcp.events import EventEmitter
from test_restore import seeded

from shaleyeah_employee.events import EmployeeEvents


@pytest.mark.asyncio
async def test_reporter_events_use_its_scope_and_preserve_zero_without_raw_output(tmp_path):
    catalog, authority, work = await seeded(tmp_path / "context")
    observed = []

    async def sink(record):
        observed.append(copy.deepcopy(record))

    context = {
        "runId": "run.reporter",
        "traceId": "1234567890abcdef1234567890abcdef",
        "scope": authority.scope,
        "taskRevision": work["taskRevision"],
        "qualification": "fixture",
    }
    observer = EmployeeEvents(
        EventEmitter(context, {"id": "reporter-adk", "version": "0.1.0"}, sink)
    )
    try:
        await observer.record_work(work)
        assert len(observed) == 1 and observed[0]["context"]["scope"]["employeeId"] == "reporter"
        assert observed[0]["modelConfidence"] == 0
        assert observed[0]["status"] == "review-required"
        assert "Fixture draft awaits review" not in str(observed)
        forged = copy.deepcopy(work)
        forged["scope"]["employeeId"] = "other"
        with pytest.raises(EventValidationError):
            await observer.record_work(forged)
        assert len(observed) == 1
    finally:
        await catalog.close()
