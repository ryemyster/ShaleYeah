"""An export must retain current roots through its last authority await."""

import copy
import hashlib
import json
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

import pytest
import rfc8785
from test_context_traversal import FIXTURES, NOW, POLICY, PRINCIPAL, SCOPE, Authority, seeded

from shaleyeah_employee.context import ContextCatalog, ContextError


@asynccontextmanager
async def short_checkpoint(root):
    catalog, authority, artifacts, works = await seeded(root, layers=1)
    await catalog.close()
    policy = copy.deepcopy(POLICY)
    policy["retention"] = {
        "policy": {"id": "policy.retention", "version": "r2"},
        "seconds": 30,
    }
    catalog = await ContextCatalog.open(
        root.resolve(),
        SCOPE,
        PRINCIPAL,
        policy,
        grant_provider=authority.grant,
        source_authority=authority.source,
        clock=lambda: NOW,
    )
    try:
        checkpoint = await catalog.checkpoint(
            work_refs=[work["artifact"] for work in works],
            pending_review_refs=[],
            questions=["Synthetic private review question"],
            conflicts=[],
        )
        authority.calls.clear()
        yield catalog, authority, artifacts, works, checkpoint, policy
    finally:
        await catalog.close()


def observe_snapshot(catalog):
    # Observe the real phase boundary; no snapshot contents or validation are stubbed.
    state = {"captured": False, "changed": False}
    snapshot = catalog._snapshot

    async def observed(*args, **kwargs):
        result = await snapshot(*args, **kwargs)
        state["captured"] = True
        return result

    catalog._snapshot = observed
    return state


@pytest.mark.asyncio
async def test_current_checkpoint_export_restores_without_extending_retention(tmp_path):
    async with short_checkpoint(tmp_path / "original") as values:
        catalog, authority, artifacts, works, checkpoint, policy = values
        exported = await catalog.export_state()
        bindings = len(artifacts) + sum(len(work["evidence"]) for work in works)
        assert len(authority.calls) == 3 * bindings
        assert {id for id, _ in authority.calls} == set(authority.evidence)
        assert exported["checkpoint"] == checkpoint
        assert datetime.fromisoformat(exported["expiresAt"]) == NOW + timedelta(seconds=30)
        restored = await ContextCatalog.open(
            (tmp_path / "restored").resolve(),
            SCOPE,
            PRINCIPAL,
            policy,
            grant_provider=authority.grant,
            source_authority=authority.source,
            clock=lambda: NOW,
        )
        try:
            await restored.restore_state(exported)
            again = await restored.export_state()
            assert again["checkpoint"]["questions"] == checkpoint["questions"]
            assert {entry["body"]["artifact"]["id"] for entry in again["records"]} == {
                entry["body"]["artifact"]["id"] for entry in exported["records"]
            }
            assert again["expiresAt"] == exported["expiresAt"]
            assert all(
                entry["body"]["review"]["status"] == "unreviewed"
                for entry in again["records"]
                if entry["kind"] == "working"
            )
        finally:
            await restored.close()


@pytest.mark.asyncio
@pytest.mark.parametrize("boundary", ["source", "final_grant"])
@pytest.mark.parametrize("change", ["expire", "supersede", "delete", "corrupt"])
async def test_captured_checkpoint_is_current_after_export_awaits(tmp_path, boundary, change):
    async with short_checkpoint(tmp_path / "private") as values:
        catalog, authority, artifacts, works, checkpoint, _ = values
        state = observe_snapshot(catalog)
        bindings = len(artifacts) + sum(len(work["evidence"]) for work in works)

        async def mutate():
            state["changed"] = True
            authority.on_source = None
            if change == "expire":
                catalog.clock = lambda: NOW + timedelta(seconds=40)
            elif change == "supersede":
                await catalog.checkpoint(
                    work_refs=checkpoint["workRefs"],
                    pending_review_refs=[],
                    questions=["A different current review question"],
                    conflicts=[],
                )
            elif change == "delete":
                await catalog.delete({"id": checkpoint["id"], "revision": checkpoint["revision"]})
            else:
                # Corruption injection is distinct from the public-method expiry,
                # revision and deletion cases and must not be hidden by phase reuse.
                catalog.db.execute(
                    "UPDATE records SET body=? WHERE namespace=? AND id=? AND revision=?",
                    (b"{}", catalog.namespace, checkpoint["id"], checkpoint["revision"]),
                )

        async def source_boundary(_):
            if state["captured"] and not state["changed"]:
                await mutate()

        async def grant_boundary(principal, scope, operation):
            if (
                operation == "export"
                and state["captured"]
                and not state["changed"]
                and len(authority.calls) == 3 * bindings
            ):
                await mutate()
            return await authority.grant(principal, scope, operation)

        if boundary == "source":
            authority.on_source = source_boundary
        else:
            catalog.grant_provider = grant_boundary
        reason = {
            "expire": "expired",
            "supersede": "revision_mismatch",
            "delete": "deleted|revision_mismatch",
            "corrupt": "integrity_failure",
        }[change]
        with pytest.raises(ContextError, match=reason):
            await catalog.export_state()
        assert state["changed"]


@pytest.mark.asyncio
async def test_already_invalidated_checkpoint_exports_only_permitted_projection(tmp_path):
    async with short_checkpoint(tmp_path / "private") as values:
        catalog, authority, artifacts, _, checkpoint, _ = values
        authority.revoked.add(artifacts[0]["evidence"]["id"])
        exported = await catalog.export_state()
        assert exported["checkpoint"]["invalidated"] is True
        assert exported["checkpoint"]["questions"] == []
        assert exported["checkpoint"]["workRefs"] == checkpoint["workRefs"]
        assert {entry["body"]["artifact"]["id"] for entry in exported["records"]} == {
            source["artifact"]["id"] for source in artifacts[1:]
        }
        assert datetime.fromisoformat(exported["expiresAt"]) > catalog.clock()


@pytest.mark.asyncio
async def test_export_does_not_rebind_captured_work_to_replaced_metadata(tmp_path):
    async with short_checkpoint(tmp_path / "private") as values:
        catalog, authority, _, works, _, _ = values
        state = observe_snapshot(catalog)
        work = copy.deepcopy(works[0])
        work["findings"][0]["value"] = 99
        encoded = rfc8785.dumps(work)

        async def replace_metadata(_):
            if state["captured"] and not state["changed"]:
                state["changed"] = True
                authority.on_source = None
                # The dependency walk can encounter this row before the captured
                # output selection does. Neither may silently rebind the other.
                catalog.db.execute(
                    "UPDATE records SET body=?,digest=? WHERE namespace=? AND id=? AND revision=?",
                    (
                        encoded,
                        hashlib.sha256(encoded).hexdigest(),
                        catalog.namespace,
                        work["artifact"]["id"],
                        work["artifact"]["revision"],
                    ),
                )

        authority.on_source = replace_metadata
        with pytest.raises(ContextError, match="revision_mismatch|integrity_failure"):
            await catalog.export_state()
        assert state["changed"]


@pytest.mark.asyncio
async def test_task_only_export_rechecks_expiry_after_final_grant(tmp_path):
    policy = copy.deepcopy(POLICY)
    policy["retention"]["seconds"] = 30
    authority = Authority([])
    catalog = await ContextCatalog.open(
        (tmp_path / "private").resolve(),
        SCOPE,
        PRINCIPAL,
        policy,
        grant_provider=authority.grant,
        source_authority=authority.source,
        clock=lambda: NOW,
    )
    try:
        task = json.loads((FIXTURES / "task.json").read_text())
        task.update(id=SCOPE["taskId"], scope=copy.deepcopy(SCOPE), inputs=[])
        await catalog.put_task(task)
        state = observe_snapshot(catalog)

        async def expire(principal, scope, operation):
            if operation == "export" and state["captured"]:
                state["changed"] = True
                catalog.clock = lambda: NOW + timedelta(seconds=40)
            return await authority.grant(principal, scope, operation)

        catalog.grant_provider = expire
        with pytest.raises(ContextError, match="expired"):
            await catalog.export_state()
        assert state["changed"] and not authority.calls
    finally:
        await catalog.close()
