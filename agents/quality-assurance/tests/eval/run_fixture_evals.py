"""Qualify provisional QA counterexamples against immutable backend observations."""

import argparse
import asyncio
import base64
import copy
import json
import os
from datetime import UTC, datetime, timedelta
from pathlib import Path

from shaleyeah_evaluations import EvaluationContext, TrustedEvalPolicy, _canonical, load_profile
from shaleyeah_evaluations.qualification import load_qualification_policy, qualify
from shaleyeah_evaluations.runner import run_case

ROOT = Path(__file__).parent
CANDIDATE = {
    "id": "fixture.qa",
    "version": "r1",
    "model": {"provider": "fixture", "id": "backend-observed", "revision": "r1"},
    "runtime": {"id": "google-adk", "version": "2.4.0"},
    "harness": {"id": "shaleyeah-fixture-runner", "version": "0.1.0"},
    "qualification": "fixture",
}


def configured():
    dataset = (ROOT / "datasets/qa-performance.json").read_bytes()
    profile = load_profile(
        (ROOT / "performance_profile.json").read_bytes(),
        datasets={"qa.reference": dataset},
        policy=TrustedEvalPolicy("quality-assurance"),
    )
    return profile, dataset


def cases(fixtures=None):
    fixtures = fixtures or json.loads((ROOT / "fixtures/observed-reports.json").read_text())
    for case in json.loads((ROOT / "datasets/qa-performance.json").read_text())["eval_cases"]:
        name = case["eval_case_id"]
        fixture = fixtures[
            "pass"
            if name == "control_observed_pass"
            else "missing-reference"
            if name == "edge_missing_reference" and "missing-reference" in fixtures
            else "failure"
        ]
        report = copy.deepcopy(fixture["report"])
        work = copy.deepcopy(fixture.get("work", report["work"]))
        trace = {
            "eval_case_id": name,
            "response": {
                "parts": [
                    {"text": "Observed QA verdict retained; owner disposition review required"}
                ]
            },
            "agent_data": {
                "turns": [
                    {
                        "events": [
                            {
                                "content": {
                                    "parts": [
                                        {
                                            "function_call": {
                                                "name": "read_quality_report",
                                                "args": {},
                                            }
                                        }
                                    ]
                                }
                            }
                        ]
                    }
                ]
            },
            "workProduct": work,
            "qualityReport": report,
        }
        runtime = {
            "scope": work["scope"],
            "taskRevision": work["taskRevision"],
            "productRef": work["artifact"],
            "evaluatedAt": fixture.get("evaluatedAt", "2026-10-13T00:00:00Z"),
            "sourceArtifacts": copy.deepcopy(fixture["sourceArtifacts"]),
            "observations": {
                "architecture_mode": "stand-alone-with-progressive-disclosure-skills",
                "child_agent_count": 0,
                "delegation_count": 0,
                "write_dispatches": 0,
                "authorized_write_dispatches": 0,
                "unauthorized_actions": 0,
                "approval_required": False,
                "pending_confirmation": False,
                "qa_observed_report": copy.deepcopy(report),
            },
        }
        if name in {"edge_missing_reference", "boundary_exception_not_repair"}:
            report["summary"]["status"] = "PASS"
        elif name == "edge_changed_revision":
            report["resultRef"]["revision"] = "r2"
        elif name == "boundary_self_waiver":
            runtime["observations"].update(write_dispatches=1, unauthorized_actions=1)
        elif name == "boundary_confidential_source":
            runtime["sourceArtifacts"] = []
        yield case, trace, runtime


async def frozen_run(code_revision="a" * 40, fixtures=None):
    profile, dataset = configured()
    configured_cases = list(cases(fixtures))
    policy = {
        "schemaVersion": "0.1.0",
        "kind": "qualification-policy",
        "id": "qa.reference",
        "revision": "r1",
        "roleId": "quality-assurance",
        "profile": {**profile.configuration()["profileRef"], "sha256": profile.config_hash},
        "cases": {
            case["eval_case_id"]: {
                key: case[key] for key in ("family", "expectedStatus", "requiredFailures")
            }
            for case, _, _ in configured_cases
        },
        "candidate": CANDIDATE,
        "baselineCandidate": {**CANDIDATE, "id": "baseline.qa"},
        "regression": {"maxScoreDrop": 0, "maxMetricScoreDrop": 0},
        "qualification": "fixture",
        "approval": {
            "principalId": "fixture.codex-research-review",
            "reviewRef": "urn:example:qa-policy-review:r1",
            "approvedAt": "2026-10-13T00:00:00Z",
        },
    }
    evidence, baseline = [], []
    for _, trace, runtime in configured_cases:
        context = EvaluationContext.from_trusted_runtime(
            scope=runtime["scope"],
            task_revision=runtime["taskRevision"],
            product_ref=runtime["productRef"],
            evaluated_at=runtime["evaluatedAt"],
            source_artifacts=runtime["sourceArtifacts"],
            observations=runtime["observations"],
        )
        for identity, destination in (
            (policy["candidate"], evidence),
            (policy["baselineCandidate"], baseline),
        ):
            report = await run_case(
                profile=profile, trace=trace, context=context, candidate=identity
            )
            destination.append({"report": report, "trace": trace, "runtime": runtime})
    decision = qualify(
        profile=profile,
        policy=load_qualification_policy(policy),
        evidence=evidence,
        baseline=baseline,
        code_revision=code_revision,
    )
    bundle = {
        "schemaVersion": "0.1.0",
        "kind": "qualification-evidence",
        "codeRevision": code_revision,
        "expiresAt": "2026-11-01T00:00:00Z",
        "profile": profile.configuration(),
        "datasets": {"qa.reference": base64.b64encode(dataset).decode()},
        "evidence": evidence,
        "baseline": baseline,
    }
    return decision, bundle, policy


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True)
    parser.add_argument("--code-revision", required=True)
    parser.add_argument(
        "--packet", help="Owner-only inspected QA packet; fixture qualification only"
    )
    parser.add_argument("--evidence-directory")
    args = parser.parse_args()
    fixtures, preview = None, None
    if args.packet:
        from shaleyeah_evaluations.qualification import _read_owned_json

        preview = _read_owned_json(args.packet)
        packet = preview["packet"]
        report = packet["disposition"]["observedReport"]
        artifacts = []
        for source in packet["sources"]:
            evidence = source["artifact"]["evidence"]
            artifacts.append(
                {
                    "kind": "source-artifact",
                    "contractVersion": "0.2.0",
                    "scope": packet["work"]["scope"],
                    "taskRevision": packet["work"]["taskRevision"],
                    "connectorRef": {"id": "connector.qa", "revision": "r1"},
                    "adapterRef": {"id": "operator-file", "version": "0.1.0"},
                    "sourceKind": "operator-file",
                    "evidence": evidence,
                    "artifact": {
                        "id": evidence["id"],
                        "revision": evidence["hash"]["value"],
                        "uri": "urn:sha256:" + evidence["hash"]["value"],
                    },
                    "retrievedAt": datetime.now(UTC).isoformat(timespec="milliseconds"),
                    "format": "json",
                    "parserRef": {"id": "normalized-qa-data", "version": "0.1.0"},
                    "jurisdiction": "operator-configured",
                    "units": [],
                    "byteLength": len(source["text"].encode()),
                    "accessNotes": "Current protected QA export",
                    "licenseNotes": "Owner attested; no redistribution",
                    "revisionOrigin": "operator-declared",
                }
            )
        fixture = {
            "report": report,
            "work": packet["work"],
            "sourceArtifacts": artifacts,
            "evaluatedAt": datetime.now(UTC).isoformat(timespec="milliseconds"),
        }
        from shaleyeah_contracts import validate_source_contract

        for artifact in artifacts:
            validate_source_contract(artifact)
        fixtures = {"pass": fixture, "failure": fixture}
    decision, bundle, policy = asyncio.run(frozen_run(args.code_revision, fixtures))
    if args.evidence_directory:
        if preview is None:
            raise ValueError("An exact operator packet is required")
        directory = Path(args.evidence_directory)
        directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        if directory.stat().st_mode & 0o077 or directory.stat().st_uid != os.getuid():
            raise ValueError("An owned private evidence directory is required")
        bundle["expiresAt"] = preview["packet"]["expiresAt"]
        policy["approval"]["approvedAt"] = (datetime.now(UTC) - timedelta(seconds=1)).isoformat()
        for file, value in (
            (directory / (preview["packetDigest"] + ".json"), bundle),
            (directory / "policy.json", policy),
        ):
            descriptor = os.open(file, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
            with os.fdopen(descriptor, "w") as handle:
                handle.write(_canonical(value) + "\n")
                handle.flush()
                os.fsync(handle.fileno())
    target = Path(args.output)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(_canonical(decision) + "\n")
    return 0 if decision["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
