"""Portable restoration preserves review references without restoring denied data."""

import copy
import json
from datetime import timedelta
from pathlib import Path

import pytest
from test_context import NOW, employee, policy

from shaleyeah_employee.context import ContextCatalog, ContextError, canonical

SOURCE = json.loads((Path(__file__).parent / "fixtures/source.json").read_text())


class Authority:
    def __init__(self, scope, principal, source):
        self.scope, self.principal, self.source = scope, principal, source
        self.allowed = True

    async def grant(self, *_):
        return {
            "subjectId": self.principal["subjectId"],
            "scope": self.scope,
            "policy": policy()["contextPolicy"],
            "operations": ["read", "write", "assemble", "export", "restore", "delete"],
            "revoked": False,
            "expiresAt": (NOW + timedelta(hours=1)).isoformat(),
        }

    async def source_access(self, *_):
        return {
            "subjectId": self.principal["subjectId"],
            "scope": self.scope,
            "allowed": self.allowed,
            "operations": ["read", "export"],
            "evidence": self.source["evidence"],
            "retentionExpiresAt": (NOW + timedelta(hours=1)).isoformat(),
        }


async def seeded(root):
    scope, principal, task = employee("reporter")
    source = copy.deepcopy(SOURCE)
    source.update(scope=scope, taskRevision=task["revision"], retrievedAt=NOW.isoformat())
    source["evidence"]["asOf"] = NOW.isoformat()
    task["inputs"] = [source["artifact"]]
    work = {
        "contractVersion": "0.1.0",
        "kind": "work-product",
        "scope": scope,
        "taskRevision": task["revision"],
        "artifact": {"id": "work.reporter", "revision": "r1", "uri": "urn:example:reporter:draft"},
        "status": "draft",
        "inputs": task["inputs"],
        "evidence": [source["evidence"]],
        "findings": [],
        "assumptions": [],
        "uncertainty": "Fixture draft awaits review",
        "confidence": 0,
        "blockers": [],
        "review": {"status": "unreviewed", "decisionRefs": []},
    }
    authority = Authority(scope, principal, source)
    catalog = await opened(root, authority)
    await catalog.put_task(task)
    await catalog.put_source(source)
    await catalog.put_work(work)
    await catalog.checkpoint(
        work_refs=[work["artifact"]],
        pending_review_refs=[{"id": "review.pending", "revision": "r1"}],
        questions=["Private unresolved observation"],
        conflicts=[],
    )
    return catalog, authority, work


async def opened(root, authority):
    return await ContextCatalog.open(
        root,
        authority.scope,
        authority.principal,
        policy(),
        grant_provider=authority.grant,
        source_authority=authority.source_access,
        clock=lambda: NOW,
    )


@pytest.mark.asyncio
async def test_export_restore_does_not_resurrect_newly_denied_data(tmp_path):
    original, authority, work = await seeded(tmp_path / "original")
    exported = await original.export_state()
    await original.close()
    authority.allowed = False
    restored = await opened(tmp_path / "restored", authority)
    try:
        await restored.restore_state(exported)
        checkpoint = await restored.current_checkpoint()
        assert checkpoint["pendingReviewRefs"] == [{"id": "review.pending", "revision": "r1"}]
        assert checkpoint["questions"] == []
        with pytest.raises(ContextError, match="missing_input"):
            await restored.authorize_history([work["artifact"]])
        authority.allowed = True
        with pytest.raises(ContextError, match="missing_input"):
            await restored.authorize_history([work["artifact"]])
    finally:
        await restored.close()


@pytest.mark.asyncio
async def test_restored_content_keeps_original_retention_and_zero_confidence(tmp_path):
    original, authority, work = await seeded(tmp_path / "original")
    exported = await original.export_state()
    await original.close()
    restored = await opened(tmp_path / "restored", authority)
    try:
        await restored.restore_state(exported)
        await restored.authorize_history([work["artifact"]])
        again = await restored.export_state()
        restored_work = next(item["body"] for item in again["records"] if item["kind"] == "working")
        assert restored_work["confidence"] == 0
        assert again["expiresAt"] == exported["expiresAt"]
        assert canonical(restored_work) == canonical(work)
    finally:
        await restored.close()
