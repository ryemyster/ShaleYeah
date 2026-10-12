"""Required isolated images/pair fixture. Never skip unavailable Docker or claim live quality."""

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory


def invoke(*args, expected=0, timeout=600, combine_output=False):
    result = subprocess.run(
        list(map(str, args)),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT if combine_output else subprocess.PIPE,
        text=True,
        timeout=timeout,
        check=False,
    )
    if result.returncode != expected:
        raise RuntimeError(
            f"{args[0]} failed ({result.returncode}): "
            + (result.stdout + (result.stderr or ""))[-12000:]
        )
    return result.stdout.strip()


def owned(file, value):
    file.write_text(value if isinstance(value, str) else json.dumps(value))
    file.chmod(0o600)
    return str(file)


def timestamp():
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def model(provider, purpose, scope, file):
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
        "credentialRef": "file:" + file,
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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", required=True)
    parser.add_argument("--report", required=True)
    args = parser.parse_args()
    bundle, output = Path(args.bundle).resolve(), Path(args.report).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    decision = {
        "schemaVersion": "0.1.0",
        "status": "blocked",
        "qualification": "fixture",
        "professionalAcceptance": False,
        "controls": [],
        "images": {},
        "failures": [],
    }
    stage = "container_runtime_unavailable"
    name = "shale-reference-" + hashlib.sha256(str(output).encode()).hexdigest()[:12]
    started = False
    try:
        invoke("docker", "info", "--format", "{{.ServerVersion}}", timeout=30)
        stage = "container_build_failed"
        manifest = json.loads((bundle / "manifest.json").read_text())
        assert manifest["status"] == "passed" and manifest["qualification"] == "fixture"
        decision["codeRevision"] = manifest["codeRevision"]
        decision["units"] = manifest["units"]
        decision["locks"] = manifest["locks"]
        for unit in manifest["units"]:
            directory, prefix = (
                ("npm", "shaleyeah-server-geowiz-")
                if unit["id"] == "geowiz"
                else ("wheels", "shaleyeah_geologist_adk-")
            )
            artifact_file = next((bundle / directory).glob(prefix + "*"))
            assert hashlib.sha256(artifact_file.read_bytes()).hexdigest() == unit["artifactSha256"]
        assert (
            hashlib.sha256((bundle / "tool/package-lock.json").read_bytes()).hexdigest()
            == manifest["locks"]["npm"]
        )
        assert (
            hashlib.sha256((bundle / "requirements-employee.txt").read_bytes()).hexdigest()
            == manifest["locks"]["python"]
        )
        # Qualify each build against immutable base digests, not a moving tag claim.
        bases = {}
        for id, tag in (("python", "python:3.12-slim-bookworm"), ("node", "node:22-bookworm-slim")):
            invoke("docker", "pull", tag)
            digest = json.loads(invoke("docker", "image", "inspect", tag))[0]["RepoDigests"][0]
            assert "@sha256:" in digest
            bases[id] = digest
        for unit in ("geologist", "geowiz"):
            recipe = bundle / "recipes" / unit / "Dockerfile"
            cmd = [
                "docker",
                "build",
                "--build-arg",
                "PYTHON_IMAGE=" + bases["python"],
                "-f",
                recipe,
                "-t",
                name + "-" + unit,
            ]
            if unit == "geowiz":
                cmd += ["--build-arg", "NODE_IMAGE=" + bases["node"]]
            invoke(*cmd, bundle)
            image = json.loads(invoke("docker", "image", "inspect", name + "-" + unit))[0]
            decision["images"][unit] = {
                "id": image["Id"],
                "architecture": image["Architecture"],
                "os": image["Os"],
                "user": image["Config"]["User"],
            }
            assert image["Config"]["User"] == "10001:10001"
        decision["baseImages"] = bases
        stage = "container_journey_failed"
        checks = bundle / "tool/checks"
        with TemporaryDirectory(prefix="shale-container-fixture-") as directory:
            root = Path(directory)
            operator, client, state = [root / name for name in ("operator", "client", "state")]
            for folder in (operator, client, state):
                folder.mkdir(mode=0o700)
            from secrets import token_urlsafe

            owned(client / "access-token", token_urlsafe(32))
            owned(client / "agent-key", token_urlsafe(32))
            owned(operator / "synthesis-key", token_urlsafe(32))
            shutil.copyfile(checks / "sample.las", operator / "sample.las")
            source = json.loads((checks / "connector-records.json").read_text())["configuration"]
            scope = source["scope"]
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
            source["workspaceRoot"] = "/run/operator"
            source["manifest"]["owner"] = {key: scope[key] for key in ("customerId", "employeeId")}
            source["sources"][0]["locator"] = "sample.las"
            source["sources"][0]["evidence"]["hash"]["value"] = hashlib.sha256(
                (operator / "sample.las").read_bytes()
            ).hexdigest()
            source["sources"][0]["evidence"]["asOf"] = timestamp()
            expiry = (
                (datetime.now(UTC) + timedelta(hours=1))
                .isoformat(timespec="milliseconds")
                .replace("+00:00", "Z")
            )
            source["grant"].update(subjectId=requester["subjectId"], scope=scope, expiresAt=expiry)
            owned(operator / "sources.json", source)
            uid = f"{os.getuid()}:{os.getgid()}"
            common = [
                "--user",
                uid,
                "--read-only",
                "--cap-drop",
                "ALL",
                "--security-opt",
                "no-new-privileges",
                "--tmpfs",
                "/tmp:rw,nosuid,nodev,size=64m",
            ]
            mount_checks = [
                "--mount",
                f"type=bind,src={checks},dst=/opt/reference/tool/checks,readonly",
            ]

            def start():
                nonlocal started
                invoke(
                    "docker",
                    "run",
                    "-d",
                    "--name",
                    name,
                    *common,
                    *mount_checks,
                    "--mount",
                    f"type=bind,src={operator},dst=/run/operator",
                    "--mount",
                    f"type=bind,src={client},dst=/run/client,readonly",
                    "-e",
                    "PORT=0",
                    "-e",
                    "GEOWIZ_HTTP_CONFIG_FILE=/run/operator/http.json",
                    "-e",
                    "GEOWIZ_PROVIDER_FIXTURE_RECEIPT_FILE=/run/operator/receipts.jsonl",
                    name + "-geowiz",
                    "node",
                    "--import",
                    "/opt/reference/tool/checks/provider-fetch.mjs",
                    "/opt/reference/tool/node_modules/@shaleyeah/server-geowiz/examples/local-http.mjs",
                )
                started = True
                for _ in range(60):
                    match = re.search(
                        r"HTTP transport listening on port (\d+)",
                        invoke("docker", "logs", name, combine_output=True),
                    )
                    if match:
                        return int(match.group(1))
                    if not json.loads(invoke("docker", "inspect", name))[0]["State"]["Running"]:
                        raise RuntimeError("Tool container setup failed")
                    time.sleep(0.2)
                raise RuntimeError("Tool container startup deadline")

            def stop():
                nonlocal started
                invoke("docker", "stop", "--time", "10", name)
                invoke("docker", "rm", name)
                started = False

            def tool(*cmd, expected=0):
                return invoke("docker", "exec", "--user", uid, name, *cmd, expected=expected)

            def employee(phase):
                invoke(
                    "docker",
                    "run",
                    "--rm",
                    "--network",
                    "container:" + name,
                    *common,
                    *mount_checks,
                    "--mount",
                    f"type=bind,src={client},dst=/run/client,readonly",
                    "--mount",
                    f"type=bind,src={state},dst=/run/state",
                    name + "-geologist",
                    "python",
                    "-I",
                    "/opt/reference/tool/checks/employee-step.py",
                    phase,
                    "/run/client/job.json",
                )

            records = json.loads((checks / "employee-records.json").read_text())
            context_policy = {
                "version": "0.1.0",
                "contextPolicy": {"id": "policy.context.geologist", "version": "r1"},
                "budget": {"maxItems": 16, "maxBytes": 65536, "maxTokens": 16000},
                "reservedTokens": 1024,
                "maxCountCalls": 20,
                "maxRecords": 100,
                "maxRecordBytes": 65536,
                "maxSourceAgeSeconds": 86400,
                "retention": {
                    "policy": {"id": "policy.retention", "version": "r1"},
                    "seconds": 1800,
                },
                "ranking": {"id": "lexical", "version": "1"},
            }
            for provider in ("gemini", "anthropic"):
                # New bounded fixture task/store for each provider; state stays durable within its restart journey.
                if (operator / "review.json").exists():
                    (operator / "review.json").unlink()
                    shutil.rmtree(operator / "review-state")
                    shutil.rmtree(state / "context")
                models = {
                    "version": "0.1.0",
                    "agent": model(provider, "agent", scope, "/run/client/agent-key"),
                    "synthesis": model(provider, "synthesis", scope, "/run/operator/synthesis-key"),
                    "judge": None,
                }
                owned(operator / "models.json", models)
                http = {
                    "bindHost": "127.0.0.1",
                    "allowedHosts": ["127.0.0.1"],
                    "allowedOrigins": [],
                    "principal": requester,
                    "policy": {
                        "id": "container.reference",
                        "version": "r1",
                        "connectionScopes": ["mcp:connect"],
                        "toolScopes": {
                            key: ["geowiz:analyze"]
                            for key in (
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
                    "accessTokenFile": "/run/client/access-token",
                    "auditFile": "/run/operator/audit.jsonl",
                    "sourceConfigFile": "/run/operator/sources.json",
                    "modelConfigFile": "/run/operator/models.json",
                    "dataPath": "/run/operator/tools",
                }
                owned(operator / "http.json", http)
                port = start()
                probe = {
                    "tokenFile": "/run/client/access-token",
                    "sourceFile": "/run/operator/sample.las",
                    "sourceId": source["sources"][0]["evidence"]["id"],
                    "outputSourceFile": "/run/operator/source-artifact.json",
                }
                owned(operator / "probe.json", probe)
                tool(
                    "node",
                    "/opt/reference/tool/checks/generic-client.mjs",
                    "/run/operator/probe.json",
                    f"http://127.0.0.1:{port}/mcp",
                )
                artifact = json.loads((operator / "source-artifact.json").read_text())
                task = {**records["task"], "scope": scope, "inputs": [artifact["artifact"]]}
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
                    "allowedUsagePolicies": [artifact["evidence"]["usagePolicy"]],
                    "contextPolicy": context_policy["contextPolicy"],
                    "retentionPolicy": context_policy["retention"]["policy"],
                    "revoked": False,
                }
                (operator / "qualification").mkdir(mode=0o700, exist_ok=True)
                owned(
                    operator / "qualification.json",
                    {
                        "schemaVersion": "0.1.0",
                        "pythonExecutable": "/opt/reference/tool/.venv/bin/python",
                        "evidenceDirectory": "/run/operator/qualification",
                        "policyFile": "/run/operator/qualification/policy.json",
                        "codeRevision": "a" * 40,
                        "caseId": "control",
                    },
                )
                owned(
                    operator / "review.json",
                    {
                        "directory": "/run/operator/review-state",
                        "sourceConfigFile": "/run/operator/sources.json",
                        "sourceAuditFile": "/run/operator/source-audit.jsonl",
                        "policy": policy,
                        "qualificationConfigFile": "/run/operator/qualification.json",
                        "localReviewer": {"uid": os.getuid(), "subjectId": "human-fixture"},
                        "sensitiveFiles": [
                            "/run/client/access-token",
                            "/run/client/agent-key",
                            "/run/operator/synthesis-key",
                        ],
                    },
                )
                http["reviewConfigFile"] = "/run/operator/review.json"
                owned(operator / "http.json", http)
                stop()
                port = start()
                job = {
                    "endpoint": f"http://127.0.0.1:{port}/mcp",
                    "credentialFile": "/run/client/access-token",
                    "agentCredentialFile": "/run/client/agent-key",
                    "models": models,
                    "scope": scope,
                    "principal": {
                        key: requester[key] for key in ("subjectId", "customerId", "employeeId")
                    },
                    "contextPolicy": context_policy,
                    "expiresAt": expiry,
                    "sourceId": source["sources"][0]["evidence"]["id"],
                    "sourceFile": "/run/operator/sample.las",
                    "task": task,
                    "workTemplate": records["work"],
                    "stateDirectory": "/run/state/context",
                    "checkpointFile": "/run/state/checkpoint.json",
                }
                owned(client / "job.json", job)
                employee("analyze")
                pending = json.loads((state / "checkpoint.json").read_text())
                owned(
                    operator / "reason.txt",
                    "Offline fixture operator review; no professional acceptance",
                )
                cli = [
                    "node",
                    "/opt/reference/tool/node_modules/@shaleyeah/server-geowiz/examples/review.mjs",
                ]

                # docker exec sets the reviewer config only for the separate operator command.
                def review(*cmd, expected=0, cli=cli):
                    return invoke(
                        "docker",
                        "exec",
                        "--user",
                        uid,
                        "-e",
                        "GEOWIZ_REVIEW_CONFIG_FILE=/run/operator/review.json",
                        name,
                        *cli,
                        *cmd,
                        expected=expected,
                    )

                packet = f"/run/operator/packet-{provider}.json"
                review("inspect", pending["reviewId"], packet)
                review(
                    "decide",
                    pending["reviewId"],
                    pending["packetDigest"],
                    "approve",
                    "/run/operator/reason.txt",
                    expected=1,
                )
                tool(
                    "/opt/reference/tool/.venv/bin/python",
                    "-I",
                    "/opt/reference/tool/checks/qualification_fixture.py",
                    packet,
                    "/run/operator/qualification",
                    "/opt/reference/tool/checks/performance-profile.json",
                )
                review(
                    "decide",
                    pending["reviewId"],
                    pending["packetDigest"],
                    "approve",
                    "/run/operator/reason.txt",
                )
                stop()
                port = start()
                job["endpoint"] = f"http://127.0.0.1:{port}/mcp"
                owned(client / "job.json", job)
                employee("resume")
                source["grant"]["revoked"] = True
                owned(operator / "sources.json", source)
                employee("revoked")
                source["grant"]["revoked"] = False
                owned(operator / "sources.json", source)
                stop()
                decision["controls"].append(
                    {
                        "id": provider
                        + "-separate-images-context-qualified-review-restart-replay-revocation",
                        "status": "passed",
                    }
                )
        decision["status"] = "passed"
        return 0
    except (OSError, RuntimeError, AssertionError, ValueError, subprocess.TimeoutExpired) as error:
        decision["failures"].append(stage)
        print(
            f"Container qualification blocked at {stage}: {type(error).__name__}: {error}",
            file=sys.stderr,
        )
        return 1
    finally:
        if started:
            subprocess.run(["docker", "rm", "-f", name], capture_output=True, check=False)
        output.write_text(json.dumps(decision, indent=2) + "\n")


if __name__ == "__main__":
    raise SystemExit(main())
