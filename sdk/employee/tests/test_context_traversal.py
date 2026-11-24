"""Shared dependencies must stay bounded without carrying authority across phases."""

import copy
import hashlib
import json
from collections import Counter
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from google.adk.models.llm_request import LlmRequest
from google.genai import types

from shaleyeah_employee.context import ContextCatalog, ContextError

NOW = datetime(2026, 10, 20, tzinfo=UTC)
FIXTURES = Path(__file__).parent / "fixtures"
SCOPE = {
    "customerId": "operator-demo",
    "assetId": "asset.context",
    "taskId": "task.context",
    "employeeId": "employee.context",
}
PRINCIPAL = {
    "subjectId": "operator",
    "customerId": SCOPE["customerId"],
    "employeeId": SCOPE["employeeId"],
}
POLICY = {
    "version": "0.1.0",
    "contextPolicy": {"id": "policy.employee-context", "version": "r1"},
    "budget": {"maxItems": 64, "maxBytes": 524288, "maxTokens": 32000},
    "reservedTokens": 1024,
    "maxCountCalls": 20,
    "maxRecords": 100,
    "maxRecordBytes": 131072,
    "maxSourceAgeSeconds": 86400,
    "retention": {"policy": {"id": "policy.retention", "version": "r1"}, "seconds": 3600},
    "ranking": {"id": "lexical", "version": "1"},
}


class Authority:
    def __init__(self, artifacts):
        self.evidence = {
            item["evidence"]["id"]: copy.deepcopy(item["evidence"]) for item in artifacts
        }
        self.calls = []
        self.revoked = set()
        self.on_source = None
        self.retention_seconds = {}

    async def grant(self, principal, scope, operation):
        assert principal == PRINCIPAL and scope == SCOPE
        return {
            "subjectId": PRINCIPAL["subjectId"],
            "scope": SCOPE,
            "policy": POLICY["contextPolicy"],
            "operations": ["read", "write", "assemble", "export", "restore", "delete"],
            "revoked": False,
            "expiresAt": (NOW + timedelta(hours=1)).isoformat(),
        }

    async def source(self, evidence, principal, scope, operation):
        assert principal == PRINCIPAL and scope == SCOPE
        self.calls.append((evidence["id"], operation))
        if self.on_source is not None:
            await self.on_source(evidence)
        return {
            "subjectId": PRINCIPAL["subjectId"],
            "scope": SCOPE,
            "allowed": evidence["id"] not in self.revoked,
            "operations": ["read", "export"],
            "evidence": copy.deepcopy(self.evidence[evidence["id"]]),
            "retentionExpiresAt": (
                NOW + timedelta(seconds=self.retention_seconds.get(evidence["id"], 3600))
            ).isoformat(),
        }


def source_records():
    template = json.loads((FIXTURES / "source.json").read_text())
    artifacts = []
    for index in range(7):
        source = copy.deepcopy(template)
        source.update(scope=copy.deepcopy(SCOPE), taskRevision="r1")
        digest = hashlib.sha256(f"generic-context-source-{index}".encode()).hexdigest()
        source["evidence"].update(
            id=f"evidence.context.{index}",
            revision="r1",
            uri=f"urn:example:context:{index}",
            hash={"algorithm": "sha256", "value": digest},
            asOf=NOW.isoformat(),
        )
        source["artifact"] = {
            "id": source["evidence"]["id"],
            "revision": digest,
            "uri": "urn:sha256:" + digest,
        }
        source["retrievedAt"] = NOW.isoformat()
        artifacts.append(source)
    return artifacts


def draft(artifacts, layer, branch, previous):
    return {
        "contractVersion": "0.1.0",
        "kind": "work-product",
        "scope": copy.deepcopy(SCOPE),
        "taskRevision": "r1",
        "artifact": {
            "id": f"work.context.{layer}.{branch}",
            "revision": "r1",
            "uri": f"urn:example:work:{layer}:{branch}",
        },
        "status": "draft",
        "inputs": [*[copy.deepcopy(item["artifact"]) for item in artifacts], *previous],
        "evidence": [copy.deepcopy(item["evidence"]) for item in artifacts],
        "findings": [
            {
                "id": "finding.zero",
                "basis": "measured",
                "value": 0,
                "unit": "count",
                "evidenceIds": [item["evidence"]["id"] for item in artifacts],
                "assumptionIds": [],
            }
        ],
        "assumptions": [],
        "uncertainty": "Synthetic context control awaiting human review",
        "confidence": 0,
        "blockers": [],
        "review": {"status": "unreviewed", "decisionRefs": []},
    }


def request():
    return LlmRequest(
        model="gemini-2.5-pro",
        contents=[types.Content(role="user", parts=[types.Part(text="Review current evidence")])],
    )


async def counter(value):
    return {"tokens": 2000, "model": value.model}


async def seeded(root, layers=2, diamond=True, first_source_age=0):
    artifacts = source_records()
    artifacts[0]["evidence"]["asOf"] = (NOW - timedelta(seconds=first_source_age)).isoformat()
    authority = Authority(artifacts)
    catalog = await ContextCatalog.open(
        root.resolve(),
        SCOPE,
        PRINCIPAL,
        POLICY,
        grant_provider=authority.grant,
        source_authority=authority.source,
        clock=lambda: NOW,
    )
    try:
        task = json.loads((FIXTURES / "task.json").read_text())
        task.update(
            id=SCOPE["taskId"],
            scope=copy.deepcopy(SCOPE),
            inputs=[copy.deepcopy(item["artifact"]) for item in artifacts],
            requiredCapabilities=["reporting.draft"],
        )
        await catalog.put_task(task)
        for artifact in artifacts:
            await catalog.put_source(artifact)
        previous, works = [], []
        for layer in range(layers):
            current = []
            for branch in range(2):
                dependencies = previous if diamond else previous[branch : branch + 1]
                work = draft(artifacts, layer, branch, dependencies)
                await catalog.put_work(work)
                works.append(work)
                current.append(copy.deepcopy(work["artifact"]))
            previous = current
        await catalog.checkpoint(
            work_refs=previous,
            pending_review_refs=[],
            questions=[],
            conflicts=[],
        )
        authority.calls.clear()
        return catalog, authority, artifacts, works
    except BaseException:
        await catalog.close()
        raise


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "layers,diamond",
    [
        pytest.param(1, False, id="parallel-chains-1"),
        pytest.param(2, False, id="parallel-chains-2"),
        pytest.param(4, False, id="parallel-chains-4"),
        pytest.param(16, False, id="deep-parallel-chains-16"),
        pytest.param(1, True, id="diamond-1"),
        pytest.param(2, True, id="diamond-2"),
        pytest.param(4, True, id="diamond-4"),
    ],
)
async def test_shared_graph_source_checks_are_linear_per_assembly_phase(tmp_path, layers, diamond):
    catalog, authority, artifacts, works = await seeded(tmp_path / "private", layers, diamond)
    try:
        packet = await catalog.assemble(request(), counter)
        assert packet["status"] == "ready"
        assert len(packet["records"]) == len(artifacts) + len(works)
        assert all(work["artifact"]["id"] in packet["records"] for work in works)
        assert packet["records"][works[-1]["artifact"]["id"]]["findings"][0]["value"] == 0
        bindings = 7 * (1 + len(works))
        observed = len(authority.calls)
        assert observed <= 2 * bindings, (layers, diamond, observed, 2 * bindings)
        per_source = Counter(id for id, _ in authority.calls)
        assert set(per_source) == set(authority.evidence)
        assert set(per_source.values()) == {2 * (1 + len(works))}
        assert all(operation == "read" for _, operation in authority.calls)
    finally:
        await catalog.close()


@pytest.mark.asyncio
@pytest.mark.parametrize("operation,phases", [("dispatch", 1), ("selection", 2), ("export", 3)])
async def test_separate_delivery_operations_have_fresh_bounded_passes(tmp_path, operation, phases):
    catalog, authority, artifacts, works = await seeded(tmp_path / "private", 4)
    try:
        packet = await catalog.assemble(request(), counter)
        authority.calls.clear()
        if operation == "dispatch":
            await catalog.authorize_packet(packet)
        elif operation == "selection":
            await catalog.record_selection(packet)
        else:
            exported = await catalog.export_state()
            assert len(exported["records"]) == len(artifacts) + len(works)
        bindings = 7 * (1 + len(works))
        observed = len(authority.calls)
        assert 0 < observed <= phases * bindings, (operation, observed, phases * bindings)
        assert {id for id, _ in authority.calls} == set(authority.evidence)
        assert set(Counter(id for id, _ in authority.calls).values()) == {phases * (1 + len(works))}
        assert {mode for _, mode in authority.calls} == {
            "export" if operation == "export" else "read"
        }
    finally:
        await catalog.close()


@pytest.mark.asyncio
async def test_revocation_during_count_invalidates_both_diamond_branches(tmp_path):
    catalog, authority, artifacts, _ = await seeded(tmp_path / "private")
    try:

        async def revoke(value):
            authority.revoked.add(artifacts[0]["evidence"]["id"])
            return await counter(value)

        with pytest.raises(ContextError, match="access_denied|revision_mismatch"):
            await catalog.assemble(request(), revoke)
    finally:
        await catalog.close()


@pytest.mark.asyncio
@pytest.mark.parametrize("operation", ["dispatch", "selection", "export", "history"])
async def test_previous_success_cannot_authorize_a_later_revoked_operation(tmp_path, operation):
    catalog, authority, artifacts, works = await seeded(tmp_path / "private")
    try:
        packet = await catalog.assemble(request(), counter)
        await catalog.authorize_packet(packet)
        authority.calls.clear()
        authority.revoked.add(artifacts[0]["evidence"]["id"])
        if operation == "export":
            exported = await catalog.export_state()
            ids = {entry["body"]["artifact"]["id"] for entry in exported["records"]}
            assert ids == {item["artifact"]["id"] for item in artifacts[1:]}
            assert exported["checkpoint"]["invalidated"] is True
        else:
            with pytest.raises(ContextError):
                if operation == "dispatch":
                    await catalog.authorize_packet(packet)
                elif operation == "selection":
                    await catalog.record_selection(packet)
                else:
                    await catalog.authorize_history([works[-1]["artifact"]])
        assert authority.calls
    finally:
        await catalog.close()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "field", ["id", "revision", "hash", "uri", "asOf", "usagePolicy", "accessClassification"]
)
async def test_new_phase_rechecks_complete_source_identity(tmp_path, field):
    catalog, authority, artifacts, works = await seeded(tmp_path / "private")
    try:
        packet = await catalog.assemble(request(), counter)
        await catalog.authorize_packet(packet)
        current = authority.evidence[artifacts[0]["evidence"]["id"]]
        changes = {
            "id": "evidence.changed",
            "revision": "r2",
            "hash": {"algorithm": "sha256", "value": "e" * 64},
            "uri": "urn:example:changed",
            "asOf": (NOW + timedelta(minutes=1)).isoformat(),
            "usagePolicy": {"id": "policy.changed", "version": "r1"},
            "accessClassification": "public",
        }
        current[field] = changes[field]
        with pytest.raises(ContextError):
            await catalog.authorize_history([works[-1]["artifact"]])
    finally:
        await catalog.close()


@pytest.mark.asyncio
@pytest.mark.parametrize("change", ["delete", "supersede", "expire"])
async def test_change_to_an_earlier_dependency_during_await_cannot_be_reused(tmp_path, change):
    catalog, authority, artifacts, works = await seeded(tmp_path / "private")
    try:
        if change == "expire":
            catalog.db.execute(
                "UPDATE records SET expires_at=? WHERE namespace=?",
                ((NOW + timedelta(minutes=30)).isoformat(), catalog.namespace),
            )

        async def mutate(evidence):
            if evidence["id"] != artifacts[1]["evidence"]["id"]:
                return
            authority.on_source = None
            if change == "delete":
                await catalog.delete(artifacts[0]["artifact"])
            elif change == "supersede":
                replacement = copy.deepcopy(artifacts[0])
                replacement["evidence"]["revision"] = "r2"
                authority.evidence[replacement["evidence"]["id"]] = copy.deepcopy(
                    replacement["evidence"]
                )
                await catalog.put_source(replacement, expected=artifacts[0]["artifact"]["revision"])
            else:
                catalog.clock = lambda: NOW + timedelta(minutes=40)

        authority.on_source = mutate
        try:
            packet = await catalog.assemble(request(), counter)
        except ContextError:
            pass
        else:
            assert packet["status"] == "blocked"
            assert not {work["artifact"]["id"] for work in works} & set(packet["records"])
    finally:
        await catalog.close()


@pytest.mark.asyncio
@pytest.mark.parametrize("corruption", ["cycle", "body"])
async def test_dependency_corruption_is_denied_instead_of_memoized(tmp_path, corruption):
    catalog, _, _, works = await seeded(tmp_path / "private")
    try:
        first, last = works[0]["artifact"], works[-1]["artifact"]
        if corruption == "cycle":
            # Normal writes cannot construct a cycle; corrupt persisted metadata
            # to exercise recovery from a damaged catalog through the public API.
            catalog.db.execute(
                "UPDATE records SET dependencies=? WHERE namespace=? AND id=? AND revision=?",
                (json.dumps([last]), catalog.namespace, first["id"], first["revision"]),
            )
        else:
            catalog.db.execute(
                "UPDATE records SET body=? WHERE namespace=? AND id=? AND revision=?",
                (b"{}", catalog.namespace, first["id"], first["revision"]),
            )
        with pytest.raises(ContextError):
            await catalog.authorize_history([last])
    finally:
        await catalog.close()


@pytest.mark.asyncio
async def test_corruption_after_an_earlier_dependency_visit_is_denied(tmp_path):
    catalog, authority, artifacts, works = await seeded(tmp_path / "private")
    mutated = False
    try:

        async def corrupt(evidence):
            nonlocal mutated
            if evidence["id"] == artifacts[1]["evidence"]["id"]:
                authority.on_source = None
                catalog.db.execute(
                    "UPDATE records SET body=? WHERE namespace=? AND id=?",
                    (b"{}", catalog.namespace, artifacts[0]["artifact"]["id"]),
                )
                mutated = True

        authority.on_source = corrupt
        with pytest.raises(ContextError):
            await catalog.authorize_history([artifacts[0]["artifact"], works[-1]["artifact"]])
        assert mutated
    finally:
        await catalog.close()


@pytest.mark.asyncio
async def test_async_content_guard_revocation_prevents_writing_derived_work(tmp_path):
    catalog, authority, artifacts, works = await seeded(tmp_path / "private", 1)
    try:

        async def revoke(_):
            authority.revoked.add(artifacts[0]["evidence"]["id"])

        catalog.content_guard = revoke
        work = draft(artifacts, 2, 0, [works[-1]["artifact"]])
        with pytest.raises(ContextError, match="access_denied"):
            await catalog.put_work(work)
        # A denied write must not create even a private current record.
        assert catalog._head(work["artifact"]["id"]) is None
    finally:
        await catalog.close()


@pytest.mark.asyncio
@pytest.mark.parametrize("boundary", ["retention", "freshness"])
async def test_earlier_source_deadline_crossed_during_later_await_is_denied(tmp_path, boundary):
    age = POLICY["maxSourceAgeSeconds"] - 30 if boundary == "freshness" else 0
    catalog, authority, artifacts, _ = await seeded(tmp_path / "private", first_source_age=age)
    try:
        if boundary == "retention":
            authority.retention_seconds[artifacts[0]["evidence"]["id"]] = 30

        async def advance(evidence):
            if evidence["id"] == artifacts[1]["evidence"]["id"]:
                authority.on_source = None
                catalog.clock = lambda: (
                    NOW + timedelta(seconds=30 if boundary == "retention" else 60)
                )

        authority.on_source = advance
        with pytest.raises(
            ContextError, match="expired" if boundary == "retention" else "stale_evidence"
        ):
            await catalog.authorize_history([item["artifact"] for item in artifacts[:2]])
    finally:
        await catalog.close()


@pytest.mark.asyncio
async def test_source_at_exact_maximum_age_remains_eligible(tmp_path):
    catalog, authority, artifacts, _ = await seeded(
        tmp_path / "private", first_source_age=POLICY["maxSourceAgeSeconds"]
    )
    try:
        await catalog.authorize_history([artifacts[0]["artifact"]])
        assert authority.calls == [(artifacts[0]["evidence"]["id"], "read")]
    finally:
        await catalog.close()


@pytest.mark.asyncio
async def test_content_guard_cannot_rebind_a_source_dependency_to_new_metadata(tmp_path):
    catalog, authority, artifacts, _ = await seeded(tmp_path / "private", 1)
    try:

        async def change(_):
            replacement = copy.deepcopy(artifacts[0])
            replacement["evidence"]["revision"] = "r2"
            authority.evidence[replacement["evidence"]["id"]] = copy.deepcopy(
                replacement["evidence"]
            )
            catalog.content_guard = None
            try:
                await catalog.put_source(replacement, expected=artifacts[0]["artifact"]["revision"])
            finally:
                catalog.content_guard = change

        catalog.content_guard = change
        work = draft(artifacts, 2, 0, [])
        # A draft may retain dependency references without repeating their source
        # claims. Its dependency binding must still survive the guard unchanged.
        work.update(inputs=[artifacts[0]["artifact"]], evidence=[], findings=[])
        with pytest.raises(ContextError, match="revision_mismatch"):
            await catalog.put_work(work)
        assert catalog._head(work["artifact"]["id"]) is None
    finally:
        await catalog.close()
