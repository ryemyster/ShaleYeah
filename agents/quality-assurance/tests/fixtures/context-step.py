"""Actual protected QA service and native providers; model responses alone are offline fixtures."""

import asyncio
import json
import os
import sys
from pathlib import Path
from secrets import token_urlsafe

import httpx
import httpx2
from shaleyeah_employee.context import ContextCatalog
from shaleyeah_employee.models import native_adapter, parse_reference_config
from shaleyeah_mcp import FileBearerCredential, MCPClientConfig, call_tool

from app.context_runtime import QARuntime


async def main():
    input_file, output_file, endpoint = sys.argv[1:]
    settings = json.loads(Path(input_file).read_text())
    backend = MCPClientConfig(
        endpoint=endpoint,
        credential=FileBearerCredential(Path(settings["tokenFile"])),
        allow_loopback_http=True,
    )
    task, candidate = settings["task"], settings["candidate"]
    work, scope = candidate["work"], task["scope"]
    principal = {
        "subjectId": settings["subjectId"],
        "customerId": scope["customerId"],
        "employeeId": scope["employeeId"],
    }
    policy = {
        "version": "0.1.0",
        "contextPolicy": settings["contextPolicy"],
        "budget": {"maxItems": 16, "maxBytes": 131072, "maxTokens": 16000},
        "reservedTokens": 1024,
        "maxCountCalls": 20,
        "maxRecords": 100,
        "maxRecordBytes": 65536,
        "maxSourceAgeSeconds": 31536000,
        "retention": {"policy": settings["retentionPolicy"], "seconds": 3600},
        "ranking": {"id": "lexical", "version": "1"},
    }

    async def grant(who, requested, operation):
        assert who == principal and requested == scope
        return {
            "subjectId": principal["subjectId"],
            "scope": scope,
            "policy": policy["contextPolicy"],
            "operations": ["read", "write", "assemble", "export", "delete"],
            "revoked": False,
            "expiresAt": settings["expiresAt"],
        }

    async def source_authority(evidence, who, requested, operation):
        assert who == principal and requested == scope
        result = await call_tool(
            backend,
            "get_context_source_metadata",
            {"evidenceId": evidence["id"], "operation": operation},
        )
        assert result["isError"] is False
        return result["structuredContent"]["analysis"]

    provider = settings["provider"]
    package = httpx if provider == "gemini" else httpx2
    owner = {key: scope[key] for key in ("customerId", "employeeId")}

    def profile(purpose):
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

    models = parse_reference_config(
        {
            "version": "0.1.0",
            "agent": profile("agent"),
            "synthesis": profile("synthesis"),
            "judge": profile("judge"),
        }
    )
    key, requests, purposes, generations = token_urlsafe(32), [], [], 0

    async def resolve(actual_owner, reference, purpose):
        assert actual_owner == owner and purpose == "agent"
        purposes.append(purpose)
        return key

    async def respond(request):
        nonlocal generations
        assert request.headers["x-goog-api-key" if provider == "gemini" else "x-api-key"] == key
        requests.append(json.loads(request.content))
        if "count" in request.url.path.lower():
            response = {"totalTokens": 400} if provider == "gemini" else {"input_tokens": 400}
        else:
            generations += 1
            tool = generations in ({1, 3} if settings.get("mode") == "resume" else {1, 2, 3, 5})
            name = "read_quality_report"
            args = {
                "result_id": settings["resultRef"]["id"],
                "result_revision": settings["resultRef"]["revision"],
            }
            if generations == 2 and settings.get("mode") != "resume":
                name = "draft_disposition"
                proposal = candidate["disposition"]["proposal"]
                args.update(
                    action=proposal["action"],
                    reason=proposal["reason"],
                    repair_owner=proposal["repairOwner"],
                    expires_at=proposal["expiresAt"],
                    work_revision=work["artifact"]["revision"],
                )
            elif generations == 3 and settings.get("mode") != "resume":
                name = "prepare_disposition_review"
                args = {
                    "candidate_json": json.dumps(
                        {key: candidate[key] for key in ("work", "disposition", "evaluations")}
                    ),
                    "expected_head": settings.get("expectedHead"),
                }
            if provider == "gemini":
                part = (
                    {"functionCall": {"name": name, "args": args}}
                    if tool
                    else {"text": "Observed FAIL retained; owner disposition review required"}
                )
                response = {
                    "candidates": [
                        {"content": {"role": "model", "parts": [part]}, "finishReason": "STOP"}
                    ]
                }
            else:
                part = (
                    {
                        "type": "tool_use",
                        "id": "call.qa." + str(generations),
                        "name": name,
                        "input": args,
                    }
                    if tool
                    else {
                        "type": "text",
                        "text": "Observed FAIL retained; owner disposition review required",
                    }
                )
                response = {
                    "id": "msg.qa",
                    "type": "message",
                    "role": "assistant",
                    "model": models.agent["model"],
                    "content": [part],
                    "stop_reason": "tool_use" if tool else "end_turn",
                    "usage": {"input_tokens": 400, "output_tokens": 12},
                }
        return package.Response(200, json=response)

    async def opened():
        return await ContextCatalog.open(
            Path(settings["contextDirectory"]).resolve(),
            scope,
            principal,
            policy,
            grant_provider=grant,
            source_authority=source_authority,
        )

    options = {
        "backend_config": backend,
        "resolve_credential": resolve,
        "adapter_factory": lambda profile, key: native_adapter(
            profile, key, transport=package.MockTransport(respond)
        ),
    }
    catalog = await opened()
    if settings.get("mode") == "revoked":
        runtime = await QARuntime.open(catalog, models, **options)
        try:
            result = await runtime.run("Continue with revoked source")
            assert result["status"] == "blocked"
            assert requests == [], "Revoked context cannot contact the model or token counter"
        finally:
            await runtime.close()
        return
    await catalog.put_task(task)
    await catalog.put_source(settings["sourceArtifact"])
    await catalog.put_work(work)
    await catalog.checkpoint(
        work_refs=[work["artifact"]],
        pending_review_refs=[{"id": "review.pending", "revision": "r1"}],
        questions=["Owner must review this bounded disposition; original FAIL remains"],
        conflicts=[],
    )
    runtime = await QARuntime.open(catalog, models, **options)
    review_context = await runtime.review_context(work)
    assert review_context["workingArtifactRefs"] == [work["artifact"]]
    first = await runtime.run("Read exact QA result before owner review")
    assert first["status"] == "ready", first.get("code")
    event_text = json.dumps([event.model_dump(mode="json") for event in first["events"]])
    assert "qa-observed-report" in event_text and '"FAIL"' in event_text
    analyses = []
    for event in first["events"]:
        for part in (event.content.parts if event.content else []) or []:
            if part.function_response:
                response = part.function_response.response
                payload = response.get("structuredContent", {})
                if isinstance(payload, dict) and payload.get("success") is True:
                    analyses.append(payload["analysis"])
    observed = next(
        item["summary"]["status"] for item in analyses if item.get("kind") == "qa-observed-report"
    )
    pending = next((item for item in analyses if item.get("state") == "awaiting-review"), None)
    assert pending is not None or settings.get("mode") == "resume"
    await runtime.close()
    runtime = await QARuntime.open(await opened(), models, **options)
    try:
        second = await runtime.run("Resume defect review after restart")
        assert second["status"] == "ready", second.get("code")
        manifest = second["context"]["manifest"]
        assert manifest["workingArtifactRefs"] == [work["artifact"]]
        if pending is not None:
            checkpoint = await runtime.catalog.current_checkpoint()
            assert checkpoint["pendingReviewRefs"] == [
                {"id": pending["reviewId"], "revision": "r1"}
            ]
        assert set(purposes) == {"agent"}
        assert key not in json.dumps(requests[-1])
        descriptor = os.open(
            output_file, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600
        )
        with os.fdopen(descriptor, "w") as handle:
            if settings.get("mode") == "resume":
                from app.review_supervision import ReviewSupervisor

                status = await ReviewSupervisor(backend).resume(settings["reviewId"])
                assert status["state"] == "completed"
                replay = await ReviewSupervisor(backend).resume(settings["reviewId"])
                assert replay["outcome"] == status["outcome"]
                handle.write(json.dumps(status))
            else:
                handle.write(
                    json.dumps(
                        {
                            "work": work,
                            "context": manifest,
                            "observedStatus": observed,
                            "pending": pending,
                        }
                    )
                )
    finally:
        await runtime.close()


if __name__ == "__main__":
    asyncio.run(main())
