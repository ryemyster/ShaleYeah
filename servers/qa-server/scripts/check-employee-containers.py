"""Verify installed QA employee/tool images, current sources and qualified human dispositions."""

import argparse
import base64
import hashlib
import json
import os
import re
import subprocess
import sys
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path
from secrets import token_urlsafe
from tempfile import TemporaryDirectory


def invoke(*command, expected=0, timeout=600):
    result = subprocess.run(
        [str(item) for item in command],
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
    )
    if result.returncode != expected:
        for line in result.stderr.splitlines():
            if re.fullmatch(r"Fixture client blocked: [A-Za-z]+Error/[-A-Z0-9_a-z]{1,64}", line):
                print(line, file=sys.stderr)
        raise RuntimeError(f"{command[0]} returned {result.returncode}; expected {expected}")
    return result.stdout


def owned(file, value):
    descriptor = os.open(file, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, "w") as handle:
        handle.write(value if isinstance(value, str) else json.dumps(value))


def timestamp(value):
    return value.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def fingerprint(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


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
    name = "shale-qa-" + hashlib.sha256(str(output).encode()).hexdigest()[:12]
    stage, started, built = "container_runtime_unavailable", False, []
    try:
        assert os.getuid() != 0, "Qualification must use a non-root operating user"
        info = json.loads(invoke("docker", "info", "--format", "{{json .}}", timeout=30))
        assert info.get("ServerVersion") and not info.get("ServerErrors")
        manifest = json.loads((bundle / "manifest.json").read_text())
        assert manifest["status"] == "passed" and manifest["professionalAcceptance"] is False
        assert (
            fingerprint(next((bundle / "npm").glob("shaleyeah-server-qa-*.tgz")))
            == manifest["artifactSha256"]
        )
        assert (
            fingerprint(next((bundle / "wheels").glob("shaleyeah_quality_assurance_adk-*.whl")))
            == manifest["employeeArtifactSha256"]
        )
        assert fingerprint(bundle / "requirements-employee.txt") == manifest["employeeLockSha256"]
        assert fingerprint(bundle / "requirements-tool.txt") == manifest["verifierLockSha256"]
        decision.update(
            codeRevision=manifest["codeRevision"],
            employeeArtifactSha256=manifest["employeeArtifactSha256"],
            artifactSha256=manifest["artifactSha256"],
        )
        stage = "container_build_failed"
        bases = {}
        for unit, tag in (
            ("node", "node:22-bookworm-slim"),
            ("python", "python:3.12-slim-bookworm"),
        ):
            invoke("docker", "pull", tag)
            bases[unit] = json.loads(invoke("docker", "image", "inspect", tag))[0]["RepoDigests"][0]
            assert "@sha256:" in bases[unit]
        decision["baseImages"] = bases
        repo = Path(__file__).resolve().parents[3]
        for unit, recipe in (
            ("tool", repo / "servers/qa-server/Dockerfile"),
            ("employee", repo / "agents/quality-assurance/Dockerfile"),
        ):
            invoke(
                "docker",
                "build",
                "--build-arg",
                "PYTHON_IMAGE=" + bases["python"],
                "--build-arg",
                "NODE_IMAGE=" + bases["node"],
                "-f",
                recipe,
                "-t",
                name + "-" + unit,
                bundle,
            )
            built.append(name + "-" + unit)
            image = json.loads(invoke("docker", "image", "inspect", name + "-" + unit))[0]
            assert image["Config"]["User"] == "10001:10001"
            decision["images"][unit] = {
                "id": image["Id"],
                "user": image["Config"]["User"],
                "architecture": image["Architecture"],
                "os": image["Os"],
            }
        stage = "container_journey_failed"
        checks = bundle / "checks"
        frozen = json.loads((checks / "eval/fixtures/observed-reports.json").read_text())["failure"]
        with TemporaryDirectory(prefix="qa-installed-pair-") as temporary:
            root = Path(temporary)
            operator, client, state = (root / folder for folder in ("operator", "client", "state"))
            for folder in (operator, client, state):
                folder.mkdir(mode=0o700)
            uid = f"{os.getuid()}:{os.getgid()}"
            owned(client / "access-token", token_urlsafe(32))
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
            mounts = [
                "--mount",
                f"type=bind,src={checks},dst=/opt/qa/tool/checks,readonly",
                "--mount",
                f"type=bind,src={client},dst=/run/client,readonly",
            ]

            def stop():
                nonlocal started
                invoke("docker", "stop", "--time", "10", name)
                invoke("docker", "rm", name)
                started = False

            def start():
                nonlocal started
                invoke(
                    "docker",
                    "run",
                    "-d",
                    "--name",
                    name,
                    *common,
                    *mounts,
                    "--mount",
                    f"type=bind,src={operator},dst=/run/operator",
                    "-e",
                    "PORT=0",
                    "-e",
                    "QA_HTTP_CONFIG_FILE=/run/operator/http.json",
                    name + "-tool",
                )
                started = True
                for _ in range(60):
                    logs = subprocess.run(
                        ["docker", "logs", name], capture_output=True, text=True, check=True
                    )
                    match = re.search(
                        r"HTTP transport listening on port (\d+)", logs.stdout + logs.stderr
                    )
                    if match:
                        return f"http://127.0.0.1:{match.group(1)}/mcp"
                    assert json.loads(invoke("docker", "inspect", name))[0]["State"]["Running"]
                    time.sleep(0.2)
                raise RuntimeError("Container startup deadline")

            def protocol(tool, arguments, file, error=False):
                owned(
                    client / "request.json",
                    {
                        "tokenFile": "/run/client/access-token",
                        "name": tool,
                        "arguments": arguments,
                        "outputFile": "/run/operator/" + file,
                        "expectError": error,
                    },
                )
                invoke(
                    "docker",
                    "exec",
                    "--user",
                    uid,
                    name,
                    "node",
                    "/opt/qa/tool/checks/generic-client.mjs",
                    "/run/client/request.json",
                    endpoint,
                )
                return (
                    json.loads((operator / file).read_text())
                    .get("structuredContent", {})
                    .get("analysis")
                )

            def review(*arguments, expected=0):
                return invoke(
                    "docker",
                    "exec",
                    "--user",
                    uid,
                    "-e",
                    "QA_CONFIG_FILE=/run/operator/qa.json",
                    name,
                    "node",
                    "/opt/qa/tool/node_modules/@shaleyeah/server-qa/examples/review.mjs",
                    *arguments,
                    expected=expected,
                )

            def employee(mode, file):
                job["mode"] = mode
                owned(client / "job.json", job)
                invoke(
                    "docker",
                    "run",
                    "--rm",
                    "--network",
                    "container:" + name,
                    *common,
                    *mounts,
                    "--mount",
                    f"type=bind,src={state},dst=/run/state",
                    name + "-employee",
                    "python",
                    "-I",
                    "/opt/qa/tool/checks/context-step.py",
                    "/run/client/job.json",
                    "/run/state/" + file,
                    endpoint,
                )

            for provider in ("gemini", "anthropic"):
                now, expiry = (
                    timestamp(datetime.now(UTC)),
                    timestamp(datetime.now(UTC) + timedelta(hours=1)),
                )
                scope = frozen["report"]["work"]["scope"]
                data = json.loads(base64.b64decode(frozen["sourceBytesBase64"]))
                data["rows"][0]["asOf"] = now
                encoded = json.dumps(data).encode()
                digest = hashlib.sha256(encoded).hexdigest()
                ref = {"id": "source.one", "revision": digest, "uri": "urn:sha256:" + digest}
                evidence = {
                    **ref,
                    "hash": {"algorithm": "sha256", "value": digest},
                    "asOf": now,
                    "accessClassification": "restricted",
                    "usagePolicy": {"id": "policy.data", "version": "r1"},
                }
                task = {
                    "contractVersion": "0.1.0",
                    "kind": "task-assignment",
                    "id": scope["taskId"],
                    "revision": "r1",
                    "scope": scope,
                    "outcome": "Review a configured units defect",
                    "requiredCapabilities": ["qa.check"],
                    "inputs": [ref],
                    "constraints": [],
                    "status": "assigned",
                    "workProductRefs": [],
                    "reviewDecisionRefs": [],
                }
                requester = {
                    "subjectId": "qa-run",
                    "customerId": scope["customerId"],
                    "employeeId": scope["employeeId"],
                    "scopes": ["qa:read", "qa:run", "qa:report", "qa:review", "qa:disposition"],
                }
                profile = frozen["profile"]
                # Parsed rule profiles are canonically sealed, as in the actual source fixture.
                from shaleyeah_evaluations import _canonical

                profile_hash = hashlib.sha256(_canonical(profile).encode()).hexdigest()
                policy = {
                    "version": "0.1.0",
                    "qualification": "fixture",
                    "id": "review.qa",
                    "revision": "r1",
                    "task": task,
                    "requester": requester,
                    "reviewerIds": ["human-owner"],
                    "operation": "record_disposition",
                    "destination": "private-qa-dispositions",
                    "expiresAt": expiry,
                    "grantTtlSeconds": 600,
                    "maxPacketBytes": 2000000,
                    "maxRecords": 20,
                    "requiredGates": ["no-blockers", "evidence-present", "eval-present"],
                    "allowedUsagePolicies": [evidence["usagePolicy"]],
                    "contextPolicy": {"id": "policy.employee-context", "version": "r1"},
                    "retentionPolicy": {"id": "policy.retention", "version": "r1"},
                    "revoked": False,
                }
                disposition_policy = {
                    "version": "0.1.0",
                    "id": "disposition.qa",
                    "revision": "r1",
                    "allowedActions": ["defer", "request_repair", "accept_exception"],
                    "repairOwners": ["data-owner"],
                    "maxTtlSeconds": 600,
                    "allowCriticalExceptions": True,
                }
                source = {
                    "snapshot": {
                        "scope": scope,
                        "evidence": evidence,
                        "bytesBase64": base64.b64encode(encoded).decode(),
                    },
                    "grant": {
                        "subjectId": "qa-run",
                        "scope": scope,
                        "taskRevision": "r1",
                        "operations": ["read", "export"],
                        "current": True,
                        "expiresAt": expiry,
                    },
                }
                configuration = {
                    "version": "0.1.0",
                    "sourceAuthority": "operator-attested-export",
                    "qualification": "fixture",
                    "correlation": {"runId": "container-" + provider, "traceId": "1" * 32},
                    "directory": "/run/operator/state-" + provider,
                    "auditFile": "/run/operator/state-" + provider + "/events.jsonl",
                    "task": task,
                    "profile": profile,
                    "grant": {
                        "subjectId": "qa-run",
                        "scope": scope,
                        "taskRevision": "r1",
                        "profileRef": {"id": profile["id"], "revision": profile["revision"]},
                        "profileHash": profile_hash,
                        "operations": ["read", "run", "report"],
                        "current": True,
                        "expiresAt": expiry,
                    },
                    "sources": [source],
                    "localOperator": {"uid": os.getuid(), "subjectId": "qa-run"},
                    "sensitiveFiles": ["/run/client/access-token"],
                    "review": {
                        "policy": policy,
                        "dispositionPolicy": disposition_policy,
                        "localReviewer": {"uid": os.getuid(), "subjectId": "human-owner"},
                        "qualificationConfigFile": "/run/operator/qualification.json",
                    },
                }
                owned(operator / "qa.json", configuration)
                owned(
                    operator / "qualification.json",
                    {
                        "schemaVersion": "0.1.0",
                        "pythonExecutable": "/opt/qa/tool/.venv/bin/python",
                        "evidenceDirectory": "/run/operator/evidence-" + provider,
                        "policyFile": "/run/operator/evidence-" + provider + "/policy.json",
                        "codeRevision": manifest["codeRevision"],
                        "caseId": "control_observed_pass",
                    },
                )
                owned(
                    operator / "events.json",
                    {
                        "version": "0.1.0",
                        "required": True,
                        "timeoutMs": 5000,
                        "context": {
                            "runId": "container-" + provider,
                            "traceId": "1" * 32,
                            "scope": scope,
                            "taskRevision": "r1",
                            "qualification": "fixture",
                        },
                        "producer": {"id": "qa", "version": "0.1.0"},
                        "jsonlFile": "/run/operator/http-events-" + provider + ".jsonl",
                    },
                )
                owned(
                    operator / "http.json",
                    {
                        "qaConfigFile": "/run/operator/qa.json",
                        "accessTokenFile": "/run/client/access-token",
                        "eventConfigFile": "/run/operator/events.json",
                        "dataPath": "/run/operator/transport-" + provider,
                    },
                )
                stage = "tool_container_start_failed"
                endpoint = start()
                assert (
                    int(invoke("docker", "exec", "--user", uid, name, "id", "-u").strip())
                    == os.getuid()
                )
                stage = "employee_import_failed"
                invoke(
                    "docker",
                    "run",
                    "--rm",
                    *common,
                    name + "-employee",
                    "python",
                    "-I",
                    "-c",
                    "import os; assert not os.path.exists('/run/operator'); from app.agent import root_agent; assert root_agent.name == 'quality_assurance'",
                )
                stage = "observed_rules_failed"
                observed = protocol(
                    "run_quality_tests",
                    {
                        "taskRef": {"id": task["id"], "revision": "r1"},
                        "profileRef": {"id": profile["id"], "revision": "r1"},
                    },
                    "observed-" + provider + ".json",
                )
                assert observed["payload"]["status"] == "FAIL"
                proposal = {
                    "action": "accept_exception",
                    "reason": "Bounded fixture exception; original FAIL remains",
                    "repairOwner": "data-owner",
                    "expiresAt": timestamp(datetime.now(UTC) + timedelta(minutes=5)),
                }
                stage = "source_bound_draft_failed"
                draft = protocol(
                    "draft_disposition",
                    {"resultRef": observed["resultRef"], "proposal": proposal, "revision": "r1"},
                    "draft-" + provider + ".json",
                )
                candidate = {
                    **draft,
                    "evaluations": [
                        {"id": "eval.qa", "revision": "r1", "result": "fixture", "failures": []}
                    ],
                }
                source_artifact = {
                    **frozen["sourceArtifacts"][0],
                    "scope": scope,
                    "taskRevision": "r1",
                    "evidence": evidence,
                    "artifact": ref,
                    "retrievedAt": now,
                    "byteLength": len(encoded),
                }
                job = {
                    "task": task,
                    "sourceArtifact": source_artifact,
                    "candidate": candidate,
                    "resultRef": observed["resultRef"],
                    "subjectId": "qa-run",
                    "provider": provider,
                    "tokenFile": "/run/client/access-token",
                    "contextDirectory": "/run/state/context-" + provider,
                    "contextPolicy": policy["contextPolicy"],
                    "retentionPolicy": policy["retentionPolicy"],
                    "expiresAt": expiry,
                    "expectedHead": None,
                }
                stage = "native_employee_prepare_failed"
                employee("pair", "prepared-" + provider + ".json")
                pending = json.loads((state / ("prepared-" + provider + ".json")).read_text())[
                    "pending"
                ]
                stage = "forged_disposition_guard_failed"
                protocol(
                    "record_disposition",
                    {
                        "reviewId": pending["reviewId"],
                        "packetDigest": pending["packetDigest"],
                        "grantId": "grant.forged",
                    },
                    "forged-" + provider + ".json",
                    True,
                )
                packet = "/run/operator/packet-" + provider + ".json"
                stage = "owner_inspection_failed"
                review("inspect", pending["reviewId"], packet)
                owned(
                    operator / "reason.json",
                    {"reason": "Fixture human review; original failed source stays failed"},
                )
                stage = "unqualified_approval_guard_failed"
                review(
                    "decide",
                    pending["reviewId"],
                    pending["packetDigest"],
                    "approve",
                    "/run/operator/reason.json",
                    expected=1,
                )
                stage = "installed_qualification_failed"
                invoke(
                    "docker",
                    "exec",
                    "--user",
                    uid,
                    name,
                    "/opt/qa/tool/.venv/bin/python",
                    "-I",
                    "/opt/qa/tool/checks/eval/run_fixture_evals.py",
                    "--packet",
                    packet,
                    "--evidence-directory",
                    "/run/operator/evidence-" + provider,
                    "--output",
                    "/run/operator/qualification-result-" + provider + ".json",
                    "--code-revision",
                    manifest["codeRevision"],
                )
                stage = "qualified_owner_approval_failed"
                review(
                    "decide",
                    pending["reviewId"],
                    pending["packetDigest"],
                    "approve",
                    "/run/operator/reason.json",
                )
                job["reviewId"] = pending["reviewId"]
                stage = "tool_restart_failed"
                stop()
                endpoint = start()
                stage = "native_employee_resume_failed"
                employee("resume", "completed-" + provider + ".json")
                completed = json.loads((state / ("completed-" + provider + ".json")).read_text())
                assert completed["state"] == "completed" and completed["outcome"]["stored"] is True
                stage = "original_failure_retention_failed"
                report = protocol(
                    "generate_quality_report",
                    {"resultRef": observed["resultRef"]},
                    "retained-failure-" + provider + ".json",
                )
                assert report["summary"]["status"] == "FAIL"
                source["grant"]["current"] = False
                owned(operator / "qa.json", configuration)
                stage = "revoked_disposition_guard_failed"
                protocol(
                    "record_disposition",
                    {key: completed[key] for key in ("reviewId", "packetDigest", "grantId")},
                    "revoked-" + provider + ".json",
                    True,
                )
                stage = "native_source_revocation_failed"
                employee("revoked", "unused-" + provider + ".json")
                stop()
                decision["controls"].append(
                    {
                        "id": provider
                        + "-native-context-qualified-disposition-restart-replay-revocation",
                        "status": "passed",
                    }
                )
        decision["status"] = "passed"
        return 0
    except (
        OSError,
        RuntimeError,
        AssertionError,
        ValueError,
        KeyError,
        StopIteration,
        subprocess.TimeoutExpired,
    ) as error:
        decision["failures"].append(stage)
        print(
            f"QA employee container qualification blocked at {stage}: {type(error).__name__}",
            file=sys.stderr,
        )
        return 1
    finally:
        if started:
            subprocess.run(["docker", "rm", "-f", name], capture_output=True, check=False)
        for image in built:
            subprocess.run(["docker", "image", "rm", image], capture_output=True, check=False)
        output.write_text(json.dumps(decision, indent=2) + "\n")


if __name__ == "__main__":
    raise SystemExit(main())
