import base64
import hashlib
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from secrets import token_urlsafe

import httpx
import httpx2
import pytest
from shaleyeah_employee.context import ContextCatalog, ContextError
from shaleyeah_employee.models import native_adapter, parse_reference_config
from shaleyeah_mcp import MCPClientConfig

from app.context_runtime import QARuntime


@pytest.mark.asyncio
@pytest.mark.parametrize("provider", ["gemini", "anthropic"])
async def test_actual_role_runtime_keeps_own_context_and_credentials_across_restart(
    tmp_path, provider
):
    records = json.loads((Path(__file__).parent / "eval/fixtures/employee.json").read_text())
    task = records["task"]
    task["scope"]["employeeId"] = "employee.qa"
    task["requiredCapabilities"] = ["qa.check"]
    scope = task["scope"]
    principal = {
        "subjectId": "qa-run",
        "customerId": scope["customerId"],
        "employeeId": scope["employeeId"],
    }
    now = datetime.now(UTC)
    fixture = json.loads(
        (Path(__file__).parent / "eval/fixtures/observed-reports.json").read_text()
    )["failure"]
    source = fixture["sourceArtifacts"][0]
    source.update(scope=scope, taskRevision=task["revision"])
    body = json.loads(base64.b64decode(fixture["sourceBytesBase64"]))
    body["rows"][0]["asOf"] = now.isoformat(timespec="milliseconds")
    encoded = json.dumps(body).encode()
    digest = hashlib.sha256(encoded).hexdigest()
    source["evidence"].update(
        asOf=now.isoformat(timespec="milliseconds"),
        revision=digest,
        uri="urn:sha256:" + digest,
        hash={"algorithm": "sha256", "value": digest},
    )
    source.update(
        artifact={
            "id": source["evidence"]["id"],
            "revision": digest,
            "uri": "urn:sha256:" + digest,
        },
        retrievedAt=now.isoformat(timespec="milliseconds"),
        byteLength=len(encoded),
    )
    task["inputs"] = [source["artifact"]]
    policy = {
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
    revoked = False

    async def grant(who, requested, operation):
        assert who == principal and requested == scope
        return {
            "subjectId": principal["subjectId"],
            "scope": scope,
            "policy": policy["contextPolicy"],
            "operations": ["read", "write", "assemble", "delete", "export"],
            "revoked": revoked,
            "expiresAt": (now + timedelta(hours=1)).isoformat(),
        }

    async def source_authority(evidence, who, requested, operation):
        assert evidence == source["evidence"] and who == principal and requested == scope
        return {
            "subjectId": principal["subjectId"],
            "scope": scope,
            "allowed": not revoked,
            "operations": ["read", "export"],
            "evidence": source["evidence"],
            "retentionExpiresAt": (now + timedelta(hours=1)).isoformat(),
        }

    async def opened():
        return await ContextCatalog.open(
            tmp_path / "context",
            scope,
            principal,
            policy,
            grant_provider=grant,
            source_authority=source_authority,
        )

    owner = {"customerId": scope["customerId"], "employeeId": scope["employeeId"]}

    def model(purpose):
        return {
            "version": "0.1.0",
            "id": "qa-" + purpose,
            "revision": "r1",
            "purpose": purpose,
            "owner": owner,
            "provider": provider,
            "model": "gemini-fixture-001" if provider == "gemini" else "claude-fixture-001",
            "modelRevision": "fixture-001",
            "endpoint": "https://generativelanguage.googleapis.com"
            if provider == "gemini"
            else "https://api.anthropic.com",
            "credentialRef": "secret:qa-" + purpose,
            "capabilities": {"toolUse": True, "structuredOutput": True},
            "limits": {
                "timeoutMs": 30000,
                "maxAttempts": 1,
                "maxOutputTokens": 512,
                "maxRequests": 4,
                "maxInputChars": 262144,
            },
        }

    config = parse_reference_config(
        {
            "version": "0.1.0",
            "agent": model("agent"),
            "synthesis": model("synthesis"),
            "judge": model("judge"),
        }
    )
    key, token = token_urlsafe(32), token_urlsafe(32)
    resolutions, requests = [], []

    async def resolve(requested_owner, reference, purpose):
        assert requested_owner == owner and purpose == "agent"
        resolutions.append(purpose)
        return key

    async def credential():
        return token

    async def respond(request):
        assert request.headers["x-goog-api-key" if provider == "gemini" else "x-api-key"] == key
        body = json.loads(request.content)
        requests.append(body)
        if "count" in request.url.path.lower():
            response = {"totalTokens": 400} if provider == "gemini" else {"input_tokens": 400}
        elif provider == "gemini":
            response = {
                "candidates": [
                    {
                        "content": {
                            "role": "model",
                            "parts": [
                                {
                                    "text": "Observed QA failures remain unchanged; human disposition review required"
                                }
                            ],
                        },
                        "finishReason": "STOP",
                    }
                ]
            }
        else:
            response = {
                "id": "msg.fixture",
                "type": "message",
                "role": "assistant",
                "model": config.agent["model"],
                "content": [
                    {
                        "type": "text",
                        "text": "Observed QA failures remain unchanged; human disposition review required",
                    }
                ],
                "stop_reason": "end_turn",
                "usage": {"input_tokens": 400, "output_tokens": 12},
            }
        return (httpx if provider == "gemini" else httpx2).Response(200, json=response)

    options = {
        "backend_config": MCPClientConfig(
            endpoint="https://external-reporting.invalid/mcp", credential=credential
        ),
        "resolve_credential": resolve,
        "adapter_factory": lambda profile, key: native_adapter(
            profile,
            key,
            transport=(httpx if provider == "gemini" else httpx2).MockTransport(respond),
        ),
    }
    catalog = await opened()
    await catalog.put_task(task)
    await catalog.put_source(source)
    await catalog.checkpoint(
        work_refs=[],
        pending_review_refs=[],
        questions=["Confirm rule profile and repair owner"],
        conflicts=[],
    )
    runtime = await QARuntime.open(catalog, config, **options)
    first = await runtime.run("First observed QA task")
    assert first["status"] == "ready"
    assert first["events"]
    work = fixture["report"]["work"]
    work.update(
        scope=scope,
        taskRevision=task["revision"],
        inputs=task["inputs"],
        evidence=[source["evidence"]],
        blockers=[],
        status="ready_for_review",
        review={"status": "unreviewed", "decisionRefs": []},
    )
    manifest = await runtime.review_context(work)
    assert manifest["workingArtifactRefs"] == [work["artifact"]]
    assert manifest["selectedEvidence"] == work["evidence"]
    await runtime.record_review({"reviewId": "review.qa.pending", "state": "awaiting-review"})
    assert (await runtime.catalog.current_checkpoint())["pendingReviewRefs"] == [
        {"id": "review.qa.pending", "revision": "r1"}
    ]
    with pytest.raises(ContextError, match="invalid_review_checkpoint"):
        await runtime.record_review(
            {"reviewId": "review.qa.pending", "state": "approved", "grantId": "forged"}
        )
    await runtime.close()
    catalog = await opened()
    runtime = await QARuntime.open(catalog, config, **options)
    try:
        second = await runtime.run("Continue defect review after restart")
        assert second["status"] == "ready"
        assert "First observed QA task" not in json.dumps(requests[-1])
        assert set(resolutions) == {"agent"}
        assert runtime.agent.model._profile["owner"] == owner
        revoked = True
        third = await runtime.run("Continue with revoked grant")
        assert third["status"] == "blocked" and third["code"] == "access_denied"
    finally:
        await runtime.close()
