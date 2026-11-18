"""Installed units with explicit offline native providers; never professional qualification."""

import asyncio
import hashlib
import importlib.resources
import json
import os
import re
import shutil
import socket
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path
from secrets import token_urlsafe
from tempfile import TemporaryDirectory

import httpx
import httpx2
from app.context_runtime import GeologistRuntime
from app.geowiz_mcp import assess_geowiz_quality, bind_backend
from app.model_provider import native_adapter, parse_reference_config
from app.review_supervision import ReviewSupervisor
from app.working_context import ContextCatalog
from shaleyeah_contracts import ContractValidationError
from shaleyeah_mcp import FileBearerCredential, MCPClientConfig, MCPClientError, call_tool

ROOT = Path(sys.argv[1]).resolve()
CHECKS = ROOT / "tool/checks"
INSTALLED = ROOT / "tool/node_modules/@shaleyeah/server-geowiz"


def owned(file, value):
    file.write_text(json.dumps(value) if not isinstance(value, str) else value)
    file.chmod(0o600)
    return str(file)


async def command(*arguments, expected=0, env=None):
    process = await asyncio.create_subprocess_exec(
        *map(str, arguments),
        env=env,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    output, _ = await asyncio.wait_for(process.communicate(), timeout=45)
    assert process.returncode == expected, output.decode(errors="replace")
    return output.decode()


def profile(provider, purpose, scope, credential):
    return {
        "version": "0.1.0",
        "id": f"geologist-{purpose}",
        "revision": "fixture-r1",
        "purpose": purpose,
        "owner": {key: scope[key] for key in ("customerId", "employeeId")},
        "provider": provider,
        "model": "gemini-fixture-001" if provider == "gemini" else "claude-fixture-001",
        "modelRevision": "fixture-001",
        "endpoint": "https://generativelanguage.googleapis.com"
        if provider == "gemini"
        else "https://api.anthropic.com",
        "credentialRef": "file:" + str(credential),
        "capabilities": {
            "toolUse": True,
            "structuredOutput": provider == "gemini" or purpose == "synthesis",
        },
        "limits": {
            "timeoutMs": 30000,
            "maxAttempts": 1,
            "maxOutputTokens": 512,
            "maxRequests": 4,
            "maxInputChars": 262144,
        },
    }


async def main():
    assert Path(sys.modules["app"].__file__).resolve().is_relative_to(ROOT / "employee/.venv")
    assets = importlib.resources.files("app").joinpath("reference")
    assert (
        json.loads(assets.joinpath("performance_profile.json").read_text())["roleId"] == "geologist"
    )
    with TemporaryDirectory(prefix="shale-installed-pair-") as directory:
        private = Path(directory).resolve()
        source_file = private / "sample.las"
        shutil.copyfile(CHECKS / "sample.las", source_file)
        source_config = json.loads((CHECKS / "connector-records.json").read_text())["configuration"]
        scope = source_config["scope"]
        scope["employeeId"] = "geologist"
        requester = {
            "subjectId": "employee-run",
            "customerId": scope["customerId"],
            "employeeId": scope["employeeId"],
            "scopes": [
                "mcp:connect",
                "source:read",
                "geowiz:review",
                "geowiz:save",
                "geowiz:analyze",
            ],
        }
        source_config["manifest"]["owner"] = {
            key: scope[key] for key in ("customerId", "employeeId")
        }
        source_config["workspaceRoot"] = str(private)
        source_config["sources"][0]["locator"] = source_file.name
        source_config["sources"][0]["evidence"]["hash"]["value"] = hashlib.sha256(
            source_file.read_bytes()
        ).hexdigest()
        source_config["sources"][0]["evidence"]["asOf"] = (
            datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")
        )
        expiry = (
            (datetime.now(UTC) + timedelta(hours=1))
            .isoformat(timespec="milliseconds")
            .replace("+00:00", "Z")
        )
        source_config["grant"].update(
            subjectId=requester["subjectId"], scope=scope, expiresAt=expiry
        )
        sources_path = owned(private / "sources.json", source_config)
        credential = owned(private / "access-token", token_urlsafe(32))
        agent_key = owned(private / "agent-key", token_urlsafe(32))
        synthesis_key = owned(private / "synthesis-key", token_urlsafe(32))
        with socket.socket() as reserve:
            reserve.bind(("127.0.0.1", 0))
            external_port = reserve.getsockname()[1]
        external_settings = owned(
            private / "external.json", {"port": external_port, "tokenFile": credential}
        )
        external = await asyncio.create_subprocess_exec(
            sys.executable,
            "-I",
            str(CHECKS / "external-mcp.py"),
            external_settings,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        try:
            external_backend = MCPClientConfig(
                endpoint=f"http://127.0.0.1:{external_port}/mcp",
                credential=FileBearerCredential(credential),
                allow_loopback_http=True,
            )
            for attempt in range(40):
                try:
                    response = await bind_backend(assess_geowiz_quality, external_backend, None)(
                        "fixture.las"
                    )
                    break
                except MCPClientError:
                    if attempt == 39 or external.returncode is not None:
                        raise
                    await asyncio.sleep(0.1)
            payload = response["structuredContent"] or json.loads(response["content"][0]["text"])
            assert (
                not response["isError"]
                and payload["analysis"]["fixture"] == "compatible-external-mcp"
            )
        finally:
            external.terminate()
            await asyncio.wait_for(external.wait(), timeout=10)
        context_policy = {
            "version": "0.1.0",
            "contextPolicy": {"id": "policy.context.geologist", "version": "r1"},
            "budget": {"maxItems": 16, "maxBytes": 65536, "maxTokens": 16000},
            "reservedTokens": 1024,
            "maxCountCalls": 20,
            "maxRecords": 100,
            "maxRecordBytes": 65536,
            "maxSourceAgeSeconds": 86400,
            "retention": {"policy": {"id": "policy.retention", "version": "r1"}, "seconds": 1800},
            "ranking": {"id": "lexical", "version": "1"},
        }
        for provider in ("gemini", "anthropic"):
            print("Installed provider control: " + provider, flush=True)
            models = {
                "version": "0.1.0",
                "agent": profile(provider, "agent", scope, agent_key),
                "synthesis": profile(provider, "synthesis", scope, synthesis_key),
                "judge": None,
            }
            model_file = owned(private / "models.json", models)
            # Reviewer settings are separate operator inputs, never employee tools.
            records = json.loads((CHECKS / "employee-records.json").read_text())
            task = {**records["task"], "scope": scope}
            review_file = private / "review.json"
            qualification_dir = private / "qualification"
            qualification_dir.mkdir(mode=0o700, exist_ok=True)
            qualification_file = owned(
                private / "qualification.json",
                {
                    "schemaVersion": "0.1.0",
                    "pythonExecutable": str(ROOT / "tool/.venv/bin/python"),
                    "evidenceDirectory": str(qualification_dir),
                    "policyFile": str(qualification_dir / "policy.json"),
                    "codeRevision": "a" * 40,
                    "caseId": "control",
                },
            )
            http_file = owned(
                private / "http.json",
                {
                    "bindHost": "127.0.0.1",
                    "allowedHosts": ["127.0.0.1"],
                    "allowedOrigins": [],
                    "principal": requester,
                    "policy": {
                        "id": "isolated.reference",
                        "version": "r1",
                        "connectionScopes": ["mcp:connect"],
                        "toolScopes": {
                            name: ["geowiz:analyze"]
                            for name in (
                                "assess_quality",
                                "analyze_formation",
                                "get_model_profile",
                                "fetch_source",
                                "get_source_status",
                                "prepare_review",
                                "get_review_status",
                                "save_finding",
                            )
                        },
                        "resourceScopes": {},
                    },
                    "accessTokenFile": credential,
                    "auditFile": str(private / "access-audit.jsonl"),
                    "sourceConfigFile": sources_path,
                    "modelConfigFile": model_file,
                    "dataPath": str(private / "tools"),
                },
            )

            async def start_server(http_file=http_file):
                process = await asyncio.create_subprocess_exec(
                    "node",
                    "--import",
                    str(CHECKS / "provider-fetch.mjs"),
                    str(INSTALLED / "examples/local-http.mjs"),
                    env={
                        "PATH": os.environ["PATH"],
                        "PORT": "0",
                        "GEOWIZ_HTTP_CONFIG_FILE": http_file,
                        "GEOWIZ_PROVIDER_FIXTURE_RECEIPT_FILE": str(private / "receipts.jsonl"),
                    },
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.STDOUT,
                )
                startup = []
                while line := await asyncio.wait_for(process.stdout.readline(), timeout=15):
                    startup.append(line.decode(errors="replace"))
                    match = re.search(rb"HTTP transport listening on port (\d+)", line)
                    if match:
                        return process, int(match.group(1))
                diagnosis = await command("node", CHECKS / "diagnostic-config.mjs", http_file)
                raise AssertionError(
                    "Installed tool did not start: " + "".join(startup)[-8000:] + diagnosis
                )

            async def stop_server(process):
                process.terminate()
                await asyncio.wait_for(process.wait(), timeout=10)

            process, port = await start_server()
            backend = MCPClientConfig(
                endpoint=f"http://127.0.0.1:{port}/mcp",
                credential=FileBearerCredential(credential),
                allow_loopback_http=True,
            )
            try:
                source_id = source_config["sources"][0]["evidence"]["id"]
                backend_ref = [backend]

                async def fetched(backend_ref=backend_ref, source_id=source_id):
                    result = await call_tool(
                        backend_ref[0], "fetch_source", {"sourceId": source_id}
                    )
                    assert not result.get("isError"), result
                    return result["structuredContent"]["analysis"]

                source = await fetched()
                task["inputs"] = [source["artifact"]]
                policy = {
                    "version": "0.1.0",
                    "id": "review.geologist",
                    "revision": "r1",
                    "task": task,
                    "requester": requester,
                    "reviewerIds": ["human-fixture"],
                    "operation": "save_finding",
                    "destination": "private-reviewed-findings",
                    "expiresAt": expiry,
                    "grantTtlSeconds": 600,
                    "maxPacketBytes": 2_000_000,
                    "maxRecords": 20,
                    "requiredGates": ["no-blockers", "evidence-present", "eval-present"],
                    "allowedUsagePolicies": [source["evidence"]["usagePolicy"]],
                    "contextPolicy": context_policy["contextPolicy"],
                    "retentionPolicy": context_policy["retention"]["policy"],
                    "revoked": False,
                }
                owned(
                    review_file,
                    {
                        "directory": str(private / "review-state"),
                        "sourceConfigFile": sources_path,
                        "sourceAuditFile": str(private / "source-audit.jsonl"),
                        "policy": policy,
                        "qualificationConfigFile": qualification_file,
                        "localReviewer": {"uid": os.getuid(), "subjectId": "human-fixture"},
                        "sensitiveFiles": [credential, agent_key, synthesis_key],
                    },
                )
                http_config = json.loads(Path(http_file).read_text())
                http_config["reviewConfigFile"] = str(review_file)
                owned(Path(http_file), http_config)
                await stop_server(process)
                process, port = await start_server()
                backend = MCPClientConfig(
                    endpoint=f"http://127.0.0.1:{port}/mcp",
                    credential=FileBearerCredential(credential),
                    allow_loopback_http=True,
                )
                backend_ref[0] = backend
                probe = owned(
                    private / "generic.json",
                    {
                        "tokenFile": credential,
                        "sourceFile": str(source_file),
                    },
                )
                await command("node", CHECKS / "generic-client.mjs", probe, backend.endpoint)

                async def grant(principal, expected_scope, operation):
                    assert expected_scope == scope
                    return {
                        "subjectId": requester["subjectId"],
                        "scope": scope,
                        "policy": context_policy["contextPolicy"],
                        "operations": ["read", "write", "assemble", "export", "delete", "restore"],
                        "revoked": False,
                        "expiresAt": expiry,
                    }

                async def source_authority(
                    evidence, principal, expected_scope, operation, fetched=fetched
                ):
                    current = await fetched()
                    return {
                        "subjectId": requester["subjectId"],
                        "scope": scope,
                        "allowed": True,
                        "operations": ["read"],
                        "evidence": current["evidence"],
                        "retentionExpiresAt": expiry,
                    }

                async def open_context(
                    provider=provider, grant=grant, source_authority=source_authority
                ):
                    return await ContextCatalog.open(
                        private / f"context-{provider}",
                        scope,
                        {key: requester[key] for key in ("subjectId", "customerId", "employeeId")},
                        context_policy,
                        grant_provider=grant,
                        source_authority=source_authority,
                    )

                catalog = await open_context()
                try:
                    await catalog.put_task({**task, "contractVersion": "999.0.0"})
                except ContractValidationError as error:
                    assert error.code == "unsupported_version"
                else:
                    raise AssertionError("Installed employee accepted an unsupported contract")
                await catalog.put_task(task)
                await catalog.put_source(source)
                package = httpx if provider == "gemini" else httpx2
                calls = []

                async def respond(request, provider=provider, package=package, calls=calls):
                    body = json.loads(request.content)
                    assert (
                        request.headers["x-goog-api-key" if provider == "gemini" else "x-api-key"]
                        == Path(agent_key).read_text()
                    )
                    if "countTokens" in str(request.url) or "count_tokens" in str(request.url):
                        return package.Response(
                            200,
                            json={"totalTokens": 400}
                            if provider == "gemini"
                            else {"input_tokens": 400},
                        )
                    calls.append(body)
                    args = {"file_path": str(source_file)}
                    if provider == "gemini":
                        part = (
                            {"functionCall": {"name": "analyze_geowiz_formation", "args": args}}
                            if len(calls) == 1
                            else {"text": "Offline source-backed draft; human review required"}
                        )
                        payload = {
                            "candidates": [
                                {
                                    "content": {"role": "model", "parts": [part]},
                                    "finishReason": "STOP",
                                }
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
                                "text": "Offline source-backed draft; human review required",
                            }
                        )
                        payload = {
                            "id": "fixture",
                            "type": "message",
                            "role": "assistant",
                            "model": "fixture-native-001",
                            "content": [part],
                            "stop_reason": "tool_use" if len(calls) == 1 else "end_turn",
                            "usage": {"input_tokens": 400, "output_tokens": 16},
                        }
                    return package.Response(200, json=payload)

                runtime = await GeologistRuntime.open(
                    catalog,
                    parse_reference_config(models),
                    backend_config=backend,
                    adapter_factory=lambda settings, secret, package=package, respond=respond: (
                        native_adapter(settings, secret, transport=package.MockTransport(respond))
                    ),
                )
                result = await runtime.run(
                    "Inspect the authorized LAS and defer interpretation/save to review"
                )
                assert result["status"] == "ready" and len(calls) == 2, result
                manifest = result["context"]["manifest"]
                await runtime.close()
                analysis = (
                    await call_tool(backend, "analyze_formation", {"filePath": str(source_file)})
                )["structuredContent"]["analysis"]
                work = {
                    **records["work"],
                    "scope": scope,
                    "taskRevision": task["revision"],
                    "artifact": {
                        "id": f"product.{provider}",
                        "revision": "r1",
                        "uri": f"urn:example:product:{provider}:1",
                    },
                    "inputs": task["inputs"],
                    "evidence": [source["evidence"]],
                    "blockers": [],
                    "findings": [
                        {
                            "id": "finding.depth",
                            "basis": "measured",
                            "value": analysis["inputReview"]["input"]["index"]["start"],
                            "unit": analysis["inputReview"]["input"]["index"]["unit"],
                            "evidenceIds": [source_id],
                            "assumptionIds": [],
                        }
                    ],
                    "review": {"status": "unreviewed", "decisionRefs": []},
                }
                candidate = {
                    "work": work,
                    "context": manifest,
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
                        "title": "Source-backed LAS",
                        "summary": "Literal measurements; interpretation unreviewed",
                        "confidence": 0,
                        "dataSource": source_id,
                    },
                }

                async def checked_client(settings, name, arguments):
                    response = await call_tool(settings, name, arguments)
                    assert not response.get("isError"), json.dumps(response)
                    return response

                supervisor = ReviewSupervisor(backend, client=checked_client)
                current = await call_tool(backend, "get_review_status", {})
                expected_head = (
                    None
                    if current.get("isError")
                    else current["structuredContent"]["analysis"]["packetDigest"]
                )
                pending = await supervisor.prepare(candidate, expected_head=expected_head)
                assert (await supervisor.resume(pending["reviewId"]))["state"] == "awaiting-review"
                catalog = await open_context()
                await catalog.put_work(work)
                parked = await catalog.checkpoint(
                    work_refs=[work["artifact"]],
                    pending_review_refs=[
                        {"id": pending["reviewId"], "revision": pending["packetDigest"]}
                    ],
                    questions=["Awaiting exact operator review"],
                    conflicts=[],
                )
                await catalog.close()
                reason = owned(
                    private / "reason.txt",
                    "Fixture operator inspected inputs and limitations; not professional acceptance",
                )
                cli_env = {
                    "PATH": os.environ["PATH"],
                    "GEOWIZ_REVIEW_CONFIG_FILE": str(review_file),
                }
                packet_file = private / f"packet-{provider}.json"
                await command(
                    "node",
                    INSTALLED / "examples/review.mjs",
                    "inspect",
                    pending["reviewId"],
                    packet_file,
                    env=cli_env,
                )
                await command(
                    "node",
                    INSTALLED / "examples/review.mjs",
                    "decide",
                    pending["reviewId"],
                    pending["packetDigest"],
                    "approve",
                    reason,
                    env=cli_env,
                    expected=1,
                )
                await command(
                    ROOT / "tool/.venv/bin/python",
                    "-I",
                    CHECKS / "qualification_fixture.py",
                    packet_file,
                    qualification_dir,
                    CHECKS / "performance-profile.json",
                )
                await command(
                    "node",
                    INSTALLED / "examples/review.mjs",
                    "decide",
                    pending["reviewId"],
                    pending["packetDigest"],
                    "approve",
                    reason,
                    env=cli_env,
                )
                # Both native catalog/session and tool review stores survive independent process restarts.
                await stop_server(process)
                process, port = await start_server()
                backend = MCPClientConfig(
                    endpoint=f"http://127.0.0.1:{port}/mcp",
                    credential=FileBearerCredential(credential),
                    allow_loopback_http=True,
                )
                backend_ref[0] = backend
                catalog = await open_context()
                assert (await catalog.current_checkpoint())["pendingReviewRefs"] == parked[
                    "pendingReviewRefs"
                ]
                resumed_runtime = await GeologistRuntime.open(
                    catalog, parse_reference_config(models), backend_config=backend
                )
                restored = await resumed_runtime.sessions.get_session(
                    app_name=resumed_runtime.app_name,
                    user_id=resumed_runtime.user_id,
                    session_id=resumed_runtime.session_id,
                )
                assert len(restored.events) >= 2
                await resumed_runtime.close()
                completed = await ReviewSupervisor(backend).resume(pending["reviewId"])
                assert completed["state"] == "completed"
                assert (await ReviewSupervisor(backend).resume(pending["reviewId"]))[
                    "outcome"
                ] == completed["outcome"]
                source_config["grant"]["revoked"] = True
                owned(Path(sources_path), source_config)
                try:
                    await call_tool(backend, "analyze_formation", {"filePath": str(source_file)})
                except MCPClientError:
                    pass
                else:
                    denied = await call_tool(
                        backend, "assess_quality", {"filePath": str(source_file), "dataType": "las"}
                    )
                    assert denied.get("isError")
                source_config["grant"]["revoked"] = False
                owned(Path(sources_path), source_config)
            finally:
                if process.returncode is None:
                    await stop_server(process)
        receipts = [
            json.loads(line) for line in (private / "receipts.jsonl").read_text().splitlines()
        ]
        assert {receipt["provider"] for receipt in receipts} == {"gemini", "anthropic"}
        print(
            "Installed pair/source/context/native-provider/review/qualification/restart controls pass"
        )


if __name__ == "__main__":
    asyncio.run(main())
