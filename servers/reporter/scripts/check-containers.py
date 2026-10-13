"""Qualify installed Reporter units in separate containers using offline source/model fixtures."""

import argparse
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


def invoke(*command, expected=0, timeout=600, combine=False):
    result = subprocess.run(
        [str(part) for part in command],
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
    )
    if result.returncode != expected:
        # Commands handle private input; do not echo their output or arguments into CI logs.
        raise RuntimeError(
            f"{command[0]} returned {result.returncode}; expected {expected}"
        )
    return result.stdout + (result.stderr if combine else "")


def owned(file, value):
    text = value if isinstance(value, str) else json.dumps(value)
    fd = os.open(file, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "w") as handle:
        handle.write(text)


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
    stage = "container_runtime_unavailable"
    name = "shale-reporter-" + hashlib.sha256(str(output).encode()).hexdigest()[:12]
    started = False
    try:
        info = json.loads(
            invoke("docker", "info", "--format", "{{json .}}", timeout=30)
        )
        if (
            not isinstance(info, dict)
            or not isinstance(info.get("ServerVersion"), str)
            or not info["ServerVersion"].strip()
            or info.get("ServerErrors")
            or info.get("ClientErrors")
        ):
            raise RuntimeError("Docker server unavailable")
        stage = "container_build_failed"
        manifest = json.loads((bundle / "manifest.json").read_text())
        assert manifest["status"] == "passed" and manifest["qualification"] == "fixture"
        assert re.fullmatch(r"[0-9a-f]{40}", manifest["codeRevision"])
        assert {unit["id"] for unit in manifest["units"]} == {
            "reporter",
            "reporter-agent",
        }
        for unit in manifest["units"]:
            archive = next(
                (bundle / ("npm" if unit["id"] == "reporter" else "wheels")).glob(
                    "shaleyeah-server-reporter-*.tgz"
                    if unit["id"] == "reporter"
                    else "shaleyeah_reporter_adk-*.whl"
                )
            )
            assert fingerprint(archive) == unit["artifactSha256"]
        assert (
            fingerprint(bundle / "requirements-employee.txt")
            == manifest["locks"]["employee"]
        )
        assert (
            fingerprint(bundle / "tool/package-lock.json") == manifest["locks"]["tool"]
        )
        decision.update(
            codeRevision=manifest["codeRevision"],
            units=manifest["units"],
            locks=manifest["locks"],
        )
        bases = {}
        for unit, tag in (
            ("python", "python:3.12-slim-bookworm"),
            ("node", "node:22-bookworm-slim"),
        ):
            invoke("docker", "pull", tag)
            bases[unit] = json.loads(invoke("docker", "image", "inspect", tag))[0][
                "RepoDigests"
            ][0]
            assert "@sha256:" in bases[unit]
        decision["baseImages"] = bases
        for unit in ("reporter", "reporter-agent"):
            command = [
                "docker",
                "build",
                "--build-arg",
                "PYTHON_IMAGE=" + bases["python"],
                "-f",
                bundle / "recipes" / unit / "Dockerfile",
                "-t",
                name + "-" + unit,
            ]
            if unit == "reporter":
                command += ["--build-arg", "NODE_IMAGE=" + bases["node"]]
            invoke(*command, bundle)
            image = json.loads(invoke("docker", "image", "inspect", name + "-" + unit))[
                0
            ]
            assert image["Config"]["User"] == "10001:10001"
            decision["images"][unit] = {
                "id": image["Id"],
                "os": image["Os"],
                "architecture": image["Architecture"],
                "user": image["Config"]["User"],
            }
        stage = "container_journey_failed"
        checks = bundle / "checks"
        records = json.loads((checks / "employee.json").read_text())
        with TemporaryDirectory(prefix="reporter-container-fixture-") as temporary:
            root = Path(temporary)
            operator, client, state = (
                root / folder for folder in ("operator", "client", "state")
            )
            for folder in (operator, client, state):
                folder.mkdir(mode=0o700)
            owned(client / "access-token", token_urlsafe(32))
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
            mounts = [
                "--mount",
                f"type=bind,src={checks},dst=/opt/reference/tool/checks,readonly",
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
                    "REPORTER_HTTP_CONFIG_FILE=/run/operator/http.json",
                    name + "-reporter",
                )
                started = True
                for _ in range(60):
                    match = re.search(
                        r"HTTP transport listening on port (\d+)",
                        invoke("docker", "logs", name, combine=True),
                    )
                    if match:
                        return f"http://127.0.0.1:{match.group(1)}/mcp"
                    assert json.loads(invoke("docker", "inspect", name))[0]["State"][
                        "Running"
                    ]
                    time.sleep(0.2)
                raise RuntimeError("Container startup deadline")

            def employee(mode, result):
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
                    name + "-reporter-agent",
                    "python",
                    "-I",
                    "/opt/reference/tool/checks/context-step.py",
                    "/run/client/job.json",
                    "/run/state/" + result,
                    endpoint,
                )

            def protocol(tool_name, arguments, result, expect_error=False):
                owned(
                    client / "request.json",
                    {
                        "tokenFile": "/run/client/access-token",
                        "name": tool_name,
                        "arguments": arguments,
                        "outputFile": "/run/operator/" + result,
                        "expectError": expect_error,
                    },
                )
                invoke(
                    "docker",
                    "exec",
                    "--user",
                    uid,
                    name,
                    "node",
                    "/opt/reference/tool/checks/generic-client.mjs",
                    "/run/client/request.json",
                    endpoint,
                )
                return (
                    json.loads((operator / result).read_text())
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
                    "REPORTER_CONFIG_FILE=/run/operator/reporter.json",
                    name,
                    "node",
                    "/opt/reference/tool/node_modules/@shaleyeah/server-reporter/examples/review.mjs",
                    *arguments,
                    expected=expected,
                )

            for provider in ("gemini", "anthropic"):
                expiry = (datetime.now(UTC) + timedelta(hours=1)).isoformat()
                scope = {**records["task"]["scope"], "employeeId": "employee.reporter"}
                requester = {
                    "subjectId": "reporter-run",
                    "customerId": scope["customerId"],
                    "employeeId": scope["employeeId"],
                    "scopes": [
                        "reporter:sources",
                        "reporter:review",
                        "reporter:release",
                    ],
                }
                receipt = {
                    "work": records["finalWork"],
                    "task": records["task"],
                    "request": records["reviewRequest"],
                    "decision": records["approveDecision"],
                    "recipientScope": scope,
                    "current": True,
                    "expiresAt": expiry,
                    "operations": ["read", "export"],
                    "subjectId": requester["subjectId"],
                    "usagePolicy": {
                        "id": "policy.reviewed-business-artifact",
                        "version": "r1",
                    },
                    "retentionPolicy": records["context"]["retention"]["policy"],
                }
                task = {
                    **records["task"],
                    "scope": scope,
                    "inputs": [receipt["work"]["artifact"]],
                }
                requirements = {
                    "audience": "Owner",
                    "purpose": "Offline fixture review",
                    "templateId": "private-review-v1",
                    "disclosures": ["Fixture; not certification"],
                }
                policy = {
                    "version": "0.1.0",
                    "id": "review.reporter",
                    "revision": "r1",
                    "task": task,
                    "requester": requester,
                    "reviewerIds": ["human-owner"],
                    "operation": "release_report",
                    "destination": "private-reviewed-reports",
                    "expiresAt": expiry,
                    "grantTtlSeconds": 600,
                    "maxPacketBytes": 2_000_000,
                    "maxRecords": 20,
                    "requiredGates": [
                        "no-blockers",
                        "evidence-present",
                        "eval-present",
                    ],
                    "allowedUsagePolicies": [receipt["usagePolicy"]],
                    "contextPolicy": records["context"]["contextPolicy"],
                    "retentionPolicy": records["context"]["retention"]["policy"],
                    "revoked": False,
                }
                configuration = {
                    "version": "0.1.0",
                    "sourceAuthority": "operator-attested-export",
                    "directory": "/run/operator/review-" + provider,
                    "policy": policy,
                    "requirements": requirements,
                    "sources": [receipt],
                    "localReviewer": {"uid": os.getuid(), "subjectId": "human-owner"},
                    "sensitiveFiles": ["/run/client/access-token"],
                    "qualificationConfigFile": "/run/operator/qualification.json",
                    "contextMetadataGrants": [
                        {
                            "workRef": receipt["work"]["artifact"],
                            "evidence": receipt["work"]["evidence"][0],
                            "subjectId": requester["subjectId"],
                            "recipientScope": scope,
                            "operations": ["read", "export"],
                            "current": True,
                            "expiresAt": expiry,
                        }
                    ],
                }
                qualification = operator / ("qualification-" + provider)
                qualification.mkdir(mode=0o700)
                owned(
                    operator / "qualification.json",
                    {
                        "schemaVersion": "0.1.0",
                        "pythonExecutable": "/opt/reference/tool/.venv/bin/python",
                        "evidenceDirectory": "/run/operator/" + qualification.name,
                        "policyFile": "/run/operator/"
                        + qualification.name
                        + "/policy.json",
                        "codeRevision": manifest["codeRevision"],
                        "caseId": "control_source_faithful",
                    },
                )
                owned(operator / "reporter.json", configuration)
                owned(
                    operator / "events.json",
                    {
                        "version": "0.1.0",
                        "required": True,
                        "context": {
                            "runId": "container-" + provider,
                            "traceId": "1" * 32,
                            "scope": scope,
                            "taskRevision": task["revision"],
                            "qualification": "fixture",
                        },
                        "producer": {"id": "reporter", "version": "0.1.0"},
                        "jsonlFile": "/run/operator/events-" + provider + ".jsonl",
                    },
                )
                owned(
                    operator / "http.json",
                    {
                        "reporterConfigFile": "/run/operator/reporter.json",
                        "accessTokenFile": "/run/client/access-token",
                        "eventConfigFile": "/run/operator/events.json",
                        "dataPath": "/run/operator/tools-" + provider,
                    },
                )
                endpoint = start()
                # Runtime ownership is verified independently of the Dockerfile's declared user.
                assert invoke(
                    "docker", "exec", "--user", uid, name, "id", "-u"
                ).strip() == str(os.getuid())
                invoke(
                    "docker",
                    "run",
                    "--rm",
                    *common,
                    name + "-reporter-agent",
                    "python",
                    "-I",
                    "-c",
                    "import os; assert not os.path.exists('/run/operator'); from app.agent import root_agent; assert not root_agent.sub_agents",
                )
                job = {
                    "task": task,
                    "requirements": requirements,
                    "subjectId": requester["subjectId"],
                    "provider": provider,
                    "tokenFile": "/run/client/access-token",
                    "contextDirectory": "/run/state/context-" + provider,
                    "contextPolicy": policy["contextPolicy"],
                    "retentionPolicy": policy["retentionPolicy"],
                    "expiresAt": expiry,
                }
                employee("pair", "candidate-" + provider + ".json")
                candidate = json.loads(
                    (state / ("candidate-" + provider + ".json")).read_text()
                )
                pending = protocol(
                    "prepare_review",
                    {"candidate": candidate, "expectedHead": None},
                    "pending-" + provider + ".json",
                )
                protocol(
                    "release_report",
                    {
                        "reviewId": pending["reviewId"],
                        "packetDigest": pending["packetDigest"],
                        "grantId": "grant.forged",
                    },
                    "denied-" + provider + ".json",
                    True,
                )
                packet = "/run/operator/packet-" + provider + ".json"
                review("inspect", pending["reviewId"], packet)
                owned(
                    operator / "reason.json",
                    {
                        "reason": "Offline operator fixture review; no professional acceptance"
                    },
                )
                review(
                    "decide",
                    pending["reviewId"],
                    pending["packetDigest"],
                    "request_changes",
                    "/run/operator/reason.json",
                )
                requirements["purpose"] = "Revised offline fixture review"
                owned(operator / "reporter.json", configuration)
                job["contextDirectory"] += "-revised"
                employee("pair", "revised-candidate-" + provider + ".json")
                candidate = json.loads(
                    (state / ("revised-candidate-" + provider + ".json")).read_text()
                )
                previous_digest = pending["packetDigest"]
                pending = protocol(
                    "prepare_review",
                    {"candidate": candidate, "expectedHead": previous_digest},
                    "revised-pending-" + provider + ".json",
                )
                assert pending["packetDigest"] != previous_digest
                packet = "/run/operator/revised-packet-" + provider + ".json"
                review("inspect", pending["reviewId"], packet)
                review(
                    "decide",
                    pending["reviewId"],
                    pending["packetDigest"],
                    "approve",
                    "/run/operator/reason.json",
                    expected=1,
                )
                invoke(
                    "docker",
                    "exec",
                    "--user",
                    uid,
                    name,
                    "/opt/reference/tool/.venv/bin/python",
                    "-I",
                    "/opt/reference/tool/checks/eval/run_fixture_evals.py",
                    "--packet",
                    packet,
                    "--evidence-directory",
                    "/run/operator/" + qualification.name,
                    "--output",
                    "/run/operator/qualification-result-" + provider + ".json",
                    "--code-revision",
                    manifest["codeRevision"],
                )
                review(
                    "decide",
                    pending["reviewId"],
                    pending["packetDigest"],
                    "approve",
                    "/run/operator/reason.json",
                )
                job.update(work=candidate["work"], reviewId=pending["reviewId"])
                stop()
                endpoint = start()
                employee("resume", "completed-" + provider + ".json")
                completed = json.loads(
                    (state / ("completed-" + provider + ".json")).read_text()
                )
                assert (
                    completed["state"] == "completed"
                    and completed["outcome"]["stored"] is True
                )
                receipt["current"] = False
                owned(operator / "reporter.json", configuration)
                protocol(
                    "release_report",
                    {
                        "reviewId": pending["reviewId"],
                        "packetDigest": pending["packetDigest"],
                        "grantId": completed["grantId"],
                    },
                    "revoked-" + provider + ".json",
                    True,
                )
                employee("revoked", "unused-" + provider + ".json")
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
            f"Reporter container qualification blocked at {stage}: {type(error).__name__}",
            file=sys.stderr,
        )
        return 1
    finally:
        if started:
            subprocess.run(
                ["docker", "rm", "-f", name], capture_output=True, check=False
            )
        output.write_text(json.dumps(decision, indent=2) + "\n")


if __name__ == "__main__":
    raise SystemExit(main())
