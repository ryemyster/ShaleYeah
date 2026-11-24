"""Native ADK against the actual protected Title MCP server; only model responses are offline fixtures."""

import asyncio
import json
import os
import sys
import time
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

from app.context_runtime import TitleAnalystRuntime
from app.evaluation import grade_case, observe_title, parse_response
from app.review_supervision import ReviewSupervisor

_runtime_started = time.monotonic()


def phase(name, provider=None, *, source_calls=None, model_calls=None, count_calls=None):
    """Emit fixed phase names and counts, never inputs, paths or credential values."""
    record = {
        "phase": name,
        "provider": provider if provider in {"gemini", "anthropic"} else None,
        "runtimeElapsedMs": round((time.monotonic() - _runtime_started) * 1000),
    }
    if source_calls is not None:
        record["sourceCalls"] = source_calls
    if model_calls is not None:
        record["modelCalls"] = model_calls
    if count_calls is not None:
        record["countCalls"] = count_calls
    print("TITLE_NATIVE_PHASE " + json.dumps(record), file=sys.stderr, flush=True)


def tool_analyses(body):
    """Read actual provider tool-result boundaries, never JSON found inside retrieved source text."""
    results = []

    def accepted(value):
        if type(value) is not dict or value.get("isError") is True:
            return
        payload = value.get("structuredContent")
        if (
            type(payload) is dict
            and payload.get("success") is True
            and type(payload.get("analysis")) is dict
        ):
            results.append(payload["analysis"])

    for content in body.get("contents", []):
        for part in content.get("parts", []):
            if type(part.get("functionResponse")) is dict:
                accepted(part["functionResponse"].get("response"))
    for message in body.get("messages", []):
        parts = message.get("content", [])
        if type(parts) is not list:
            continue
        for part in parts:
            if type(part) is not dict or part.get("type") != "tool_result":
                continue
            content = part.get("content")
            texts = (
                [content]
                if type(content) is str
                else [
                    p.get("text")
                    for p in content or []
                    if type(p) is dict and p.get("type") == "text"
                ]
            )
            for value in texts:
                if type(value) is str:
                    try:
                        accepted(json.loads(value))
                    except ValueError:
                        pass
    return results


def proposed_packet(analyses):
    """Authored provider proposal fixture; all citation objects must come from real quote lookup."""
    proposal = json.loads(
        (Path(__file__).parents[1] / "eval/fixtures/provider-proposal.json").read_text()
    )
    for issue in proposal["observations"]:
        for index, expected in enumerate(issue["citations"]):
            citation = next(
                (
                    item["citation"]
                    for item in analyses
                    if type(item.get("citation")) is dict
                    and all(
                        item["citation"].get(key) == expected[key]
                        for key in ("instrumentRef", "sectionId", "quote")
                    )
                ),
                None,
            )
            if citation is None:
                raise ValueError("quote_lookup_required")
            issue["citations"][index] = json.loads(json.dumps(citation))
    return proposal


def actual_packet(analyses):
    for item in reversed(analyses):
        if type(item.get("work")) is dict and type(item.get("title")) is dict:
            return {key: item[key] for key in ("work", "title")}
    raise ValueError("draft_result_required")


def write_output(file, value):
    phase("output-write")
    descriptor = os.open(file, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, "w") as handle:
        json.dump(value, handle, allow_nan=False)


async def main():
    input_file, output_file, endpoint = sys.argv[1:]
    settings = json.loads(Path(input_file).read_text())
    provider = settings["provider"]
    phase("settings-loaded", provider)
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
        {"id": "title", "version": "0.1.0"},
        create_jsonl_sink(
            settings.get("eventFile", str(Path(input_file).with_suffix(".events.jsonl")))
        ),
    )
    policy = {
        "version": "0.1.0",
        "contextPolicy": settings["contextPolicy"],
        "budget": {"maxItems": 16, "maxBytes": 131072, "maxTokens": 32000},
        "reservedTokens": 8192,
        "maxCountCalls": 64,
        "maxRecords": 100,
        # Three Title sources plus the exact review packet share this bounded
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

    source_calls = 0

    async def source_authority(evidence, who, requested, operation):
        nonlocal source_calls
        source_calls += 1
        phase("source-authority", provider, source_calls=source_calls)
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
        phase("source-authority-complete", provider, source_calls=source_calls)
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

    package = httpx if provider == "gemini" else httpx2
    owner = {key: scope[key] for key in ("customerId", "employeeId")}

    def profile(purpose):
        return {
            "version": "0.1.0",
            "id": "title-" + purpose,
            "revision": "r1",
            "purpose": purpose,
            "owner": owner,
            "provider": provider,
            "model": "gemini-fixture-001" if provider == "gemini" else "claude-fixture-001",
            "modelRevision": "fixture-001",
            "endpoint": "https://generativelanguage.googleapis.com"
            if provider == "gemini"
            else "https://api.anthropic.com",
            "credentialRef": "secret:title-" + purpose,
            "capabilities": {"toolUse": True, "structuredOutput": True},
            "limits": {
                "timeoutMs": 30000,
                "maxAttempts": 1,
                "maxOutputTokens": 8192,
                "maxRequests": 16,
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
    generations, model_calls, count_calls = 0, 0, 0

    async def resolve(requested_owner, reference, purpose):
        assert requested_owner == owner and purpose == "agent"
        purposes.append(purpose)
        return key

    history = next(
        source
        for source in draft["sourceArtifacts"]
        if source["evidence"]["id"] == "evidence.corpus"
    )
    arguments = {"task_id": task["id"], "task_revision": task["revision"]}
    authored = json.loads(
        (Path(__file__).parents[1] / "eval/fixtures/provider-proposal.json").read_text()
    )
    sequence = (
        [
            ("read_title_inputs", arguments),
            # The canonical draft contains these fact views. Preloading each
            # overlapping view needlessly consumes the fixed invocation budget.
            (
                "read_title_source",
                {
                    "source_id": history["artifact"]["id"],
                    "source_revision": history["artifact"]["revision"],
                },
            ),
        ]
        + [
            (
                "cite_title_instrument",
                {
                    **arguments,
                    "instrument_id": citation["instrumentRef"]["id"],
                    "instrument_revision": citation["instrumentRef"]["revision"],
                    "section_id": citation["sectionId"],
                    "quote": citation["quote"],
                },
            )
            for citation in {
                (
                    c["instrumentRef"]["id"],
                    c["instrumentRef"]["revision"],
                    c["sectionId"],
                    c["quote"],
                ): c
                for observation in authored["observations"]
                for c in observation["citations"]
            }.values()
        ]
        + [
            ("draft_title_packet", None),
            ("prepare_title_review", None),
        ]
    )
    observed_analyses = []

    async def respond(request):
        nonlocal generations, model_calls, count_calls
        assert request.headers["x-goog-api-key" if provider == "gemini" else "x-api-key"] == key
        body = json.loads(request.content)
        requests.append(body)
        observed_analyses.extend(tool_analyses(body))
        if "count" in request.url.path.lower():
            count_calls += 1
            phase(
                "model-count",
                provider,
                source_calls=source_calls,
                model_calls=model_calls,
                count_calls=count_calls,
            )
            response = {"totalTokens": 400} if provider == "gemini" else {"input_tokens": 400}
        else:
            model_calls += 1
            phase(
                "model-generate",
                provider,
                source_calls=source_calls,
                model_calls=model_calls,
                count_calls=count_calls,
            )
            tool = generations < len(sequence)
            name, args = sequence[generations] if tool else (None, None)
            if name == "draft_title_packet":
                args = {
                    **arguments,
                    "proposal_json": json.dumps(proposed_packet(observed_analyses)),
                    "work_revision": work["artifact"]["revision"],
                }
            elif name == "prepare_title_review":
                candidate = actual_packet(observed_analyses)
                candidate["evaluations"] = [
                    {
                        "id": "eval.title",
                        "revision": "r1",
                        "result": "fixture-pending",
                        "failures": [],
                    }
                ]
                args = {
                    "candidate_json": json.dumps(candidate),
                    "expected_head": settings.get("expectedHead"),
                }
            generations += 1
            final = (
                {"deferred": "Pending exact human title review"}
                if settings.get("mode") == "verify_restart"
                else actual_packet(observed_analyses)
                if not tool
                else {}
            )
            text = json.dumps(final, allow_nan=False)
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
                        "id": "call.title." + str(generations),
                        "name": name,
                        "input": args,
                    }
                    if tool
                    else {"type": "text", "text": text}
                )
                response = {
                    "id": "msg.title",
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
    phase("catalog-open", provider)
    catalog = await opened()
    if settings.get("mode") not in {"revoked", "resume", "verify_restart"}:
        phase("catalog-seed", provider)
        await catalog.put_task(task)
        for source in draft["sourceArtifacts"]:
            await catalog.put_source(source)
    phase("runtime-open", provider, source_calls=source_calls)
    runtime = await TitleAnalystRuntime.open(catalog, models, **options)
    try:
        if settings.get("mode") == "verify_restart":
            phase("restart", provider, source_calls=source_calls)
            checkpoint = await catalog.current_checkpoint()
            assert checkpoint["workRefs"] == [work["artifact"]]
            assert checkpoint["pendingReviewRefs"] == [
                {"id": settings["reviewId"], "revision": "r1"}
            ]
            generations = len(sequence)
            restored = await runtime.run("Resume the same title review after restart")
            assert restored["status"] == "ready", restored.get("code")
            final = next(
                event.content
                for event in reversed(restored["events"])
                if event.content and any(part.text for part in event.content.parts or [])
            )
            assert parse_response(final.model_dump(mode="json", exclude_none=True)) == {
                "deferred": "Pending exact human title review"
            }
            assert set(purposes) == {"agent"} and key not in json.dumps(requests[-1])
            write_output(
                output_file,
                {
                    "status": "ready",
                    "context": restored["context"]["manifest"],
                    "pendingReviewRefs": checkpoint["pendingReviewRefs"],
                },
            )
            return
        if settings.get("mode") == "revoked":
            phase("revoked", provider, source_calls=source_calls)
            result = await runtime.run("Continue with revoked title source")
            assert result["status"] == "blocked" and requests == []
            write_output(output_file, {"status": "blocked", "modelContacted": False})
            return
        if settings.get("mode") == "resume":
            phase("resume", provider, source_calls=source_calls)
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
        phase("native-run", provider, source_calls=source_calls)
        first = await runtime.run(
            "Read exact instruments, propose the cited Title packet and prepare human review"
        )
        assert first["status"] == "ready", json.dumps(
            {
                "contextLimitHit": any(
                    row.get("code") == "context_limit"
                    for row in (first.get("context") or {}).get("blockers", [])
                ),
                "inputBytes": (first.get("context") or {}).get("measurements", {}).get("inputBytes"),
            }
        )
        analyses = []
        for event in first["events"]:
            for part in (event.content.parts if event.content else []) or []:
                if part.function_response:
                    response = part.function_response.response
                    payload = response.get("structuredContent", {})
                    assert not response.get("isError"), "The actual tool failed"
                    assert payload.get("success") is True, (
                        "Actual role tool returned no successful structured result"
                    )
                    if payload.get("success") is True:
                        analyses.append(payload["analysis"])
        actual = next(item for item in analyses if "work" in item)
        pending = next(item for item in analyses if item.get("state") == "awaiting-review")
        assert actual["work"] == work and actual["title"] == draft["title"]
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
        phase(
            "grade",
            provider,
            source_calls=source_calls,
            model_calls=model_calls,
            count_calls=count_calls,
        )
        evaluation_root = Path(__file__).parents[1] / "eval"
        profile_config = load_profile(
            (evaluation_root / "performance_profile.json").read_bytes(),
            datasets={
                "title.reference": (
                    evaluation_root / "datasets/title-performance.json"
                ).read_bytes()
            },
            policy=TrustedEvalPolicy("title-analyst"),
        )
        observed = observe_title(
            runtime.agent,
            first["events"],
            observed_work=actual["work"],
            observed_title=actual["title"],
            examination=settings["examination"],
            corpus=settings["corpus"],
            policy=settings["policy"],
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
            "id": "fixture.title." + provider,
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
                "title": actual["title"],
                "sourceArtifacts": actual["sourceArtifacts"],
                "candidate": identity,
                "grade": grade,
                "pending": pending,
                "context": first["context"]["manifest"],
                "native": native,
            },
        )
    finally:
        phase(
            "cleanup",
            provider,
            source_calls=source_calls,
            model_calls=model_calls,
            count_calls=count_calls,
        )
        await runtime.close()


if __name__ == "__main__":
    phase("imports-complete")
    asyncio.run(main())
    phase("completed")
