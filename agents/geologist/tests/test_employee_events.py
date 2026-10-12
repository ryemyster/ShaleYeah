import copy
import hashlib
import json
from pathlib import Path

import pytest
import rfc8785
from shaleyeah_contracts.events import EventValidationError
from shaleyeah_mcp.events import EventEmitter

from app.employee_events import GeologistEvents, VerifiedReview

RECORDS = json.loads((Path(__file__).parents[3] / "contracts/fixtures/records.json").read_text())


def observer():
    records = []

    async def sink(record):
        records.append(copy.deepcopy(record))

    task = RECORDS["task"]
    context = {"runId": "run-fixture", "traceId": "1234567890abcdef1234567890abcdef", "scope": task["scope"], "taskRevision": task["revision"], "qualification": "fixture"}
    emitter = EventEmitter(context, {"id": "geologist", "version": "0.1.0"}, sink)
    return GeologistEvents(emitter), records


@pytest.mark.asyncio
async def test_host_task_context_work_and_verified_review_share_exact_references():
    observer_api, records = observer()
    first = await observer_api.record_task(RECORDS["task"])
    await observer_api.record_context(RECORDS["context"], parent_event_id=first["eventId"])
    await observer_api.record_work(RECORDS["work"])
    await observer_api.record_review_request(RECORDS["reviewRequest"])
    decision = RECORDS["reviewDecision"]
    proof = VerifiedReview(
        principal_id=decision["reviewer"]["principalId"], decision_hash=hashlib.sha256(rfc8785.dumps(decision)).hexdigest(),
        policy_id=decision["reviewer"]["authorityPolicy"]["id"], policy_version=decision["reviewer"]["authorityPolicy"]["version"],
    )
    await observer_api.record_review(RECORDS["reviewRequest"], decision, verified=proof, measurements={"humanReviewSeconds": 45, "corrections": 1, "reworkCount": 1})
    assert [record["eventType"] for record in records] == ["task", "context", "work-product", "review", "review"]
    assert records[1]["parentEventId"] == first["eventId"]
    assert records[2]["modelConfidence"] == 0
    assert records[-1]["status"] == "revision-requested"
    assert records[-1]["measurements"]["humanReviewSeconds"] == 45
    assert records[2]["refs"][0]["sha256"] == hashlib.sha256(rfc8785.dumps(RECORDS["work"])).hexdigest()
    text = json.dumps(records)
    assert "Interpret the supplied log" not in text
    assert "Resolve depth datum" not in text
    assert "urn:example" not in text
    assert "source" in {ref["kind"] for record in records for ref in record["refs"]}


@pytest.mark.asyncio
@pytest.mark.parametrize("field", ["customerId", "assetId", "taskId", "employeeId"])
async def test_host_hooks_reject_cross_owner_records_before_emission(field):
    observer_api, records = observer()
    changed = copy.deepcopy(RECORDS["work"])
    changed["scope"][field] = "another"
    with pytest.raises(EventValidationError):
        await observer_api.record_work(changed)
    assert not records


@pytest.mark.parametrize("field", ["customerId", "employeeId"])
def test_model_owner_cannot_bind_another_employee_event_stream(field):
    observer_api, records = observer()
    scope = observer_api.emitter.context["scope"]
    owner = {key: scope[key] for key in ("customerId", "employeeId")}
    owner[field] = "another-owner"
    with pytest.raises(EventValidationError, match="event_scope_mismatch"):
        GeologistEvents(observer_api.emitter, {"owner": owner})
    assert not records


@pytest.mark.asyncio
async def test_review_record_needs_bound_host_verification_not_model_flags():
    observer_api, records = observer()
    decision = copy.deepcopy(RECORDS["reviewDecision"])
    with pytest.raises(EventValidationError):
        await observer_api.record_review(RECORDS["reviewRequest"], decision, verified={"approved": True})
    proof = VerifiedReview(principal_id="wrong-human", decision_hash=hashlib.sha256(rfc8785.dumps(decision)).hexdigest(), policy_id="policy.geologist.review", policy_version="r1")
    with pytest.raises(EventValidationError):
        await observer_api.record_review(RECORDS["reviewRequest"], decision, verified=proof)
    proof = VerifiedReview(principal_id=decision["reviewer"]["principalId"], decision_hash=hashlib.sha256(rfc8785.dumps(decision)).hexdigest(), policy_id="policy.geologist.review", policy_version="r1")
    decision["reason"] = "changed after review"
    with pytest.raises(EventValidationError):
        await observer_api.record_review(RECORDS["reviewRequest"], decision, verified=proof)
    assert not records


@pytest.mark.asyncio
async def test_changed_request_or_product_revision_cannot_be_logged_as_reviewed():
    observer_api, records = observer()
    decision = copy.deepcopy(RECORDS["reviewDecision"])
    decision["requestRef"]["revision"] = "stale"
    proof = VerifiedReview(principal_id=decision["reviewer"]["principalId"], decision_hash=hashlib.sha256(rfc8785.dumps(decision)).hexdigest(), policy_id="policy.geologist.review", policy_version="r1")
    with pytest.raises(EventValidationError):
        await observer_api.record_review(RECORDS["reviewRequest"], decision, verified=proof)
    assert not records


@pytest.mark.asyncio
async def test_model_claimed_final_product_still_needs_separate_verified_review():
    observer_api, records = observer()
    final = copy.deepcopy(RECORDS["finalWork"])
    await observer_api.record_work(final)
    assert records[-1]["status"] == "review-required"


@pytest.mark.asyncio
async def test_running_task_uses_the_existing_business_enum():
    observer_api, records = observer()
    task = copy.deepcopy(RECORDS["task"])
    task["status"] = "running"
    await observer_api.record_task(task)
    assert records[-1]["status"] == "started"


@pytest.mark.asyncio
async def test_portable_evaluation_outcome_keeps_profile_hash_and_observed_review_measurements():
    from shaleyeah_evaluations import EvaluationContext
    from shaleyeah_evaluations.runner import run_case
    from test_eval_adapter import fixture, performance
    value = fixture()
    candidate = {
        "id": "fixture.gemini", "version": "r1",
        "model": {"provider": "gemini", "id": "fixture-model", "revision": "r1"},
        "runtime": {"id": "google-adk", "version": "2.4.0"},
        "harness": {"id": "agents-cli", "version": "1.3.1"}, "qualification": "fixture",
    }
    profile = performance()
    report = await run_case(profile=profile, trace=value["trace"], context=EvaluationContext.from_trusted_runtime(**value["trustedRuntime"]),
        candidate=candidate, measurements={"reviewSeconds": 12, "corrections": 1})
    records = []
    async def sink(record):
        records.append(record)
    observer_api = GeologistEvents(EventEmitter({"runId": "eval-run", "traceId": "1234567890abcdef1234567890abcdef",
        "scope": report["scope"], "taskRevision": report["taskRevision"], "qualification": "fixture"}, {"id": "geologist", "version": "0.1.0"}, sink))
    await observer_api.record_evaluation(report)
    record = records[-1]
    assert record["eventType"] == "evaluation"
    assert record["status"] == {"passed": "succeeded"}.get(report["status"], report["status"])
    assert record["refs"][1]["sha256"] == profile.config_hash
    assert record["refs"][0]["sha256"] == hashlib.sha256(rfc8785.dumps(report)).hexdigest()
    assert record["measurements"]["humanReviewSeconds"] == 12
    assert "modelLatencyMs" not in record["measurements"]
    changed = copy.deepcopy(report)
    changed["scope"]["customerId"] = "another"
    with pytest.raises(EventValidationError):
        await observer_api.record_evaluation(changed)
