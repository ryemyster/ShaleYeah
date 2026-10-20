"""Qualify separate installed Economist/Econobot images using synthetic financial inputs."""

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path
from secrets import token_urlsafe
from tempfile import TemporaryDirectory


def invoke(*command, expected=0, timeout=600):
    result = subprocess.run(
        [str(item) for item in command], capture_output=True, text=True, timeout=timeout, check=False
    )
    if result.returncode != expected:
        raise RuntimeError(f"Subprocess exited {result.returncode}; expected {expected}")
    return result.stdout


def owned(file, value):
    descriptor = os.open(file, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, "w") as handle:
        handle.write(value if isinstance(value, str) else json.dumps(value))


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
        "schemaVersion": "0.1.0", "status": "blocked", "qualification": "fixture",
        "professionalAcceptance": False, "controls": [], "images": {}, "failures": [],
    }
    name = "shale-economist-" + hashlib.sha256(str(output).encode()).hexdigest()[:12]
    stage, started, built = "container_runtime_unavailable", False, []
    try:
        assert os.getuid() != 0, "Qualification requires a non-root operating user"
        info = json.loads(invoke("docker", "info", "--format", "{{json .}}", timeout=30))
        assert info.get("ServerVersion") and info.get("OSType") == "linux" and info.get("Architecture")
        assert not info.get("ServerErrors")
        stage = "extraction_binding_failed"
        manifest = json.loads((bundle / "manifest.json").read_text())
        assert manifest["status"] == "passed" and manifest["professionalAcceptance"] is False
        for file, key in (
            (next((bundle / "npm").glob("shaleyeah-server-econobot-*.tgz")), "artifactSha256"),
            (next((bundle / "wheels").glob("shaleyeah_economist_adk-*.whl")), "employeeArtifactSha256"),
            (bundle / "requirements-employee.txt", "employeeLockSha256"),
            (bundle / "requirements-tool.txt", "verifierLockSha256"),
            (bundle / "tool/package-lock.json", "productionLockSha256"),
        ):
            assert fingerprint(file) == manifest[key]
            decision[key] = manifest[key]
        decision["codeRevision"] = manifest["codeRevision"]
        stage = "container_build_failed"
        bases = {}
        for unit, tag in (("node", "node:22-bookworm-slim"), ("python", "python:3.12-slim-bookworm")):
            invoke("docker", "pull", tag)
            bases[unit] = json.loads(invoke("docker", "image", "inspect", tag))[0]["RepoDigests"][0]
            assert "@sha256:" in bases[unit]
        decision["baseImages"] = bases
        repo = Path(__file__).resolve().parents[3]
        for unit, recipe in (("tool", "servers/econobot/Dockerfile"), ("employee", "agents/economist/Dockerfile")):
            invoke("docker", "build", "--build-arg", "PYTHON_IMAGE=" + bases["python"],
                   "--build-arg", "NODE_IMAGE=" + bases["node"], "-f", repo / recipe,
                   "-t", name + "-" + unit, bundle)
            built.append(name + "-" + unit)
            image = json.loads(invoke("docker", "image", "inspect", name + "-" + unit))[0]
            assert image["Config"]["User"] == "10001:10001"
            decision["images"][unit] = {
                "id": image["Id"], "user": image["Config"]["User"],
                "architecture": image["Architecture"], "os": image["Os"],
            }
        with TemporaryDirectory(prefix="economist-installed-pair-") as temporary:
            root = Path(temporary)
            operator, client, state = (root / folder for folder in ("operator", "client", "state"))
            for folder in (operator, client, state):
                folder.mkdir(mode=0o700)
            shutil.copytree(bundle / "pair/inputs", operator / "inputs")
            shutil.copyfile(bundle / "pair/access-key", operator / "access-key")
            (operator / "access-key").chmod(0o600)
            owned(client / "access-token", token_urlsafe(32))
            uid = f"{os.getuid()}:{os.getgid()}"
            common = ["--user", uid, "--read-only", "--cap-drop", "ALL", "--security-opt",
                      "no-new-privileges", "--tmpfs", "/tmp:rw,nosuid,nodev,size=64m"]
            mounts = ["--mount", f"type=bind,src={bundle / 'checks'},dst=/opt/econobot/tool/checks,readonly",
                      "--mount", f"type=bind,src={client},dst=/run/client,readonly"]

            def stop():
                nonlocal started
                invoke("docker", "stop", "--time", "10", name)
                invoke("docker", "rm", name)
                started = False

            def start():
                nonlocal started
                invoke("docker", "run", "-d", "--name", name, *common, *mounts,
                       "--mount", f"type=bind,src={operator},dst=/run/operator",
                       "-e", "PORT=0", "-e", "ECONOBOT_HTTP_CONFIG_FILE=/run/operator/http.json", name + "-tool")
                started = True
                for _ in range(60):
                    logs = subprocess.run(["docker", "logs", name], capture_output=True, text=True, check=True)
                    match = re.search(r"HTTP transport listening on port (\d+)", logs.stdout + logs.stderr)
                    if match:
                        return f"http://127.0.0.1:{match.group(1)}/mcp"
                    assert json.loads(invoke("docker", "inspect", name))[0]["State"]["Running"]
                    time.sleep(0.2)
                raise RuntimeError("Tool container startup deadline")

            def protocol(tool, arguments, file, error=False):
                owned(client / "request.json", {
                    "tokenFile": "/run/client/access-token", "name": tool, "arguments": arguments,
                    "outputFile": "/run/operator/" + file, "expectError": error,
                    "correlation": {"context": {"scope": config["task"]["scope"], "taskRevision": config["task"]["revision"],
                                               **config["correlation"], "qualification": "fixture"},
                                    "parentEventId": "generic." + token_urlsafe(12), "spanId": "1" * 16},
                })
                invoke("docker", "exec", "--user", uid, name, "node", "/opt/econobot/tool/checks/generic-client.mjs",
                       "/run/client/request.json", endpoint)
                return json.loads((operator / file).read_text()).get("structuredContent", {}).get("analysis")

            def review(*arguments, expected=0):
                return invoke("docker", "exec", "--user", uid, "-e", "ECONOBOT_CONFIG_FILE=/run/operator/economic.json",
                              name, "node", "/opt/econobot/tool/node_modules/@shaleyeah/server-econobot/examples/review.mjs",
                              *arguments, expected=expected)

            def employee(mode, file):
                job["mode"] = mode
                owned(client / "job.json", job)
                invoke("docker", "run", "--rm", "--network", "container:" + name, *common, *mounts,
                       "--mount", f"type=bind,src={state},dst=/run/state", name + "-employee", "python", "-I",
                       "/opt/econobot/tool/checks/fixtures/context-step.py", "/run/client/job.json", "/run/state/" + file, endpoint)
                return json.loads((state / file).read_text())

            for provider in ("gemini", "anthropic"):
                fixture = json.loads((bundle / f"pair/{provider}.json").read_text())
                config, job = fixture["config"], fixture["settings"]
                config["localOperator"]["uid"] = os.getuid()
                config["review"]["localReviewer"]["uid"] = os.getuid()
                owned(operator / "economic.json", config)
                owned(operator / "http.json", {
                    "economicConfigFile": "/run/operator/economic.json", "accessTokenFile": "/run/client/access-token",
                    "eventConfigFile": "/run/operator/events.json", "dataPath": f"/run/operator/transport-{provider}",
                })
                owned(operator / "events.json", {
                    "version": "0.1.0", "required": True, "timeoutMs": 5000,
                    "context": {"scope": job["task"]["scope"], "taskRevision": job["task"]["revision"],
                                **job["correlation"], "qualification": "fixture"},
                    "producer": {"id": "econobot", "version": "0.1.0"}, "jsonlFile": f"/run/operator/http-{provider}.jsonl",
                })
                stage = "tool_container_start_failed"
                endpoint = start()
                assert int(invoke("docker", "exec", "--user", uid, name, "id", "-u").strip()) == os.getuid()
                stage = "employee_isolation_failed"
                invoke("docker", "run", "--rm", *common, name + "-employee", "python", "-I", "-c",
                       "import os; assert not os.path.exists('/run/operator'); from app.agent import root_agent; assert root_agent.name == 'economist'")
                stage = "native_analysis_failed"
                actual = employee("pair", provider + "-prepared.json")
                assert actual["grade"]["status"] == "passed"
                assert actual["grade"]["candidate"]["model"]["provider"] == provider
                pending = actual["pending"]
                stage = "forged_save_guard_failed"
                protocol("record_scenario", {"reviewId": pending["reviewId"], "packetDigest": pending["packetDigest"],
                                             "grantId": "grant.forged"}, provider + "-forged.json", True)
                stage = "owner_inspection_failed"
                packet = f"/run/operator/{provider}-packet.json"
                review("inspect", pending["reviewId"], packet)
                owned(operator / "reason.json", {"reason": "Reviewed synthetic inputs and actual employee work; no capital commitment"})
                stage = "unqualified_approval_guard_failed"
                review("decide", pending["reviewId"], pending["packetDigest"], "approve", "/run/operator/reason.json", expected=1)
                owned(operator / "observed.json", actual)
                evidence = f"/run/operator/evidence-{provider}"
                stage = "installed_actual_output_qualification_failed"
                invoke("docker", "exec", "--user", uid, name, "/opt/econobot/tool/.venv/bin/python", "-I",
                       "/opt/econobot/tool/checks/eval/run_fixture_evals.py", "--packet", packet,
                       "--observed", "/run/operator/observed.json", "--evidence-directory", evidence,
                       "--output", f"/run/operator/{provider}-qualification.json", "--code-revision", manifest["codeRevision"])
                owned(operator / "qualification.json", {
                    "schemaVersion": "0.1.0", "pythonExecutable": "/opt/econobot/tool/.venv/bin/python",
                    "evidenceDirectory": evidence, "policyFile": evidence + "/policy.json",
                    "codeRevision": manifest["codeRevision"], "caseId": "control_base",
                })
                stage = "qualified_owner_approval_failed"
                review("decide", pending["reviewId"], pending["packetDigest"], "approve", "/run/operator/reason.json")
                job["reviewId"] = pending["reviewId"]
                stage = "tool_restart_failed"
                stop()
                endpoint = start()
                stage = "native_resume_replay_failed"
                completed = employee("resume", provider + "-completed.json")
                assert completed["state"] == "completed" and completed["outcome"]["stored"] is True
                assert completed["pendingReviewRefs"] == []
                config["connectorConfiguration"]["grant"]["revoked"] = True
                owned(operator / "economic.json", config)
                stage = "revoked_context_guard_failed"
                assert employee("revoked", provider + "-revoked.json")["modelContacted"] is False
                stop()
                decision["controls"].append({"id": provider + "-native-graded-review-restart-replay-revocation", "status": "passed"})
        decision["status"] = "passed"
        return 0
    except (OSError, RuntimeError, AssertionError, ValueError, KeyError, StopIteration, subprocess.SubprocessError) as error:
        decision["failures"].append(stage)
        print(f"Economist container qualification blocked at {stage}: {type(error).__name__}", file=sys.stderr)
        return 1
    finally:
        if started:
            subprocess.run(["docker", "rm", "-f", name], capture_output=True, check=False)
        for image in built:
            subprocess.run(["docker", "image", "rm", image], capture_output=True, check=False)
        output.write_text(json.dumps(decision, indent=2) + "\n")


if __name__ == "__main__":
    raise SystemExit(main())
