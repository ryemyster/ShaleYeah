"""Durable context policy controls use current authority, not stored approval flags."""

import asyncio
import copy
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from google.adk.models.llm_request import LlmRequest
from google.genai import types
from shaleyeah_contracts import ContractValidationError

from app.working_context import ContextCatalog, ContextError

ROOT = Path(__file__).resolve().parents[1]
NOW = datetime(2026, 10, 12, 17, 0, tzinfo=UTC)


@pytest.mark.asyncio
async def test_real_clock_precision_produces_portable_context_timestamps(tmp_path):
    catalog, *_ = await seeded(tmp_path / "context", clock=lambda: NOW.replace(microsecond=123456))
    try:
        packet = await catalog.assemble(request(), FixtureCounter())
        assert packet["status"] == "ready"
        assert packet["manifest"]["assembledAt"].endswith(".123+00:00")
    finally:
        await catalog.close()
SCOPE = {
    "customerId": "operator-demo",
    "assetId": "well-demo-1",
    "taskId": "task-geology-1",
    "employeeId": "geologist",
}
PRINCIPAL = {
    "subjectId": "operator",
    "customerId": SCOPE["customerId"],
    "employeeId": SCOPE["employeeId"],
}


def policy(**changes):
    value = {
        "version": "0.1.0",
        "contextPolicy": {"id": "policy.context.geologist", "version": "r1"},
        "budget": {"maxItems": 16, "maxBytes": 32000, "maxTokens": 16000},
        "reservedTokens": 1024,
        "maxCountCalls": 20,
        "maxRecords": 100,
        "maxRecordBytes": 65536,
        "maxSourceAgeSeconds": 86400,
        "retention": {"policy": {"id": "policy.retention", "version": "r1"}, "seconds": 3600},
        "ranking": {"id": "lexical", "version": "1"},
    }
    value.update(changes)
    return value


def records():
    fixture = json.loads((ROOT / "tests/eval/fixtures/source-work.json").read_text())
    source = copy.deepcopy(fixture["trustedRuntime"]["source_artifacts"][0])
    source["scope"] = copy.deepcopy(SCOPE)
    source["taskRevision"] = "r1"
    source["evidence"]["asOf"] = NOW.isoformat()
    source["retrievedAt"] = NOW.isoformat()
    task = json.loads((ROOT.parents[1] / "contracts/fixtures/records.json").read_text())["task"]
    task["scope"] = copy.deepcopy(SCOPE)
    task["inputs"] = [copy.deepcopy(source["artifact"])]
    work = {
        "contractVersion": "0.1.0",
        "kind": "work-product",
        "scope": copy.deepcopy(SCOPE),
        "taskRevision": "r1",
        "artifact": {"id": "product.geology-1", "revision": "r1", "uri": "urn:example:geology:1"},
        "status": "draft",
        "inputs": [copy.deepcopy(source["artifact"])],
        "evidence": [copy.deepcopy(source["evidence"])],
        "findings": [
            {
                "id": "finding.depth",
                "basis": "measured",
                "value": 8400,
                "unit": "FT",
                "evidenceIds": [source["evidence"]["id"]],
                "assumptionIds": [],
            }
        ],
        "assumptions": [
            {
                "id": "assumption.matrix",
                "statement": "Operator scenario: matrix density 2.65 g/cm3",
                "evidenceIds": [],
            }
        ],
        "uncertainty": "Formation interpretation is unreviewed",
        "confidence": 0,
        "blockers": [],
        "review": {"status": "unreviewed", "decisionRefs": []},
    }
    return task, source, work


def approved_handoff():
    task, _, work = records()
    fixture = json.loads((ROOT.parents[1] / "contracts/fixtures/records.json").read_text())
    work["scope"] = {**SCOPE, "taskId": "task-origin", "employeeId": "research-analyst"}
    work["artifact"]["id"] = "product.shared"
    work["status"] = "final"
    decision = copy.deepcopy(fixture["approveDecision"])
    decision.update(scope=work["scope"], taskRevision="r1", productRef=work["artifact"])
    review_request = copy.deepcopy(fixture["reviewRequest"])
    review_request.update(scope=work["scope"], taskRevision="r1", productRef=work["artifact"])
    decision["requestRef"] = {"id": review_request["id"], "revision": review_request["revision"]}
    work["review"] = {
        "status": "approved",
        "decisionRefs": [{"id": decision["id"], "revision": decision["revision"]}],
    }
    task.update(scope=work["scope"], id=work["scope"]["taskId"])
    return {
        "work": work,
        "decision": decision,
        "request": review_request,
        "task": task,
        "recipientScope": SCOPE,
        "current": True,
        "expiresAt": (NOW + timedelta(minutes=30)).isoformat(),
        "usagePolicy": {"id": "policy.shared", "version": "r1"},
        "retentionPolicy": {"id": "policy.shared.retention", "version": "r1"},
    }


@pytest.mark.asyncio
async def test_explicit_reviewed_handoff_retains_provenance_and_rechecks_current_approval(tmp_path):
    receipt = approved_handoff()

    async def review(ref, principal, scope):
        assert principal == PRINCIPAL and scope == SCOPE
        assert ref["id"] == receipt["work"]["artifact"]["id"]
        return copy.deepcopy(receipt)

    catalog, *_ = await seeded(tmp_path / "context", review_authority=review)
    await catalog.put_shared(receipt["work"])
    packet = await catalog.assemble(request(), FixtureCounter())
    assert packet["status"] == "ready"
    shared = packet["manifest"]["sharedKnowledge"][0]
    assert shared["origin"] == receipt["work"]["scope"]
    assert shared["usagePolicy"] == receipt["usagePolicy"]
    assert shared["reviewDecisionRef"] in receipt["work"]["review"]["decisionRefs"]
    assert packet["records"]["product.shared"]["confidence"] == 0
    receipt["current"] = False
    packet = await catalog.assemble(request(), FixtureCounter())
    assert "product.shared" not in packet["records"]
    assert any(entry["reason"] == "approval_required" for entry in packet["omitted"])
    await catalog.close()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "change", ["policy", "expiry", "request", "task", "decision", "recipient", "customer"]
)
async def test_shared_handoff_requires_exact_current_trusted_bindings(tmp_path, change):
    receipt = approved_handoff()
    if change == "policy":
        receipt["decision"]["reviewer"]["authorityPolicy"]["version"] = "r2"
    elif change == "expiry":
        receipt["expiresAt"] = (NOW - timedelta(seconds=1)).isoformat()
    elif change == "request":
        receipt["request"]["revision"] = "r2"
    elif change == "task":
        receipt["task"]["revision"] = "r2"
    elif change == "decision":
        receipt["decision"]["decision"] = "reject"
    elif change == "recipient":
        receipt["recipientScope"] = {**SCOPE, "assetId": "other"}
    else:
        receipt["work"]["scope"]["customerId"] = "other"
    catalog, *_ = await seeded(
        tmp_path / "context", review_authority=lambda *_: asyncio.sleep(0, result=receipt)
    )
    with pytest.raises(ContextError):
        await catalog.put_shared(receipt["work"])
    await catalog.close()


@pytest.mark.asyncio
async def test_selection_revision_includes_time_and_does_not_collide_on_same_prompt(tmp_path):
    catalog, *_ = await seeded(tmp_path / "context")
    first = await catalog.assemble(request(), FixtureCounter())
    await catalog.record_selection(first)
    catalog.clock = lambda: NOW + timedelta(seconds=1)
    second = await catalog.assemble(request(), FixtureCounter())
    assert second["manifest"]["revision"] != first["manifest"]["revision"]
    await catalog.record_selection(second)
    await catalog.close()


class Authority:
    def __init__(self, source):
        self.source = copy.deepcopy(source)
        self.revoked = False
        self.expired = False
        self.operations = {"read", "write", "assemble", "export", "delete", "restore"}
        self.calls = []

    async def grant(self, principal, scope, operation):
        self.calls.append(("grant", operation))
        return {
            "subjectId": PRINCIPAL["subjectId"],
            "scope": copy.deepcopy(SCOPE),
            "policy": {"id": "policy.context.geologist", "version": "r1"},
            "operations": sorted(self.operations),
            "revoked": self.revoked,
            "expiresAt": (NOW + timedelta(seconds=-1 if self.expired else 3600)).isoformat(),
        }

    async def source_access(self, evidence, principal, scope, operation):
        self.calls.append(("source", operation))
        return {
            "subjectId": PRINCIPAL["subjectId"],
            "scope": copy.deepcopy(SCOPE),
            "allowed": not self.revoked,
            "operations": ["read", "export"],
            "evidence": copy.deepcopy(self.source["evidence"]),
            "retentionExpiresAt": (NOW + timedelta(hours=1)).isoformat(),
        }


class FixtureCounter:
    """An explicitly injected test counter; no production token accuracy is asserted."""

    def __init__(self, count=None):
        self.calls = []
        self.count = count

    async def __call__(self, request):
        text = request.model_dump_json(exclude_none=True)
        self.calls.append(text)
        return {
            "tokens": self.count if self.count is not None else len(text.encode()),
            "counter": {"id": "fixture.bytes-as-tokens", "version": "1"},
            "model": request.model,
            "qualification": "fixture",
        }


def request(text="Review the density assumptions"):
    return LlmRequest(
        model="fixture-model",
        contents=[types.Content(role="user", parts=[types.Part(text=text)])],
        config=types.GenerateContentConfig(system_instruction="Human review is required"),
    )


async def opened(
    root, authority, *, scope=None, principal=None, configuration=None, clock=None, **kwargs
):
    return await ContextCatalog.open(
        root,
        scope or SCOPE,
        principal or PRINCIPAL,
        configuration or policy(),
        grant_provider=authority.grant,
        source_authority=authority.source_access,
        clock=clock or (lambda: NOW),
        **kwargs,
    )


async def seeded(root, **kwargs):
    task, source, work = records()
    authority = Authority(source)
    catalog = await opened(root, authority, **kwargs)
    await catalog.put_task(task)
    await catalog.put_source(source)
    await catalog.put_work(work)
    await catalog.checkpoint(
        work_refs=[work["artifact"]],
        pending_review_refs=[{"id": "review.pending-1", "revision": "r1"}],
        questions=["Confirm the supplied matrix assumption"],
        conflicts=[],
    )
    return catalog, authority, task, source, work


@pytest.mark.asyncio
async def test_restart_restores_exact_task_assumptions_zero_and_pending_review(tmp_path):
    catalog, authority, task, source, work = await seeded(tmp_path / "context")
    await catalog.close()
    restored = await opened(tmp_path / "context", authority)
    packet = await restored.assemble(request(), FixtureCounter())
    assert packet["status"] == "ready"
    assert packet["task"] == task
    assert packet["checkpoint"]["pendingReviewRefs"] == [
        {"id": "review.pending-1", "revision": "r1"}
    ]
    assert packet["records"][work["artifact"]["id"]]["confidence"] == 0
    assert packet["records"][work["artifact"]["id"]]["assumptions"] == work["assumptions"]
    assert packet["manifest"]["selectedEvidence"][0]["hash"] == source["evidence"]["hash"]
    assert packet["measurements"]["inputBytes"] == len(
        packet["request"].model_dump_json(exclude_none=True).encode()
    )
    assert packet["measurements"]["counter"]["qualification"] == "fixture"
    await restored.close()


@pytest.mark.asyncio
@pytest.mark.parametrize("field", ["customerId", "assetId", "taskId", "employeeId"])
async def test_foreign_scope_fails_before_catalog_content_or_directory_creation(tmp_path, field):
    _, source, _ = records()
    authority = Authority(source)
    scope = {**SCOPE, field: "other"}
    with pytest.raises(ContextError):
        await opened(tmp_path / "forbidden", authority, scope=scope)
    assert not (tmp_path / "forbidden").exists()


@pytest.mark.asyncio
async def test_malformed_permission_receipts_do_not_grant_substring_authority(tmp_path):
    _, source, _ = records()
    authority = Authority(source)
    original = authority.grant

    async def malformed(*args):
        value = await original(*args)
        value["operations"] = "read-write-assemble-delete"
        return value

    with pytest.raises(ContextError):
        await ContextCatalog.open(
            tmp_path / "forbidden",
            SCOPE,
            PRINCIPAL,
            policy(),
            grant_provider=malformed,
            source_authority=authority.source_access,
            clock=lambda: NOW,
        )
    assert not (tmp_path / "forbidden").exists()


@pytest.mark.asyncio
async def test_other_principal_and_expired_or_revoked_grants_cannot_restore_state(tmp_path):
    catalog, authority, *_ = await seeded(tmp_path / "context")
    await catalog.close()
    with pytest.raises(ContextError):
        await opened(tmp_path / "context", authority, principal={**PRINCIPAL, "subjectId": "other"})
    authority.expired = True
    with pytest.raises(ContextError):
        await opened(tmp_path / "context", authority)
    authority.expired = False
    restored = await opened(tmp_path / "context", authority)
    authority.revoked = True
    counter = FixtureCounter()
    with pytest.raises(ContextError):
        await restored.assemble(request(), counter)
    assert counter.calls == []
    await restored.close()


@pytest.mark.asyncio
async def test_revision_change_and_stale_source_block_without_reusing_old_derived_work(tmp_path):
    catalog, authority, _, source, work = await seeded(tmp_path / "context")
    authority.source["evidence"]["hash"]["value"] = "f" * 64
    packet = await catalog.assemble(request(), FixtureCounter())
    assert packet["status"] == "blocked"
    assert work["artifact"]["id"] not in packet["records"]
    assert "8400" not in packet["request"].model_dump_json()
    assert packet["checkpoint"]["pendingReviewRefs"]
    assert any(entry["reason"] == "revision_mismatch" for entry in packet["omitted"])
    authority.source = source
    authority.source["evidence"]["asOf"] = (NOW - timedelta(days=2)).isoformat()
    packet = await catalog.assemble(request(), FixtureCounter())
    assert packet["status"] == "blocked"
    assert any(entry["reason"] == "stale_evidence" for entry in packet["omitted"])
    await catalog.close()


@pytest.mark.asyncio
async def test_changed_as_of_metadata_does_not_requalify_an_old_source_envelope(tmp_path):
    catalog, authority, _, _, work = await seeded(tmp_path / "context")
    authority.source["evidence"]["asOf"] = (NOW - timedelta(minutes=1)).isoformat()
    packet = await catalog.assemble(request(), FixtureCounter())
    assert packet["status"] == "blocked"
    assert work["artifact"]["id"] not in packet["records"]
    assert any(entry["reason"] == "revision_mismatch" for entry in packet["omitted"])
    await catalog.close()


@pytest.mark.asyncio
async def test_required_budget_overflow_blocks_and_includes_system_and_tool_headers(tmp_path):
    catalog, *_ = await seeded(
        tmp_path / "context",
        configuration=policy(budget={"maxItems": 16, "maxBytes": 32000, "maxTokens": 1200}),
    )
    counter = FixtureCounter(count=400)
    packet = await catalog.assemble(request(), counter)
    assert packet["status"] == "blocked", "input400 + reserved1024 exceeds1200"
    assert any(entry["code"] == "context_limit" for entry in packet["blockers"])
    assert "Human review is required" in counter.calls[0]
    await catalog.close()


@pytest.mark.asyncio
async def test_conflicting_products_and_pending_decisions_survive_structured_compaction(tmp_path):
    catalog, _, _, _, work = await seeded(tmp_path / "context")
    other = copy.deepcopy(work)
    other["artifact"] = {
        "id": "product.conflicting-1",
        "revision": "r1",
        "uri": "urn:example:conflict:1",
    }
    other["findings"][0]["value"] = 8401
    await catalog.put_work(other)
    checkpoint = await catalog.checkpoint(
        work_refs=[work["artifact"], other["artifact"]],
        pending_review_refs=[{"id": "review.pending-1", "revision": "r1"}],
        questions=["Resolve conflicting literal picks"],
        conflicts=[{"left": work["artifact"], "right": other["artifact"]}],
    )
    compacted = await catalog.compact()
    assert compacted["checkpoint"] == checkpoint
    assert compacted["records"][work["artifact"]["id"]]["findings"][0]["value"] == 8400
    assert compacted["records"][other["artifact"]["id"]]["findings"][0]["value"] == 8401
    assert compacted["records"][other["artifact"]["id"]]["findings"][0]["unit"] == "FT"
    await catalog.close()


@pytest.mark.asyncio
async def test_changed_content_cannot_overwrite_same_revision_and_stale_checkpoint_cas_fails(
    tmp_path,
):
    catalog, _, _, _, work = await seeded(tmp_path / "context")
    changed = copy.deepcopy(work)
    changed["findings"][0]["value"] = 9999
    with pytest.raises(ContextError, match="revision"):
        await catalog.put_work(changed, expected="r1")
    checkpoint = await catalog.current_checkpoint()
    await catalog.checkpoint(
        work_refs=[work["artifact"]],
        pending_review_refs=[],
        questions=["changed"],
        conflicts=[],
        expected=checkpoint["revision"],
    )
    with pytest.raises(ContextError, match="revision"):
        await catalog.checkpoint(
            work_refs=[],
            pending_review_refs=[],
            questions=[],
            conflicts=[],
            expected=checkpoint["revision"],
        )
    await catalog.close()


@pytest.mark.asyncio
async def test_self_declared_approval_does_not_promote_shared_knowledge(tmp_path):
    catalog, _, _, _, work = await seeded(tmp_path / "context")
    forged = copy.deepcopy(work)
    forged["status"] = "final"
    forged["review"] = {
        "status": "approved",
        "decisionRefs": [{"id": "review.decision-1", "revision": "r1"}],
    }
    with pytest.raises(ContextError):
        await catalog.put_shared(forged)
    await catalog.close()


@pytest.mark.asyncio
async def test_export_and_restore_cannot_resurrect_deleted_source_or_descendants(tmp_path):
    catalog, authority, _, source, work = await seeded(tmp_path / "context")
    exported = await catalog.export_state()
    assert exported["version"] == "0.1.0"
    await catalog.delete(source["artifact"])
    await catalog.close()
    restored = await opened(tmp_path / "context", authority)
    await restored.restore_state(exported)
    packet = await restored.assemble(request(), FixtureCounter())
    assert packet["status"] == "blocked"
    assert source["artifact"]["id"] not in packet["records"]
    assert work["artifact"]["id"] not in packet["records"]
    assert "8400" not in packet["request"].model_dump_json()
    assert packet["checkpoint"]["pendingReviewRefs"] == exported["checkpoint"]["pendingReviewRefs"]
    await restored.close()


@pytest.mark.asyncio
async def test_export_denial_does_not_materialize_source_derived_checkpoint(tmp_path, monkeypatch):
    catalog, authority, *_ = await seeded(tmp_path / "context")
    original = authority.source_access

    async def restricted(*args):
        receipt = await original(*args)
        receipt["operations"] = ["read"]
        return receipt

    catalog.source_authority = restricted
    materialized = []
    original_body = catalog._body

    def observe(row):
        materialized.append(row["kind"])
        return original_body(row)

    monkeypatch.setattr(catalog, "_body", observe)
    exported = await catalog.export_state()
    assert exported["records"] == []
    assert exported["checkpoint"]["questions"] == []
    assert materialized == ["task"]
    await catalog.close()


@pytest.mark.asyncio
async def test_source_changes_during_count_and_before_dispatch_are_rejected(tmp_path):
    catalog, authority, *_ = await seeded(tmp_path / "context")

    async def counter(value):
        authority.source["evidence"]["hash"]["value"] = "e" * 64
        return await FixtureCounter()(value)

    with pytest.raises(ContextError, match="revision_mismatch"):
        await catalog.assemble(request(), counter)
    await catalog.close()


@pytest.mark.asyncio
async def test_item_limit_returns_a_valid_blocked_manifest_and_no_counter_call(tmp_path):
    catalog, *_ = await seeded(
        tmp_path / "context",
        configuration=policy(budget={"maxItems": 1, "maxBytes": 32000, "maxTokens": 16000}),
    )
    counter = FixtureCounter()
    packet = await catalog.assemble(request(), counter)
    assert packet["status"] == "blocked"
    assert packet["manifest"]["blockers"]
    assert counter.calls == []
    await catalog.close()


@pytest.mark.asyncio
async def test_storage_limit_counts_historical_revisions_and_retention_is_enforced(tmp_path):
    catalog, _authority, _, _, work = await seeded(
        tmp_path / "context", configuration=policy(maxRecords=4)
    )
    changed = copy.deepcopy(work)
    changed["artifact"]["revision"] = "r2"
    with pytest.raises(ContextError, match="record_limit"):
        await catalog.put_work(changed, expected="r1")
    catalog.clock = lambda: NOW + timedelta(hours=2)
    with pytest.raises(ContextError):
        await catalog.compact()
    await catalog.close()


@pytest.mark.asyncio
async def test_valid_portable_snapshot_retains_questions_and_never_rewinds_current_versions(
    tmp_path,
):
    catalog, authority, _, _, work = await seeded(tmp_path / "context")
    checkpoint = await catalog.current_checkpoint()
    snapshot = json.loads(json.dumps(await catalog.export_state()))
    fresh = await opened(tmp_path / "restored", authority)
    await fresh.restore_state(snapshot)
    packet = await fresh.assemble(request(), FixtureCounter())
    assert packet["status"] == "ready"
    assert packet["checkpoint"] == checkpoint
    revised = copy.deepcopy(work)
    revised["artifact"]["revision"] = "r2"
    revised["findings"][0]["value"] = 8401
    await fresh.put_work(revised, expected="r1")
    latest = await fresh.checkpoint(
        work_refs=[revised["artifact"]],
        pending_review_refs=[],
        questions=["Current question"],
        conflicts=[],
    )
    await fresh.restore_state(snapshot)
    packet = await fresh.assemble(request(), FixtureCounter())
    assert packet["checkpoint"] == latest
    assert packet["records"][work["artifact"]["id"]] == revised
    await fresh.close()
    await catalog.close()


@pytest.mark.asyncio
async def test_transitive_summary_dependencies_do_not_launder_revoked_evidence(
    tmp_path, monkeypatch
):
    catalog, authority, _, _, work = await seeded(tmp_path / "context")
    summary = copy.deepcopy(work)
    summary["artifact"]["id"] = "product.summary"
    summary["inputs"] = [work["artifact"]]
    summary["findings"][0]["value"] = "Private derived summary"
    await catalog.put_work(summary)
    authority.revoked = True
    # Context grant remains live while only evidence access is revoked.
    grant = authority.grant

    async def context_grant(*args):
        receipt = await grant(*args)
        receipt["revoked"] = False
        return receipt

    catalog.grant_provider = context_grant
    seen = []
    original = catalog._body

    def observe(row):
        seen.append(row["id"])
        return original(row)

    monkeypatch.setattr(catalog, "_body", observe)
    packet = await catalog.assemble(request(), FixtureCounter())
    assert packet["status"] == "blocked"
    assert summary["artifact"]["id"] not in packet["records"]
    assert summary["artifact"]["id"] not in seen
    assert work["artifact"]["id"] not in seen
    assert "Private derived summary" not in packet["request"].model_dump_json()
    await catalog.close()


@pytest.mark.asyncio
async def test_optional_selection_is_deterministic_and_explains_exclusions(tmp_path):
    catalog, _, _, _, work = await seeded(
        tmp_path / "context",
        configuration=policy(budget={"maxItems": 3, "maxBytes": 32000, "maxTokens": 16000}),
    )
    for name, statement in [("z", "Density scenario"), ("a", "Unrelated scenario")]:
        extra = copy.deepcopy(work)
        extra["artifact"]["id"] = "product." + name
        extra["assumptions"][0]["statement"] = statement
        await catalog.put_work(extra)
    left = await catalog.assemble(request("Density"), FixtureCounter())
    right = await catalog.assemble(request("Density"), FixtureCounter())
    assert list(left["records"]) == list(right["records"])
    assert "product.z" in left["records"]
    assert {"id": "product.a", "revision": "r1", "reason": "context_limit"} in left["omitted"]
    await catalog.close()


@pytest.mark.asyncio
async def test_optional_items_are_removed_before_required_context_and_counter_calls_are_bounded(
    tmp_path,
):
    catalog, _, _, _, work = await seeded(
        tmp_path / "context",
        configuration=policy(budget={"maxItems": 16, "maxBytes": 32000, "maxTokens": 1500}),
    )
    extra = copy.deepcopy(work)
    extra["artifact"]["id"] = "product.optional"
    await catalog.put_work(extra)

    async def counter(value):
        text = value.model_dump_json()
        return {
            "tokens": 1000 if "product.optional" in text else 100,
            "counter": {"id": "fixture", "version": "1"},
            "model": value.model,
            "qualification": "fixture",
        }

    packet = await catalog.assemble(request(), counter)
    assert packet["status"] == "ready"
    assert "product.optional" not in packet["records"]
    assert packet["checkpoint"]["pendingReviewRefs"]
    catalog.policy["maxCountCalls"] = 1
    with pytest.raises(ContextError, match="counter_budget"):
        await catalog.assemble(request(), counter)
    await catalog.close()


@pytest.mark.asyncio
@pytest.mark.parametrize("fault", ["negative", "model", "outage"])
async def test_invalid_or_unavailable_counters_cannot_approve_context(tmp_path, fault):
    catalog, *_ = await seeded(tmp_path / "context")

    async def counter(value):
        if fault == "outage":
            raise RuntimeError("untrusted vendor body")
        receipt = await FixtureCounter()(value)
        if fault == "negative":
            receipt["tokens"] = -1
        else:
            receipt["model"] = "different"
        return receipt

    with pytest.raises(ContextError) as rejected:
        await catalog.assemble(request(), counter)
    assert "vendor body" not in str(rejected.value)
    await catalog.close()


@pytest.mark.asyncio
async def test_corrupt_content_and_future_storage_formats_fail_closed(tmp_path):
    import sqlite3

    catalog, authority, _, _, work = await seeded(tmp_path / "context")
    catalog.db.execute(
        "UPDATE records SET body=? WHERE namespace=? AND id=?",
        (b"{}", catalog.namespace, work["artifact"]["id"]),
    )
    packet = await catalog.assemble(request(), FixtureCounter())
    assert packet["status"] == "blocked"
    assert work["artifact"]["id"] not in packet["records"]
    assert any(entry["reason"] == "integrity_failure" for entry in packet["omitted"])
    await catalog.close()
    with sqlite3.connect(tmp_path / "context/catalog.sqlite") as database:
        database.execute("UPDATE format SET version='99.0.0'")
    with pytest.raises(ContextError, match="unsupported_version"):
        await opened(tmp_path / "context", authority)


@pytest.mark.asyncio
async def test_concurrent_writers_cannot_overwrite_an_observed_revision(tmp_path):
    catalog, authority, _, _, work = await seeded(tmp_path / "context")
    other = await opened(tmp_path / "context", authority)
    grant = authority.grant

    async def yield_grant(*args):
        await asyncio.sleep(0)
        return await grant(*args)

    catalog.grant_provider = other.grant_provider = yield_grant
    values = [copy.deepcopy(work), copy.deepcopy(work)]
    for index, value in enumerate(values):
        value["artifact"]["revision"] = "r" + str(index + 2)
        value["findings"][0]["value"] = 8401 + index
    results = await asyncio.gather(
        catalog.put_work(values[0], expected="r1"),
        other.put_work(values[1], expected="r1"),
        return_exceptions=True,
    )
    assert sum(isinstance(result, ContextError) for result in results) == 1
    assert catalog._head(work["artifact"]["id"]) in {"r2", "r3"}
    await other.close()
    await catalog.close()


@pytest.mark.asyncio
async def test_repeat_retrieval_keeps_first_receipt_without_rewriting_source_identity(tmp_path):
    catalog, _, _, source, _ = await seeded(tmp_path / "context")
    repeated = copy.deepcopy(source)
    repeated["retrievedAt"] = (NOW + timedelta(seconds=1)).isoformat()
    await catalog.put_source(repeated)
    packet = await catalog.assemble(request(), FixtureCounter())
    assert packet["records"][source["artifact"]["id"]] == source
    repeated["licenseNotes"] = "Different usage claim"
    with pytest.raises(ContextError, match="revision_mismatch"):
        await catalog.put_source(repeated)
    await catalog.close()


@pytest.mark.asyncio
async def test_metadata_revision_change_invalidates_dependants_even_with_identical_source_bytes(
    tmp_path,
):
    catalog, authority, _, source, work = await seeded(tmp_path / "context")
    revised = copy.deepcopy(source)
    revised["evidence"]["revision"] = "r2"
    revised["evidence"]["usagePolicy"]["version"] = "r2"
    authority.source = revised
    await catalog.put_source(revised, expected=source["artifact"]["revision"])
    packet = await catalog.assemble(request(), FixtureCounter())
    assert packet["status"] == "blocked"
    assert packet["records"][source["artifact"]["id"]]["artifact"] == source["artifact"]
    assert packet["manifest"]["selectedEvidence"][0]["revision"] == "r2"
    assert work["artifact"]["id"] not in packet["records"]
    assert packet["checkpoint"]["questions"] == []
    await catalog.close()


@pytest.mark.asyncio
async def test_compaction_refuses_to_discard_required_work_when_byte_limit_is_too_small(tmp_path):
    catalog, *_ = await seeded(
        tmp_path / "context",
        configuration=policy(budget={"maxItems": 16, "maxBytes": 1, "maxTokens": 16000}),
    )
    with pytest.raises(ContextError, match="context_limit"):
        await catalog.compact()
    packet = await catalog.assemble(request(), FixtureCounter())
    assert packet["status"] == "blocked" and packet["measurements"]["counter"] is None
    await catalog.close()


@pytest.mark.asyncio
async def test_portable_restore_preserves_original_retention_instead_of_renewing_it(tmp_path):
    catalog, authority, *_ = await seeded(tmp_path / "context")
    snapshot = await catalog.export_state()
    grant, source_access = authority.grant, authority.source_access

    async def fresh_grant(*args):
        value = await grant(*args)
        value["expiresAt"] = (NOW + timedelta(days=1)).isoformat()
        return value

    async def fresh_source(*args):
        value = await source_access(*args)
        value["retentionExpiresAt"] = (NOW + timedelta(days=1)).isoformat()
        return value

    fresh = await opened(tmp_path / "fresh", authority, clock=lambda: NOW + timedelta(minutes=30))
    fresh.grant_provider, fresh.source_authority = fresh_grant, fresh_source
    await fresh.restore_state(snapshot)
    fresh.clock = lambda: NOW + timedelta(minutes=61)
    with pytest.raises(ContextError, match="expired"):
        await fresh.compact()
    with pytest.raises(ContextError, match="expired"):
        await fresh.restore_state(snapshot)
    await fresh.close()
    await catalog.close()


@pytest.mark.asyncio
async def test_expiry_purge_removes_content_and_keeps_a_nonresurrecting_ledger(tmp_path):
    catalog, authority, *_ = await seeded(tmp_path / "context")
    exported = await catalog.export_state()
    grant = authority.grant

    async def permit_cleanup(*args):
        value = await grant(*args)
        value["expiresAt"] = (NOW + timedelta(days=1)).isoformat()
        return value

    catalog.grant_provider = permit_cleanup
    catalog.clock = lambda: NOW + timedelta(minutes=61)
    assert await catalog.purge_expired() == 4
    assert (
        catalog.db.execute(
            "SELECT COUNT(*) FROM records WHERE namespace=? AND body IS NOT NULL",
            (catalog.namespace,),
        ).fetchone()[0]
        == 0
    )
    catalog.clock = lambda: NOW
    with pytest.raises(ContextError, match="deleted"):
        await catalog.restore_state(exported)
    await catalog.close()


@pytest.mark.asyncio
async def test_incompatible_snapshot_records_fail_before_creating_restored_task(tmp_path):
    catalog, authority, *_ = await seeded(tmp_path / "context")
    exported = await catalog.export_state()
    exported["records"][0]["body"] = exported["task"]
    fresh = await opened(tmp_path / "fresh", authority)
    with pytest.raises((ContextError, ContractValidationError)) as rejected:
        await fresh.restore_state(exported)
    assert getattr(rejected.value, "code", None) == "invalid_contract"
    assert fresh._head(SCOPE["taskId"]) is None
    await fresh.close()
    await catalog.close()


@pytest.mark.asyncio
async def test_private_storage_refuses_symlinks_shared_permissions_and_future_formats(tmp_path):
    _, source, _ = records()
    authority = Authority(source)
    root = tmp_path / "context"
    root.mkdir(mode=0o700)
    target = tmp_path / "elsewhere"
    target.mkdir()
    (root / "catalog.sqlite").symlink_to(target / "db")
    with pytest.raises(ContextError):
        await opened(root, authority)
    (root / "catalog.sqlite").unlink()
    root.chmod(0o755)
    with pytest.raises(ContextError):
        await opened(root, authority)
    root.chmod(0o700)
    with pytest.raises(ContextError, match="version"):
        await opened(root, authority, configuration=policy(version="99.0.0"))
