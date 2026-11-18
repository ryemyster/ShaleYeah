import hashlib
import json
from datetime import UTC, datetime, timedelta
from secrets import token_urlsafe

import httpx
import httpx2
import pytest
from shaleyeah_employee.context import ContextCatalog, ContextError
from shaleyeah_employee.models import native_adapter, parse_reference_config
from shaleyeah_mcp import MCPClientConfig


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "sources",
    [
        "not-a-source-list",
        [{}],
        [
            {"artifact": {"id": "evidence.register", "revision": "r1"}},
            {"artifact": {"id": "evidence.register", "revision": "r1"}},
        ],
    ],
)
async def test_invalid_or_duplicate_source_identities_cannot_enter_retained_context(sources):
    from app.context_runtime import RiskAnalystRuntime

    class Catalog:
        async def put_source(self, *args, **kwargs):
            raise AssertionError("Malformed source metadata must be rejected before retention")

    runtime = RiskAnalystRuntime()
    runtime.catalog = Catalog()
    with pytest.raises(ContextError):
        await runtime.after_tool(
            None,
            {},
            None,
            {"structuredContent": {"success": True, "analysis": {"sourceArtifacts": sources}}},
        )


@pytest.mark.asyncio
async def test_role_context_retains_every_successful_source_and_no_failed_tool_output():
    from app.context_runtime import RiskAnalystRuntime

    stored = []

    class Catalog:
        def _head(self, artifact_id):
            return None

        async def put_source(self, source, *, expected):
            assert expected is None
            stored.append(source)

    runtime = RiskAnalystRuntime()
    runtime.catalog = Catalog()
    sources = [
        {"artifact": {"id": "evidence.risk-register", "revision": "r1"}},
        {"artifact": {"id": "evidence.risk-policy", "revision": "r2"}},
    ]
    await runtime.after_tool(
        None,
        {},
        None,
        {"structuredContent": {"success": True, "analysis": {"sourceArtifacts": sources}}},
    )
    assert stored == sources
    await runtime.after_tool(
        None,
        {},
        None,
        {
            "isError": True,
            "structuredContent": {"success": False, "analysis": {"sourceArtifacts": sources}},
        },
    )
    assert stored == sources


@pytest.mark.asyncio
@pytest.mark.parametrize("provider", ["gemini", "anthropic"])
async def test_native_risk_analyst_keeps_own_review_context_across_restart_and_revocation(
    tmp_path, provider
):
    from app.context_runtime import RiskAnalystRuntime

    now = datetime.now(UTC)
    timestamp = now.isoformat(timespec="milliseconds")
    expiry = (now + timedelta(hours=1)).isoformat(timespec="milliseconds")
    scope = {
        "customerId": "operator-fixture",
        "assetId": "asset-fixture",
        "taskId": "task.risk_analyst",
        "employeeId": "employee.risk_analyst",
    }
    principal = {
        "subjectId": "risk_analyst-run",
        "customerId": scope["customerId"],
        "employeeId": scope["employeeId"],
    }
    encoded = b'{"residualLoss":100,"currency":"USD","basis":"synthetic-assumption"}'
    digest = hashlib.sha256(encoded).hexdigest()
    evidence = {
        "id": "evidence.risk-register",
        "revision": "r1",
        "uri": "urn:fixture:risk_analyst-input",
        "hash": {"algorithm": "sha256", "value": digest},
        "asOf": timestamp,
        "accessClassification": "restricted",
        "usagePolicy": {"id": "policy.operator-data", "version": "r1"},
    }
    source = {
        "contractVersion": "0.2.0",
        "kind": "source-artifact",
        "scope": scope,
        "taskRevision": "r1",
        "connectorRef": {"id": "connector.operator", "revision": "r1"},
        "adapterRef": {"id": "operator-file", "version": "0.1.0"},
        "sourceKind": "operator-file",
        "evidence": evidence,
        "artifact": {"id": evidence["id"], "revision": digest, "uri": "urn:sha256:" + digest},
        "retrievedAt": timestamp,
        "format": "json",
        "parserRef": {"id": "json-shape", "version": "0.1.0"},
        "jurisdiction": "US-TX",
        "units": [{"field": "residualLoss", "unit": "USD", "origin": "operator-declared"}],
        "byteLength": len(encoded),
        "accessNotes": "Operator-only synthetic input",
        "licenseNotes": "Synthetic fixture; no vendor data",
        "revisionOrigin": "operator-declared",
    }
    task = {
        "contractVersion": "0.1.0",
        "kind": "task-assignment",
        "id": scope["taskId"],
        "revision": "r1",
        "scope": scope,
        "outcome": "Compare explicit source-linked risk scenarios",
        "requiredCapabilities": ["risk.scenario"],
        "inputs": [source["artifact"]],
        "constraints": ["Human owns risk assumptions and capital decisions"],
        "status": "assigned",
        "workProductRefs": [],
        "reviewDecisionRefs": [],
    }
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
            "expiresAt": expiry,
        }

    async def source_authority(actual, who, requested, operation):
        assert actual == evidence and who == principal and requested == scope
        return {
            "subjectId": principal["subjectId"],
            "scope": scope,
            "allowed": not revoked,
            "operations": ["read", "export"],
            "evidence": evidence,
            "retentionExpiresAt": expiry,
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

    owner = {key: scope[key] for key in ("customerId", "employeeId")}

    def profile(purpose):
        return {
            "version": "0.1.0",
            "id": "risk_analyst-" + purpose,
            "revision": "r1",
            "purpose": purpose,
            "owner": owner,
            "provider": provider,
            "model": "gemini-fixture-001" if provider == "gemini" else "claude-fixture-001",
            "modelRevision": "fixture-001",
            "endpoint": "https://generativelanguage.googleapis.com"
            if provider == "gemini"
            else "https://api.anthropic.com",
            "credentialRef": "secret:risk_analyst-" + purpose,
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
            **{purpose: profile(purpose) for purpose in ("agent", "synthesis", "judge")},
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
        requests.append(json.loads(request.content))
        if "count" in request.url.path.lower():
            response = {"totalTokens": 400} if provider == "gemini" else {"input_tokens": 400}
        elif provider == "gemini":
            response = {
                "candidates": [
                    {
                        "content": {
                            "role": "model",
                            "parts": [{"text": "Fixture scenario requires human review"}],
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
                "content": [{"type": "text", "text": "Fixture scenario requires human review"}],
                "stop_reason": "end_turn",
                "usage": {"input_tokens": 400, "output_tokens": 8},
            }
        return (httpx if provider == "gemini" else httpx2).Response(200, json=response)

    options = {
        "backend_config": MCPClientConfig(
            endpoint="https://external-risk.invalid/mcp", credential=credential
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
        work_refs=[], pending_review_refs=[], questions=["Confirm operating basis"], conflicts=[]
    )
    runtime = await RiskAnalystRuntime.open(catalog, config, **options)
    try:
        first = await runtime.run("First private risk task")
        assert first["status"] == "ready" and first["events"]
        work = {
            "contractVersion": "0.1.0",
            "kind": "work-product",
            "scope": scope,
            "taskRevision": "r1",
            "artifact": {
                "id": "work.eco",
                "revision": "r1",
                "uri": "urn:fixture:risk_analyst-work",
            },
            "status": "ready_for_review",
            "inputs": task["inputs"],
            "evidence": [evidence],
            "findings": [
                {
                    "id": "finding.initial-rate",
                    "basis": "measured",
                    "value": 100,
                    "unit": "USD",
                    "evidenceIds": [evidence["id"]],
                    "assumptionIds": [],
                }
            ],
            "assumptions": [],
            "uncertainty": "Human scenario review required",
            "blockers": [],
            "review": {"status": "unreviewed", "decisionRefs": []},
        }
        manifest = await runtime.review_context(work)
        assert manifest["workingArtifactRefs"] == [work["artifact"]]
        assert manifest["selectedEvidence"] == [evidence]
        await runtime.record_review({"reviewId": "review.eco.pending", "state": "awaiting-review"})
        with pytest.raises(ContextError, match="invalid_review_checkpoint"):
            await runtime.record_review(
                {"reviewId": "review.eco.pending", "state": "approved", "grantId": "forged"}
            )
    finally:
        await runtime.close()
    runtime = await RiskAnalystRuntime.open(await opened(), config, **options)
    try:
        assert (await runtime.catalog.current_checkpoint())["pendingReviewRefs"] == [
            {"id": "review.eco.pending", "revision": "r1"}
        ]
        second = await runtime.run("Continue risk review after restart")
        assert second["status"] == "ready"
        assert "First private risk task" not in json.dumps(requests[-1])
        assert set(resolutions) == {"agent"}
        assert runtime.agent.model._profile["owner"] == owner
        revoked = True
        third = await runtime.run("Continue with revoked grant")
        assert third["status"] == "blocked" and third["code"] == "access_denied"
    finally:
        await runtime.close()
