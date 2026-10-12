"""Run one employee phase in its own container; no reviewer files or Docker socket."""

import argparse
import asyncio
import json
from pathlib import Path

import httpx
import httpx2
from app.context_runtime import GeologistRuntime
from app.model_provider import native_adapter, parse_reference_config
from app.review_supervision import ReviewSupervisor
from app.working_context import ContextCatalog
from shaleyeah_mcp import FileBearerCredential, MCPClientConfig, call_tool


async def run(job, phase):
    backend = MCPClientConfig(
        endpoint=job["endpoint"],
        credential=FileBearerCredential(Path(job["credentialFile"])),
        allow_loopback_http=True,
    )
    scope, policy = job["scope"], job["contextPolicy"]
    principal = job["principal"]

    async def source():
        result = await call_tool(backend, "fetch_source", {"sourceId": job["sourceId"]})
        assert not result.get("isError"), result
        return result["structuredContent"]["analysis"]

    async def grant(who, requested_scope, operation):
        assert who == principal and requested_scope == scope
        return {
            "subjectId": principal["subjectId"],
            "scope": scope,
            "policy": policy["contextPolicy"],
            "operations": ["read", "write", "assemble", "delete"],
            "revoked": False,
            "expiresAt": job["expiresAt"],
        }

    async def authority(evidence, who, requested_scope, operation):
        current = await source()
        return {
            "subjectId": principal["subjectId"],
            "scope": scope,
            "allowed": True,
            "operations": ["read"],
            "evidence": current["evidence"],
            "retentionExpiresAt": job["expiresAt"],
        }

    catalog = await ContextCatalog.open(
        Path(job["stateDirectory"]),
        scope,
        principal,
        policy,
        grant_provider=grant,
        source_authority=authority,
    )
    models = parse_reference_config(job["models"])
    supervisor = ReviewSupervisor(backend)
    if phase == "analyze":
        current = await source()
        await catalog.put_task(job["task"])
        await catalog.put_source(current)
        provider = models.agent["provider"]
        package = httpx if provider == "gemini" else httpx2
        calls = []

        async def respond(request):
            assert (
                request.headers["x-goog-api-key" if provider == "gemini" else "x-api-key"]
                == Path(job["agentCredentialFile"]).read_text()
            )
            if "countTokens" in str(request.url) or "count_tokens" in str(request.url):
                return package.Response(
                    200,
                    json={"totalTokens": 400} if provider == "gemini" else {"input_tokens": 400},
                )
            calls.append(json.loads(request.content))
            args = {"file_path": job["sourceFile"]}
            if provider == "gemini":
                part = (
                    {"functionCall": {"name": "analyze_geowiz_formation", "args": args}}
                    if len(calls) == 1
                    else {"text": "Source-backed fixture draft; human review required"}
                )
                data = {
                    "candidates": [
                        {"content": {"role": "model", "parts": [part]}, "finishReason": "STOP"}
                    ],
                    "modelVersion": "fixture-native-001",
                }
            else:
                part = (
                    {
                        "type": "tool_use",
                        "id": "fixture-call",
                        "name": "analyze_geowiz_formation",
                        "input": args,
                    }
                    if len(calls) == 1
                    else {
                        "type": "text",
                        "text": "Source-backed fixture draft; human review required",
                    }
                )
                data = {
                    "id": "fixture",
                    "type": "message",
                    "role": "assistant",
                    "model": "fixture-native-001",
                    "content": [part],
                    "stop_reason": "tool_use" if len(calls) == 1 else "end_turn",
                    "usage": {"input_tokens": 400, "output_tokens": 16},
                }
            return package.Response(200, json=data)

        runtime = await GeologistRuntime.open(
            catalog,
            models,
            backend_config=backend,
            adapter_factory=lambda settings, secret: native_adapter(
                settings, secret, transport=package.MockTransport(respond)
            ),
        )
        result = await runtime.run(
            "Analyze only the permitted LAS; defer interpretation and save to exact human review"
        )
        assert result["status"] == "ready" and len(calls) == 2
        analysis = (await call_tool(backend, "analyze_formation", {"filePath": job["sourceFile"]}))[
            "structuredContent"
        ]["analysis"]
        work = {
            **job["workTemplate"],
            "scope": scope,
            "taskRevision": job["task"]["revision"],
            "artifact": {
                "id": "product.container",
                "revision": "r1",
                "uri": "urn:example:container:work:1",
            },
            "inputs": job["task"]["inputs"],
            "evidence": [current["evidence"]],
            "blockers": [],
            "findings": [
                {
                    "id": "finding.depth",
                    "basis": "measured",
                    "value": analysis["inputReview"]["input"]["index"]["start"],
                    "unit": analysis["inputReview"]["input"]["index"]["unit"],
                    "evidenceIds": [job["sourceId"]],
                    "assumptionIds": [],
                }
            ],
            "review": {"status": "unreviewed", "decisionRefs": []},
        }
        candidate = {
            "work": work,
            "context": result["context"]["manifest"],
            "evaluations": [
                {
                    "id": "eval.fixture",
                    "revision": "r1",
                    "result": "reported",
                    "failures": ["Live/domain quality is not qualified"],
                }
            ],
            "finding": {
                "findingType": "formation",
                "title": "Observed container LAS",
                "summary": "Literal measurement; interpretation unreviewed",
                "confidence": 0,
                "dataSource": job["sourceId"],
            },
        }
        pending = await supervisor.prepare(candidate, expected_head=None)
        assert (await supervisor.resume(pending["reviewId"]))["state"] == "awaiting-review"
        await runtime.close()
        catalog = await ContextCatalog.open(
            Path(job["stateDirectory"]),
            scope,
            principal,
            policy,
            grant_provider=grant,
            source_authority=authority,
        )
        await catalog.put_work(work)
        await catalog.checkpoint(
            work_refs=[work["artifact"]],
            pending_review_refs=[{"id": pending["reviewId"], "revision": pending["packetDigest"]}],
            questions=["Awaiting operator review"],
            conflicts=[],
        )
        await catalog.close()
        result_file = Path(job["checkpointFile"])
        result_file.write_text(json.dumps(pending))
        result_file.chmod(0o600)
    elif phase == "resume":
        pending = json.loads(Path(job["checkpointFile"]).read_text())
        stored = await catalog.current_checkpoint()
        assert stored["pendingReviewRefs"][0]["id"] == pending["reviewId"]
        runtime = await GeologistRuntime.open(catalog, models, backend_config=backend)
        session = await runtime.sessions.get_session(
            app_name=runtime.app_name, user_id=runtime.user_id, session_id=runtime.session_id
        )
        assert len(session.events) >= 2
        await runtime.close()
        result = await supervisor.resume(pending["reviewId"])
        assert result["state"] == "completed"
        assert (await supervisor.resume(pending["reviewId"]))["outcome"] == result["outcome"]
        # Neither operator config nor the synthesis key is mounted in this container.
        assert not Path("/run/operator/review.json").exists()
        assert not Path("/run/operator/synthesis-key").exists()
    else:
        denied = await call_tool(backend, "fetch_source", {"sourceId": job["sourceId"]})
        assert denied["isError"]
        assert denied["structuredContent"]["sourceError"]["code"] in {
            "access_denied",
            "authority_denied",
        }
        await catalog.close()
    print("Employee phase passed: " + phase)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=["analyze", "resume", "revoked"])
    parser.add_argument("job")
    args = parser.parse_args()
    asyncio.run(run(json.loads(Path(args.job).read_text()), args.phase))
