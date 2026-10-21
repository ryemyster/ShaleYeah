import copy
import json
from pathlib import Path

import pytest

from shaleyeah_contracts.events import (
    EventValidationError,
    redact_event,
    validate_event,
    validate_event_context,
)

FIXTURE = json.loads((Path(__file__).parents[1] / "fixtures/employee-events.json").read_text())


def event():
    return copy.deepcopy(FIXTURE["event"])


def test_control_retains_observations_without_mutation():
    value = event()
    before = copy.deepcopy(value)
    assert validate_event(value, expected_context=FIXTURE["context"]) == before
    assert value == before
    assert value["modelConfidence"] == 0
    assert value["measurements"]["corrections"] == 0
    value.pop("modelConfidence")
    value.pop("measurements")
    assert "measurements" not in validate_event(value)


@pytest.mark.parametrize("field,value", [
    ("schemaVersion", "2.0.0"), ("kind", "tool-output"),
    ("sequence", True), ("sequence", 0), ("sequence", 2**53),
    ("observedAt", "yesterday"), ("status", "PASS"), ("eventType", "prompt"),
    ("eventId", "line\nbreak"), ("spanId", "0" * 16),
    ("spanId", "short"), ("toolName", "../?secret=key"),
])
def test_malformed_or_unsupported_event_fails_without_values(field, value):
    record = event()
    record[field] = value
    with pytest.raises(EventValidationError) as failure:
        validate_event(record)
    assert str(value) not in str(failure.value)


@pytest.mark.parametrize("field", ["customerId", "assetId", "taskId", "employeeId"])
def test_each_owner_boundary_is_checked(field):
    record = event()
    record["context"]["scope"][field] = "another-owner"
    with pytest.raises(EventValidationError, match="event_scope_mismatch"):
        validate_event(record, expected_context=FIXTURE["context"])


@pytest.mark.parametrize("field", ["taskRevision", "runId", "qualification"])
def test_revision_run_and_fixture_binding(field):
    record = event()
    record["context"][field] = "live" if field == "qualification" else "another"
    with pytest.raises(EventValidationError):
        validate_event(record, expected_context=FIXTURE["context"])


@pytest.mark.parametrize("value", [True, -1, float("nan"), float("inf"), "estimated"])
def test_human_measurements_are_observed_finite_numbers(value):
    record = event()
    record["measurements"]["humanReviewSeconds"] = value
    with pytest.raises(EventValidationError):
        validate_event(record)


def test_schema_rejects_sensitive_body_and_unknown_metadata():
    record = event()
    record["arguments"] = {"credential": "credential-do-not-emit"}
    with pytest.raises(EventValidationError):
        validate_event(record)
    record = event()
    record["refs"][0]["uri"] = "https://source.invalid/?token=private"
    with pytest.raises(EventValidationError):
        validate_event(record)
    record = event()
    record["versions"]["model"]["credential"] = "credential-do-not-emit"
    with pytest.raises(EventValidationError):
        validate_event(record)


def test_hash_reference_and_duplicate_binding():
    record = event()
    record["refs"][0]["sha256"] = "guessed"
    with pytest.raises(EventValidationError):
        validate_event(record)
    record = event()
    record["refs"].append(copy.deepcopy(record["refs"][0]))
    with pytest.raises(EventValidationError):
        validate_event(record)


def test_model_prose_cannot_log_an_approved_tool_action():
    record = event()
    record["status"] = "approved"
    with pytest.raises(EventValidationError):
        validate_event(record)
    record["eventType"] = "review"
    assert validate_event(record)["status"] == "approved"


def test_zero_trace_and_unknown_context_are_rejected():
    context = copy.deepcopy(FIXTURE["context"])
    context["traceId"] = "0" * 32
    with pytest.raises(EventValidationError):
        validate_event_context(context)
    context = copy.deepcopy(FIXTURE["context"])
    context["authority"] = "model-approved"
    with pytest.raises(EventValidationError):
        validate_event_context(context)


def test_redaction_drops_raw_bodies_before_sink_and_detaches_input():
    record = event()
    record["prompt"] = "raw prompt credential-do-not-emit"
    record["arguments"] = {"key": "credential-do-not-emit"}
    record["refs"][0]["body"] = "confidential source body"
    record["refs"][0]["uri"] = "file:///private/well.las"
    record["versions"]["model"]["credential"] = "credential-do-not-emit"
    record["toolName"] = "credential-do-not-emit"
    safe = redact_event(record, sensitive_values=("credential-do-not-emit",))
    exported = json.dumps(safe)
    assert "credential-do-not-emit" not in exported
    assert "confidential source body" not in exported
    assert "file:///private" not in exported
    assert safe["toolName"] == "redacted"
    assert safe["redaction"]["redactedValues"] == 1
    assert safe["redaction"]["droppedFields"] == 5
    assert validate_event(safe) == safe
    assert record["toolName"] == "credential-do-not-emit"
    safe["context"]["scope"]["customerId"] = "mutated"
    assert record["context"]["scope"]["customerId"] == "operator-fixture"


def test_secret_in_identity_fails_instead_of_changing_owner():
    record = event()
    record["context"]["scope"]["customerId"] = "credential-do-not-emit"
    with pytest.raises(EventValidationError, match="unsafe_event"):
        redact_event(record, sensitive_values=("credential-do-not-emit",))


@pytest.mark.parametrize("values", [("x",), ("",), ("x" * 4097,), tuple("secret-value-" + str(i) for i in range(129))])
def test_redaction_configuration_is_bounded(values):
    with pytest.raises(EventValidationError):
        redact_event(event(), sensitive_values=values)


def test_non_json_cycles_and_oversized_arrays_fail_safely():
    record = event()
    record["refs"] = [record]
    with pytest.raises(EventValidationError):
        redact_event(record)


def test_native_lifecycle_attempts_and_uncertain_dispatch():
    record = event()
    record["eventType"] = "agent"
    record["attempt"] = 1
    record["effectUnknown"] = True
    assert validate_event(record)["effectUnknown"] is True
    record["attempt"] = 0
    with pytest.raises(EventValidationError):
        validate_event(record)


@pytest.mark.parametrize("field,value", [("eventId", "event-1\n"), ("spanId", "1" * 16 + "\n")])
def test_identifier_cannot_have_trailing_newline(field, value):
    record = event()
    record[field] = value
    with pytest.raises(EventValidationError):
        validate_event(record)


def test_producer_stream_is_required_to_disambiguate_restarts():
    record = event()
    record.pop("streamId", None)
    with pytest.raises(EventValidationError):
        validate_event(record)


def test_reported_model_revision_is_distinct_from_configured_target():
    record = event()
    record["versions"]["model"]["reportedRevision"] = "native-reported-001"
    result = validate_event(record)
    assert result["versions"]["model"]["revision"] == "fixture-r1"
    assert result["versions"]["model"]["reportedRevision"] == "native-reported-001"
    record = event()
    record["refs"] *= 65
    with pytest.raises(EventValidationError):
        redact_event(record)
