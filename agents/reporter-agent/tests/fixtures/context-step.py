"""Native source-backed context over a real compatible MCP service; offline model transport only."""

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

from app.context_runtime import ReporterRuntime


async def main():
    input_file, output_file, endpoint = sys.argv[1:]
    settings = json.loads(Path(input_file).read_text())
    backend = MCPClientConfig(
        endpoint=endpoint,
        credential=FileBearerCredential(Path(settings["tokenFile"])),
        allow_loopback_http=True,
    )
    task = settings["task"]
    draft = None
    if "work" not in settings:
        result = await call_tool(
            backend,
            "draft_report",
            {
                "sourceIds": [ref["id"] for ref in task["inputs"]],
                "requirements": settings["requirements"],
            },
        )
        assert result["isError"] is False
        draft = result["structuredContent"]["analysis"]
        settings["work"] = draft["work"]
    work = settings["work"]
    scope = task["scope"]
    principal = {
        "subjectId": settings["subjectId"],
        "customerId": scope["customerId"],
        "employeeId": scope["employeeId"],
    }
    policy = {
        "version": "0.1.0",
        "contextPolicy": settings["contextPolicy"],
        "budget": {"maxItems": 16, "maxBytes": 65536, "maxTokens": 16000},
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

    async def review_authority(ref, who, requested):
        assert who == principal and requested == scope
        result = await call_tool(backend, "get_reviewed_source", {"sourceId": ref["id"]})
        assert result["isError"] is False
        return result["structuredContent"]["analysis"]

    provider = settings["provider"]
    owner = {"customerId": scope["customerId"], "employeeId": scope["employeeId"]}

    def profile(purpose):
        return {
            "version": "0.1.0",
            "id": "reporter-" + purpose,
            "revision": "r1",
            "purpose": purpose,
            "owner": owner,
            "provider": provider,
            "model": "gemini-fixture-001" if provider == "gemini" else "claude-fixture-001",
            "modelRevision": "fixture-001",
            "endpoint": "https://generativelanguage.googleapis.com"
            if provider == "gemini"
            else "https://api.anthropic.com",
            "credentialRef": "secret:reporter-" + purpose,
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
    key = token_urlsafe(32)
    purposes = []
    requests = []
    package = httpx if provider == "gemini" else httpx2

    async def resolve(actual_owner, reference, purpose):
        assert actual_owner == owner and purpose == "agent"
        purposes.append(purpose)
        return key

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
                            "parts": [
                                {
                                    "text": "Review the source-backed private report before publication"
                                }
                            ],
                        },
                        "finishReason": "STOP",
                    }
                ]
            }
        else:
            response = {
                "id": "fixture",
                "type": "message",
                "role": "assistant",
                "model": models.agent["model"],
                "content": [
                    {
                        "type": "text",
                        "text": "Review the source-backed private report before publication",
                    }
                ],
                "stop_reason": "end_turn",
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
            review_authority=review_authority,
        )

    catalog = await opened()
    options = {
        "backend_config": backend,
        "resolve_credential": resolve,
        "adapter_factory": lambda profile, key: native_adapter(
            profile, key, transport=package.MockTransport(respond)
        ),
    }
    if settings.get("mode") == "revoked":
        runtime = await ReporterRuntime.open(catalog, models, **options)
        try:
            blocked = await runtime.run("Continue after source permission was revoked")
            assert blocked["status"] == "blocked"
            if blocked.get("code"):
                assert blocked["code"] in {
                    "access_denied",
                    "source_unavailable",
                    "missing_input",
                    "history_unavailable",
                }, blocked["code"]
            else:
                assert blocked["context"]["manifest"]["blockers"]
                assert all(
                    item["code"] in {"missing_input", "access_denied", "source_unavailable"}
                    for item in blocked["context"]["manifest"]["blockers"]
                )
            assert requests == [], "Revoked context must not contact the model or token counter"
        finally:
            await runtime.close()
        return
    if settings.get("mode") != "resume":
        await catalog.put_task(task)
        receipt = await review_authority(task["inputs"][0], principal, scope)
        await catalog.put_shared(receipt["work"])
        await catalog.put_work(work)
        await catalog.checkpoint(
            work_refs=[work["artifact"]],
            pending_review_refs=[{"id": "review.pending", "revision": "r1"}],
            questions=["Owner must approve the exact publication revision"],
            conflicts=[],
        )
    runtime = await ReporterRuntime.open(catalog, models, **options)
    first = await runtime.run("First source-backed review")
    assert first["status"] == "ready", first.get("code")
    assert work["artifact"]["id"] in json.dumps(requests[-1])
    await runtime.close()
    runtime = await ReporterRuntime.open(await opened(), models, **options)
    try:
        second = await runtime.run("Continue source-backed review after restart")
        assert second["status"] == "ready", second.get("code")
        manifest = second["context"]["manifest"]
        assert len(manifest["sharedKnowledge"]) == 1 and manifest["workingArtifactRefs"] == [
            work["artifact"]
        ]
        assert "First source-backed review" not in json.dumps(requests[-1])
        assert set(purposes) == {"agent"}
        fd = os.open(output_file, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        try:
            with os.fdopen(fd, "w", closefd=False) as handle:
                if settings.get("mode") == "resume":
                    from app.review_supervision import ReviewSupervisor

                    supervisor = ReviewSupervisor(backend)
                    status = await supervisor.resume(settings["reviewId"])
                    assert status["state"] == "completed" and status["outcome"]["stored"] is True
                    replay = await supervisor.resume(settings["reviewId"])
                    assert replay["outcome"] == status["outcome"]
                    handle.write(json.dumps(status))
                elif settings.get("mode") == "pair":
                    assert draft is not None
                    handle.write(
                        json.dumps(
                            {
                                "work": work,
                                "context": manifest,
                                "evaluations": [
                                    {
                                        "id": "eval.reporter",
                                        "revision": "r1",
                                        "result": "fixture-pending-qualification",
                                        "failures": [],
                                    }
                                ],
                                "publication": {
                                    "markdown": draft["markdown"],
                                    "requirements": draft["requirements"],
                                    "dataSource": work["evidence"][0]["id"],
                                },
                            }
                        )
                    )
                else:
                    handle.write(json.dumps(manifest))
        finally:
            os.close(fd)
    finally:
        await runtime.close()


if __name__ == "__main__":
    asyncio.run(main())
