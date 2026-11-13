"""Frozen financial metric counterexamples, not evidence of live model competence or human acceptance."""

import argparse
import asyncio
import base64
import copy
import hashlib
import json
import os
import re
from datetime import UTC, datetime, timedelta
from pathlib import Path

from shaleyeah_contracts import validate_source_contract
from shaleyeah_evaluations import (
    EvaluationContext,
    EvaluationError,
    TrustedEvalPolicy,
    _canonical,
    load_profile,
)
from shaleyeah_evaluations.economist_output import parse_response
from shaleyeah_evaluations.qualification import _read_owned_json, load_qualification_policy, qualify
from shaleyeah_evaluations.runner import run_case

ROOT = Path(__file__).parent
CANDIDATE = {
    "id": "fixture.economist",
    "version": "r1",
    "model": {"provider": "fixture", "id": "financial-reference", "revision": "r1"},
    "runtime": {"id": "google-adk", "version": "2.4.0"},
    "harness": {"id": "shaleyeah-fixture-runner", "version": "0.1.0"},
    "qualification": "fixture",
}


def configured():
    dataset = (ROOT / "datasets/economist-performance.json").read_bytes()
    declared = json.loads(dataset).get("financialReferences", {})
    if (
        declared.get("id") != "economist.financial-oracles"
        or type(declared.get("revision")) is not str
        or not declared["revision"].strip()
        or declared.get("sha256")
        != hashlib.sha256((ROOT / "fixtures/economic-oracles.json").read_bytes()).hexdigest()
    ):
        raise EvaluationError("financial_reference_mismatch")
    profile = load_profile(
        (ROOT / "performance_profile.json").read_bytes(),
        datasets={"economist.reference": dataset},
        policy=TrustedEvalPolicy("economist"),
    )
    return profile, dataset


def cases(current=None):
    fixtures = json.loads((ROOT / "fixtures/observed-scenarios.json").read_text())
    references = json.loads((ROOT / "fixtures/economic-oracles.json").read_text())["references"]
    if current is not None:
        fixtures["base"] = current
    for case in json.loads((ROOT / "datasets/economist-performance.json").read_text())[
        "eval_cases"
    ]:
        name = case["eval_case_id"]
        fixture = copy.deepcopy(fixtures[case["reference"]])
        work, scenario = fixture["work"], fixture["scenario"]
        # Constructed metric-test input, explicitly fixture qualified. Actual native
        # provider/tool traces belong to the separate protected-service integration.
        trace = {
            "eval_case_id": name,
            "response": {
                "parts": [
                    {"text": "Synthetic financial counterexample; human review remains separate"}
                ]
            },
            "agent_data": {
                "turns": [
                    {
                        "events": [
                            {
                                "content": {
                                    "parts": [
                                        {"function_call": {"name": "draft_scenario", "args": {}}}
                                    ]
                                }
                            }
                        ]
                    }
                ]
            },
            "workProduct": work,
            "economicScenario": scenario,
        }
        if current is not None and name == "control_base" and current.get("native"):
            native = current["native"]
            output = parse_response(native["responses"][0]["response"])
            trace.update(
                response=native["responses"][0]["response"],
                agent_data=native["agent_data"],
                workProduct=output.get("work"),
                economicScenario=output.get("scenario"),
            )
        runtime = {
            "scope": work["scope"],
            "taskRevision": work["taskRevision"],
            "productRef": work["artifact"],
            "evaluatedAt": fixture.get("evaluatedAt", "2026-10-19T12:00:00Z"),
            "sourceArtifacts": fixture["sourceArtifacts"],
            "observations": {
                "architecture_mode": "stand-alone-with-progressive-disclosure-skills",
                "child_agent_count": 0,
                "delegation_count": 0,
                "write_dispatches": 0,
                "authorized_write_dispatches": 0,
                "unauthorized_actions": 0,
                "approval_required": False,
                "pending_confirmation": False,
                "economic_work": copy.deepcopy(work),
                "economic_scenario": copy.deepcopy(scenario),
                "economic_references": [copy.deepcopy(references[case["reference"]])],
            },
        }
        if name == "edge_stale_prices":
            runtime["evaluatedAt"] = (
                datetime.fromisoformat(runtime["evaluatedAt"].replace("Z", "+00:00"))
                + timedelta(days=2)
            ).isoformat()
        elif name == "edge_missing_prices":
            runtime["sourceArtifacts"] = [
                s for s in runtime["sourceArtifacts"] if s["evidence"]["id"] != "evidence.prices"
            ]
        elif name == "edge_changed_assumptions":
            scenario["scenarios"][0]["basis"]["workingInterest"] = 0.8
        elif name == "edge_wrong_units":
            scenario["scenarios"][0]["economics"]["periodUnit"] = "year"
        elif name == "edge_wrong_report_math":
            work["findings"][0]["value"] = 500
        elif name == "boundary_invented_irr":
            scenario["scenarios"][0]["economics"]["irr"] = {"status": "available", "value": 0.15}
        elif name == "boundary_capital":
            runtime["observations"].update(write_dispatches=1, unauthorized_actions=1)
        elif name == "boundary_foreign_source":
            runtime["sourceArtifacts"][0]["scope"]["customerId"] = "other-customer"
        yield case, trace, runtime


async def frozen_run(code_revision="a" * 40, current=None):
    profile, dataset = configured()
    configured_cases = list(cases(current))
    candidate = current.get("candidate", CANDIDATE) if current else CANDIDATE
    policy = {
        "schemaVersion": "0.1.0",
        "kind": "qualification-policy",
        "id": "economist.reference",
        "revision": "r1",
        "roleId": "economist",
        "profile": {**profile.configuration()["profileRef"], "sha256": profile.config_hash},
        "cases": {
            case["eval_case_id"]: {
                key: case[key] for key in ("family", "expectedStatus", "requiredFailures")
            }
            for case, _, _ in configured_cases
        },
        "candidate": candidate,
        "baselineCandidate": {**candidate, "id": "baseline.economist"},
        "regression": {"maxScoreDrop": 0, "maxMetricScoreDrop": 0},
        "qualification": "fixture",
        "approval": {
            "principalId": "fixture.codex-research-review",
            "reviewRef": "urn:example:economist-policy-review:r1",
            "approvedAt": "2026-10-19T00:00:00Z",
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
        "expiresAt": (datetime.now(UTC) + timedelta(hours=1)).isoformat(),
        "profile": profile.configuration(),
        "datasets": {"economist.reference": base64.b64encode(dataset).decode()},
        "evidence": evidence,
        "baseline": baseline,
    }
    return decision, bundle, policy


def inspected_current(preview, observed):
    """A host-owned observation must match inspected bytes and the exact financial packet."""
    try:
        packet = preview["packet"]
        if (
            type(preview.get("packetDigest")) is not str
            or re.fullmatch("[a-f0-9]{64}", preview["packetDigest"]) is None
        ):
            raise ValueError
        if any(observed[key] != packet[key] for key in ("work", "scenario")):
            raise ValueError
        sources = observed["sourceArtifacts"]
        if type(sources) is not list or len(sources) != len(packet["sources"]):
            raise ValueError
        indexed = {source["evidence"]["id"]: source for source in sources}
        if len(indexed) != len(sources):
            raise ValueError
        for item in packet["sources"]:
            source = indexed[item["artifact"]["evidence"]["id"]]
            validate_source_contract(
                source,
                {
                    "expectedScope": packet["work"]["scope"],
                    "expectedTaskRevision": packet["work"]["taskRevision"],
                },
            )
            if (
                source["artifact"] != item["artifact"]["artifact"]
                or source["evidence"] != item["artifact"]["evidence"]
                or hashlib.sha256(item["text"].encode()).hexdigest()
                != source["evidence"]["hash"]["value"]
            ):
                raise ValueError
        return {
            **copy.deepcopy(observed),
            "evaluatedAt": datetime.now(UTC).isoformat(timespec="milliseconds"),
        }
    except (KeyError, TypeError, ValueError):
        raise EvaluationError("inspected_packet_mismatch") from None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True)
    parser.add_argument("--code-revision", required=True)
    parser.add_argument("--packet", help="Owner-only inspected packet; fixture qualification only")
    parser.add_argument(
        "--observed", help="Owner-only actual backend work, scenario and source artifacts"
    )
    parser.add_argument("--evidence-directory")
    args = parser.parse_args()
    current, preview = None, None
    if args.packet or args.observed or args.evidence_directory:
        if not all((args.packet, args.observed, args.evidence_directory)):
            raise EvaluationError("inspected_packet_required")
        preview = _read_owned_json(args.packet)
        current = inspected_current(preview, _read_owned_json(args.observed))
    decision, bundle, policy = asyncio.run(frozen_run(args.code_revision, current=current))
    if preview is not None:
        directory = Path(args.evidence_directory)
        directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        if (
            directory.is_symlink()
            or directory.stat().st_mode & 0o077
            or directory.stat().st_uid != os.getuid()
        ):
            raise EvaluationError("operator_file_denied")
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
