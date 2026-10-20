"""Native ADK against the actual protected Econobot; only model responses are offline fixtures."""

import asyncio
import json
import os
import sys
from datetime import UTC, datetime
from pathlib import Path
from secrets import token_urlsafe

import httpx
import httpx2
from shaleyeah_employee.context import ContextCatalog
from shaleyeah_employee.models import native_adapter, parse_reference_config
from shaleyeah_evaluations import EvaluationContext, TrustedEvalPolicy, load_profile
from shaleyeah_mcp import FileBearerCredential, MCPClientConfig, call_tool
from shaleyeah_mcp.events import EventEmitter, create_jsonl_sink

from app.context_runtime import EconomistRuntime
from app.evaluation import grade_case, observe_economist, parse_response
from app.review_supervision import ReviewSupervisor


def write_output(file, value):
    descriptor = os.open(file, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, "w") as handle:
        json.dump(value, handle, allow_nan=False)


async def main():
    input_file, output_file, endpoint = sys.argv[1:]
    settings = json.loads(Path(input_file).read_text())
    task, draft = settings["task"], settings["draft"]
    scope, work = task["scope"], draft["work"]
    principal = {
        "subjectId": settings["subjectId"],
        **{key: scope[key] for key in ("customerId", "employeeId")},
    }
    backend = MCPClientConfig(
        endpoint=endpoint,
        credential=FileBearerCredential(Path(settings["tokenFile"])),
        allow_loopback_http=True,
    )
    events = EventEmitter(
        {
            "scope": scope,
            "taskRevision": task["revision"],
            **settings["correlation"],
            "qualification": "fixture",
        },
        {"id": "economist", "version": "0.1.0"},
        create_jsonl_sink(settings.get("eventFile", str(Path(input_file).with_suffix(".events.jsonl")))),
    )
    policy = {
        "version": "0.1.0",
        "contextPolicy": settings["contextPolicy"],
        "budget": {"maxItems": 16, "maxBytes": 131072, "maxTokens": 32000},
        "reservedTokens": 8192,
        "maxCountCalls": 20,
        "maxRecords": 100,
        # Seven financial sources plus the exact review packet share this bounded
        # request. Match the explicit 128 KiB context allocation; do not inherit
        # the smaller single-source QA fixture's record ceiling.
        "maxRecordBytes": 131072,
        "maxSourceAgeSeconds": 86400,
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
        source = next(item for item in draft["sourceArtifacts"] if item["evidence"] == evidence)
        result = await call_tool(
            backend,
            "get_context_source_metadata",
            {
                "sourceRef": {key: source["artifact"][key] for key in ("id", "revision")},
                "operation": operation,
            },
            events=events,
        )
        payload = result.get("structuredContent", {})
        if result.get("isError") or payload.get("success") is not True:
            return {
                "subjectId": principal["subjectId"],
                "scope": scope,
                "allowed": False,
                "operations": [operation],
                "evidence": evidence,
                "retentionExpiresAt": settings["expiresAt"],
            }
        actual = payload["analysis"]
        assert actual["sourceArtifact"]["evidence"] == evidence and actual["operation"] == operation
        return {
            "subjectId": principal["subjectId"],
            "scope": scope,
            "allowed": True,
            "operations": [operation],
            "evidence": evidence,
            "retentionExpiresAt": settings["expiresAt"],
        }

    provider = settings["provider"]
    package = httpx if provider == "gemini" else httpx2
    owner = {key: scope[key] for key in ("customerId", "employeeId")}

    def profile(purpose):
        return {
            "version": "0.1.0",
            "id": "economist-" + purpose,
            "revision": "r1",
            "purpose": purpose,
            "owner": owner,
            "provider": provider,
            "model": "gemini-fixture-001" if provider == "gemini" else "claude-fixture-001",
            "modelRevision": "fixture-001",
            "endpoint": "https://generativelanguage.googleapis.com"
            if provider == "gemini"
            else "https://api.anthropic.com",
            "credentialRef": "secret:economist-" + purpose,
            "capabilities": {"toolUse": True, "structuredOutput": True},
            "limits": {
                "timeoutMs": 30000,
                "maxAttempts": 1,
                "maxOutputTokens": 8192,
                "maxRequests": 8,
                "maxInputChars": 262144,
            },
        }

    models = parse_reference_config(
        {
            "version": "0.1.0",
            **{purpose: profile(purpose) for purpose in ("agent", "synthesis", "judge")},
        }
    )
    key, purposes, requests = token_urlsafe(32), [], []
    generations = 0

    async def resolve(requested_owner, reference, purpose):
        assert requested_owner == owner and purpose == "agent"
        purposes.append(purpose)
        return key

    candidate = {key: draft[key] for key in ("work", "scenario")}
    candidate["evaluations"] = [
        {"id": "eval.economist", "revision": "r1", "result": "fixture-pending", "failures": []}
    ]
    price = next(
        source
        for source in draft["sourceArtifacts"]
        if source["evidence"]["id"] == "evidence.prices"
    )
    arguments = {"task_id": task["id"], "task_revision": task["revision"]}
    sequence = [
        ("read_scenario_inputs", arguments),
        (
            "read_scenario_source",
            {
                "source_id": price["artifact"]["id"],
                "source_revision": price["artifact"]["revision"],
            },
        ),
        (
            "draft_scenario",
            {**arguments, "scenario_ids": ["base"], "work_revision": work["artifact"]["revision"]},
        ),
        (
            "prepare_scenario_review",
            {
                "candidate_json": json.dumps(candidate),
                "expected_head": settings.get("expectedHead"),
            },
        ),
    ]

    async def respond(request):
        nonlocal generations
        assert request.headers["x-goog-api-key" if provider == "gemini" else "x-api-key"] == key
        requests.append(json.loads(request.content))
        if "count" in request.url.path.lower():
            response = {"totalTokens": 400} if provider == "gemini" else {"input_tokens": 400}
        else:
            tool = generations < len(sequence)
            name, args = sequence[generations] if tool else (None, None)
            generations += 1
            text = json.dumps({"work": work, "scenario": draft["scenario"]}, allow_nan=False)
            if provider == "gemini":
                part = {"functionCall": {"name": name, "args": args}} if tool else {"text": text}
                response = {
                    "candidates": [
                        {"content": {"role": "model", "parts": [part]}, "finishReason": "STOP"}
                    ]
                }
            else:
                part = (
                    {
                        "type": "tool_use",
                        "id": "call.economist." + str(generations),
                        "name": name,
                        "input": args,
                    }
                    if tool
                    else {"type": "text", "text": text}
                )
                response = {
                    "id": "msg.economist",
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
        "events": events,
        "resolve_credential": resolve,
        "adapter_factory": lambda profile, key: native_adapter(
            profile, key, transport=package.MockTransport(respond)
        ),
    }
    catalog = await opened()
    if settings.get("mode") not in {"revoked", "resume", "verify_restart"}:
        await catalog.put_task(task)
        for source in draft["sourceArtifacts"]:
            await catalog.put_source(source)
    runtime = await EconomistRuntime.open(catalog, models, **options)
    try:
        if settings.get("mode") == "verify_restart":
            checkpoint = await catalog.current_checkpoint()
            assert checkpoint["workRefs"] == [work["artifact"]]
            assert checkpoint["pendingReviewRefs"] == [{"id": settings["reviewId"], "revision": "r1"}]
            generations = len(sequence)
            restored = await runtime.run("Resume the same financial review after restart")
            assert restored["status"] == "ready", restored.get("code")
            final = next(
                event.content for event in reversed(restored["events"])
                if event.content and any(part.text for part in event.content.parts or [])
            )
            assert parse_response(final.model_dump(mode="json", exclude_none=True)) == {
                "work": work, "scenario": draft["scenario"]
            }
            assert set(purposes) == {"agent"} and key not in json.dumps(requests[-1])
            write_output(output_file, {
                "status": "ready", "context": restored["context"]["manifest"],
                "pendingReviewRefs": checkpoint["pendingReviewRefs"],
            })
            return
        if settings.get("mode") == "revoked":
            result = await runtime.run("Continue with revoked economics source")
            assert result["status"] == "blocked" and requests == []
            write_output(output_file, {"status": "blocked", "modelContacted": False})
            return
        if settings.get("mode") == "resume":
            checkpoint = await catalog.current_checkpoint()
            assert checkpoint["pendingReviewRefs"] == [
                {"id": settings["reviewId"], "revision": "r1"}
            ]

            async def audited_client(config, name, args):
                return await call_tool(config, name, args, events=events)

            supervisor = ReviewSupervisor(backend, client=audited_client)
            completed = await supervisor.resume(settings["reviewId"])
            assert completed["state"] == "completed" and completed["outcome"]["stored"] is True
            replay = await supervisor.resume(settings["reviewId"])
            assert replay["outcome"] == completed["outcome"]
            await catalog.checkpoint(
                work_refs=checkpoint["workRefs"],
                pending_review_refs=[],
                questions=checkpoint["questions"],
                conflicts=checkpoint["conflicts"],
            )
            assert requests == [], "An exact approved business-state transition needs no model call"
            write_output(
                output_file,
                {
                    "state": completed["state"],
                    "outcome": completed["outcome"],
                    "pendingReviewRefs": (await catalog.current_checkpoint())["pendingReviewRefs"],
                },
            )
            return
        first = await runtime.run(
            "Read exact sources, draft the base scenario and prepare human review"
        )
        assert first["status"] == "ready", first.get("code")
        analyses = []
        for event in first["events"]:
            for part in (event.content.parts if event.content else []) or []:
                if part.function_response:
                    response = part.function_response.response
                    payload = response.get("structuredContent", {})
                    assert not response.get("isError"), "The actual tool failed"
                    if payload.get("success") is True:
                        analyses.append(payload["analysis"])
        actual = next(item for item in analyses if "work" in item)
        pending = next(item for item in analyses if item.get("state") == "awaiting-review")
        assert actual["work"] == work and actual["scenario"] == draft["scenario"]
        checkpoint = await runtime.catalog.current_checkpoint()
        assert checkpoint["workRefs"] == [work["artifact"]]
        assert checkpoint["pendingReviewRefs"] == [{"id": pending["reviewId"], "revision": "r1"}]
        assert set(purposes) == {"agent"} and key not in json.dumps(requests[-1])
        final = next(
            event.content
            for event in reversed(first["events"])
            if event.content and any(part.text for part in event.content.parts or [])
        )
        native = {
            "eval_case_id": "control_base",
            "responses": [{"response": final.model_dump(mode="json", exclude_none=True)}],
            "agent_data": {
                "turns": [
                    {
                        "events": [
                            event.model_dump(mode="json", exclude_none=True)
                            for event in first["events"]
                        ]
                    }
                ]
            },
        }
        evaluation_root = Path(__file__).parents[1] / "eval"
        profile_config = load_profile(
            (evaluation_root / "performance_profile.json").read_bytes(),
            datasets={
                "economist.reference": (
                    evaluation_root / "datasets/economist-performance.json"
                ).read_bytes()
            },
            policy=TrustedEvalPolicy("economist"),
        )
        reference = json.loads((evaluation_root / "fixtures/economic-oracles.json").read_text())[
            "references"
        ]["base"]
        observed = observe_economist(
            runtime.agent,
            first["events"],
            observed_work=actual["work"],
            observed_scenario=actual["scenario"],
            references=[reference],
            write_dispatches=0,
            authorized_write_dispatches=0,
            unauthorized_actions=0,
            approval_required=False,
        )
        context = EvaluationContext.from_trusted_runtime(
            scope=scope,
            task_revision=task["revision"],
            product_ref=work["artifact"],
            evaluated_at=datetime.now(UTC).isoformat(timespec="milliseconds"),
            source_artifacts=actual["sourceArtifacts"],
            observations=observed,
        )
        identity = {
            "id": "fixture.economist." + provider,
            "version": "r2",
            "model": {
                "provider": provider,
                "id": models.agent["model"],
                "revision": models.agent["modelRevision"],
            },
            "runtime": {"id": "google-adk", "version": "2.4.0"},
            "harness": {"id": "shaleyeah-fixture-runner", "version": "0.1.0"},
            "qualification": "fixture",
        }
        grade = await grade_case(profile_config, native, context=context, candidate=identity)
        assert grade["status"] == "passed", grade["hardFailures"]
        write_output(
            output_file,
            {
                "work": actual["work"],
                "scenario": actual["scenario"],
                "sourceArtifacts": actual["sourceArtifacts"],
                "candidate": identity,
                "grade": grade,
                "pending": pending,
                "context": first["context"]["manifest"],
                "native": native,
            },
        )
    finally:
        await runtime.close()


if __name__ == "__main__":
    asyncio.run(main())
