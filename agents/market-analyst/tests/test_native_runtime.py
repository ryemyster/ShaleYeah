"""Native ADK context plumbing; offline provider responses test code boundaries, not price quality."""

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
        "invalid",
        [{}],
        [
            {"artifact": {"id": "series", "revision": "r1"}},
            {"artifact": {"id": "series", "revision": "r1"}},
        ],
        [{"artifact": {}}],
        [{"artifact": {"id": "series"}}],
        [
            {"artifact": {"id": "series", "revision": "r1"}},
            {"artifact": {"id": "series", "revision": "r2"}},
        ],
    ],
    ids=[
        "not-list",
        "missing-ref",
        "duplicate-ref",
        "empty-ref",
        "missing-revision",
        "duplicate-source",
    ],
)
async def test_invalid_source_inventory_never_enters_retained_context(sources):
    from app.context_runtime import MarketAnalystRuntime

    class Catalog:
        async def put_source(self, *args, **kwargs):
            raise AssertionError("Invalid inventory cannot be retained")

    runtime = MarketAnalystRuntime()
    runtime.catalog = Catalog()
    with pytest.raises(ContextError):
        await runtime.after_tool(
            None,
            {},
            None,
            {"structuredContent": {"success": True, "analysis": {"sourceArtifacts": sources}}},
        )


@pytest.mark.asyncio
async def test_role_callback_retains_every_successful_source_and_ignores_failed_calls():
    from app.context_runtime import MarketAnalystRuntime

    stored = []

    class Catalog:
        def _head(self, artifact_id):
            return None

        async def put_source(self, source, *, expected):
            assert expected is None
            stored.append(source)

    runtime = MarketAnalystRuntime()
    runtime.catalog = Catalog()
    sources = [
        {"artifact": {"id": "evidence." + name, "revision": "r1"}}
        for name in ("mandate", "series", "assumptions")
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
async def test_market_private_context_survives_restart_and_revalidates_source_rights(
    tmp_path, provider
):
    from app.context_runtime import MarketAnalystRuntime

    timestamp = datetime.now(UTC).isoformat(timespec="milliseconds")
    expiry = (datetime.now(UTC) + timedelta(hours=1)).isoformat(timespec="milliseconds")
    scope = {
        "customerId": "operator-fixture",
        "assetId": "asset-fixture",
        "taskId": "task.market",
        "employeeId": "employee.market-analyst",
    }
    principal = {
        "subjectId": "market-run",
        **{key: scope[key] for key in ("customerId", "employeeId")},
    }
    raw = b'{"commodity":"gas","region":"Appalachia","period":"2026-11"}'
    digest = hashlib.sha256(raw).hexdigest()
    evidence = {
        "id": "evidence.series",
        "revision": "r1",
        "uri": "urn:fixture:market-input",
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
        "parserRef": {"id": "json", "version": "1"},
        "jurisdiction": "US",
        "units": [],
        "byteLength": len(raw),
        "accessNotes": "Operator-only synthetic context input",
        "licenseNotes": "Synthetic fixture; no vendor data",
        "revisionOrigin": "operator-declared",
    }
    task = {
        "contractVersion": "0.1.0",
        "kind": "task-assignment",
        "id": scope["taskId"],
        "revision": "r1",
        "scope": scope,
        "outcome": "Prepare dated private commercial scenarios",
        "requiredCapabilities": ["market.scenario"],
        "inputs": [source["artifact"]],
        "constraints": ["No trading, contract, bid or capital authority"],
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
            "id": "market-" + purpose,
            "revision": "r1",
            "purpose": purpose,
            "owner": owner,
            "provider": provider,
            "model": "gemini-fixture-001" if provider == "gemini" else "claude-fixture-001",
            "modelRevision": "fixture-001",
            "endpoint": "https://generativelanguage.googleapis.com"
            if provider == "gemini"
            else "https://api.anthropic.com",
            "credentialRef": "secret:market-" + purpose,
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

    package = httpx if provider == "gemini" else httpx2

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
                            "parts": [{"text": '{"deferred":"Pending commercial review"}'}],
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
                "content": [{"type": "text", "text": '{"deferred":"Pending commercial review"}'}],
                "stop_reason": "end_turn",
                "usage": {"input_tokens": 400, "output_tokens": 8},
            }
        return package.Response(200, json=response)

    options = {
        "backend_config": MCPClientConfig(
            endpoint="https://external-market.invalid/mcp", credential=credential
        ),
        "resolve_credential": resolve,
        "adapter_factory": lambda profile, key: native_adapter(
            profile, key, transport=package.MockTransport(respond)
        ),
    }
    catalog = await opened()
    await catalog.put_task(task)
    await catalog.put_source(source)
    await catalog.checkpoint(
        work_refs=[], pending_review_refs=[], questions=["Confirm commercial basis"], conflicts=[]
    )
    runtime = await MarketAnalystRuntime.open(catalog, config, **options)
    try:
        first = await runtime.run("First private market request")
        assert first["status"] == "ready" and first["events"]
        work = {
            "contractVersion": "0.1.0",
            "kind": "work-product",
            "scope": scope,
            "taskRevision": "r1",
            "artifact": {"id": "work.market", "revision": "r1", "uri": "urn:fixture:market-work"},
            "status": "ready_for_review",
            "inputs": task["inputs"],
            "evidence": [evidence],
            "findings": [
                {
                    "id": "finding.scenario",
                    "basis": "assumed",
                    "value": 3.8,
                    "unit": "USD/MMBtu",
                    "evidenceIds": [evidence["id"]],
                    "assumptionIds": ["assumption.commercial"],
                }
            ],
            "assumptions": [
                {
                    "id": "assumption.commercial",
                    "statement": "Operator supplies commercial scenarios for separate human review",
                    "evidenceIds": [evidence["id"]],
                }
            ],
            "uncertainty": "Commercial owner review required",
            "blockers": [],
            "review": {"status": "unreviewed", "decisionRefs": []},
        }
        manifest = await runtime.review_context(work)
        assert manifest["workingArtifactRefs"] == [work["artifact"]]
        assert manifest["selectedEvidence"] == [evidence]
        await runtime.record_review(
            {"reviewId": "review.market.pending", "state": "awaiting-review"}
        )
        with pytest.raises(ContextError, match="invalid_review_checkpoint"):
            await runtime.record_review(
                {"reviewId": "review.market.pending", "state": "approved", "grantId": "forged"}
            )
    finally:
        await runtime.close()
    runtime = await MarketAnalystRuntime.open(await opened(), config, **options)
    try:
        assert (await runtime.catalog.current_checkpoint())["pendingReviewRefs"] == [
            {"id": "review.market.pending", "revision": "r1"}
        ]
        assert (await runtime.run("Continue market review after restart"))["status"] == "ready"
        assert "First private market request" not in json.dumps(requests[-1])
        assert key not in json.dumps(requests[-1]) and token not in json.dumps(requests[-1])
        assert set(resolutions) == {"agent"}
        revoked = True
        prior_requests = len(requests)
        blocked = await runtime.run("Continue with revoked source rights")
        assert blocked["status"] == "blocked" and blocked["code"] == "access_denied"
        assert len(requests) == prior_requests
    finally:
        await runtime.close()
