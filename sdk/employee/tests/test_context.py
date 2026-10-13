"""The same installed helper must isolate and restore distinct employee contexts."""

import copy
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from shaleyeah_employee.context import ContextCatalog, ContextError

NOW = datetime(2026, 10, 13, tzinfo=UTC)
TASK = json.loads((Path(__file__).parent / "fixtures/task.json").read_text())


def policy():
    return {
        "version": "0.1.0",
        "contextPolicy": {"id": "policy.employee-context", "version": "r1"},
        "budget": {"maxItems": 16, "maxBytes": 65536, "maxTokens": 16000},
        "reservedTokens": 1024,
        "maxCountCalls": 20,
        "maxRecords": 100,
        "maxRecordBytes": 65536,
        "maxSourceAgeSeconds": 86400,
        "retention": {"policy": {"id": "policy.retention", "version": "r1"}, "seconds": 3600},
        "ranking": {"id": "lexical", "version": "1"},
    }


def employee(role):
    scope = {
        "customerId": "operator-demo",
        "assetId": "asset.demo",
        "taskId": "task." + role,
        "employeeId": role,
    }
    principal = {"subjectId": "operator", "customerId": scope["customerId"], "employeeId": role}
    task = copy.deepcopy(TASK)
    task.update(
        id=scope["taskId"],
        scope=scope,
        inputs=[],
        outcome="Retain " + role + " context until review",
        requiredCapabilities=["reporting.draft" if role == "reporter" else "geology.interpret"],
    )
    return scope, principal, task


async def no_source(*_):
    raise AssertionError("This task-only control must not read a source")


@pytest.mark.asyncio
async def test_distinct_employees_restore_only_their_own_checkpoint(tmp_path):
    for role in ("reporter", "geologist"):
        scope, principal, task = employee(role)

        async def grant(who, requested, operation, scope=scope, principal=principal):
            assert who == principal and requested == scope
            return {
                "subjectId": principal["subjectId"],
                "scope": scope,
                "policy": policy()["contextPolicy"],
                "operations": ["read", "write", "assemble", "delete"],
                "revoked": False,
                "expiresAt": (NOW + timedelta(hours=1)).isoformat(),
            }

        catalog = await ContextCatalog.open(
            tmp_path / "private",
            scope,
            principal,
            policy(),
            grant_provider=grant,
            source_authority=no_source,
            clock=lambda: NOW,
        )
        await catalog.put_task(task)
        await catalog.checkpoint(
            work_refs=[],
            pending_review_refs=[],
            questions=[role + " awaits review"],
            conflicts=[],
        )
        await catalog.close()

    for role in ("reporter", "geologist"):
        scope, principal, _ = employee(role)

        async def grant(who, requested, operation, scope=scope, principal=principal):
            assert who == principal and requested == scope
            return {
                "subjectId": principal["subjectId"],
                "scope": scope,
                "policy": policy()["contextPolicy"],
                "operations": ["read", "write", "assemble", "delete"],
                "revoked": False,
                "expiresAt": (NOW + timedelta(hours=1)).isoformat(),
            }

        catalog = await ContextCatalog.open(
            tmp_path / "private",
            scope,
            principal,
            policy(),
            grant_provider=grant,
            source_authority=no_source,
            clock=lambda: NOW,
        )
        try:
            checkpoint = await catalog.current_checkpoint()
            assert checkpoint["questions"] == [role + " awaits review"]
            assert checkpoint["scope"] == scope
        finally:
            await catalog.close()


@pytest.mark.asyncio
async def test_revoked_authority_blocks_reopening_existing_context(tmp_path):
    scope, principal, task = employee("reporter")
    revoked = False

    async def grant(*_):
        return {
            "subjectId": principal["subjectId"],
            "scope": scope,
            "policy": policy()["contextPolicy"],
            "operations": ["read", "write"],
            "revoked": revoked,
            "expiresAt": (NOW + timedelta(hours=1)).isoformat(),
        }

    catalog = await ContextCatalog.open(
        tmp_path / "private",
        scope,
        principal,
        policy(),
        grant_provider=grant,
        source_authority=no_source,
        clock=lambda: NOW,
    )
    await catalog.put_task(task)
    await catalog.close()
    revoked = True
    with pytest.raises(ContextError, match="access_denied"):
        await ContextCatalog.open(
            tmp_path / "private",
            scope,
            principal,
            policy(),
            grant_provider=grant,
            source_authority=no_source,
            clock=lambda: NOW,
        )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "changes,code",
    [
        ({"extra": "unrecognized"}, "invalid_configuration"),
        ({"ranking": {"id": "unregistered", "version": "1"}}, "unsupported_version"),
        ({"budget": []}, "invalid_configuration"),
        ({"maxRecords": False}, "invalid_configuration"),
        ({"maxSourceAgeSeconds": 0}, "invalid_configuration"),
        ({"retention": {}}, "invalid_configuration"),
        (
            {"retention": {"policy": {"id": "policy.retention", "version": "r1"}, "seconds": 0}},
            "invalid_configuration",
        ),
        ({"contextPolicy": {"id": "policy.context"}}, "invalid_configuration"),
    ],
)
async def test_invalid_operator_policy_never_opens_state_or_requests_authority(
    tmp_path, changes, code
):
    scope, principal, _ = employee("reporter")
    configuration = policy()
    configuration.update(changes)

    async def unexpected(*_):
        raise AssertionError("Invalid settings must fail before authority lookup")

    with pytest.raises(ContextError, match=code):
        await ContextCatalog.open(
            tmp_path / "private",
            scope,
            principal,
            configuration,
            grant_provider=unexpected,
            source_authority=unexpected,
            clock=lambda: NOW,
        )
    assert not (tmp_path / "private").exists()


@pytest.mark.asyncio
async def test_authority_outage_is_a_safe_error_and_never_opens_state(tmp_path):
    scope, principal, _ = employee("reporter")

    async def unavailable(*_):
        raise RuntimeError("private-authority-error-sentinel")

    with pytest.raises(ContextError, match="authority_unavailable") as error:
        await ContextCatalog.open(
            tmp_path / "private",
            scope,
            principal,
            policy(),
            grant_provider=unavailable,
            source_authority=no_source,
            clock=lambda: NOW,
        )
    assert "private-authority-error-sentinel" not in str(error.value)
    assert not (tmp_path / "private").exists()
