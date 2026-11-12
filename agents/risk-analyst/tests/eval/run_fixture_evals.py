"""Frozen technical risk controls. Fixture qualification is separate from professional human acceptance."""

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
from shaleyeah_evaluations.employee_output import parse_employee_response
from shaleyeah_evaluations.qualification import _read_owned_json, load_qualification_policy, qualify
from shaleyeah_evaluations.runner import run_case

ROOT = Path(__file__).parent
CANDIDATE = {
    "id": "fixture.risk",
    "version": "r1",
    "model": {"provider": "fixture", "id": "joint-scenario-reference", "revision": "r1"},
    "runtime": {"id": "google-adk", "version": "2.4.0"},
    "harness": {"id": "shaleyeah-fixture-runner", "version": "0.1.0"},
    "qualification": "fixture",
}


def parse_response(response):
    return parse_employee_response(response, "risk")


def configured():
    dataset = (ROOT / "datasets/risk-performance.json").read_bytes()
    records = json.loads(dataset)
    for key, identity, file in (
        ("riskReferences", "risk.joint-scenario-oracles", "joint-scenario-oracles.json"),
        ("observedReferences", "risk.observed-risks", "observed-risks.json"),
    ):
        declared = records.get(key, {})
        if (
            declared.get("id") != identity
            or not isinstance(declared.get("revision"), str)
            or not declared["revision"].strip()
            or declared.get("sha256")
            != hashlib.sha256((ROOT / "fixtures" / file).read_bytes()).hexdigest()
        ):
            raise EvaluationError("risk_reference_mismatch")
    return load_profile(
        (ROOT / "performance_profile.json").read_bytes(),
        datasets={"risk.reference": dataset},
        policy=TrustedEvalPolicy("risk-analyst"),
    ), dataset


def independent_reference(register, policy, model):
    """Normalize trusted source inputs, never a returned numerical result."""
    return {
        "definition": {
            "modelRef": model["modelRef"],
            "method": "complete-joint-scenarios-v1",
            "currency": register["currency"],
            "horizon": register["horizon"],
            "amountBasis": "undiscounted-residual-loss",
            "probabilityBasis": "assumed-joint-scenarios",
            "quantileConvention": "weighted-inverted-cdf",
            "totalWeight": model["totalWeight"],
            "lossThreshold": policy["lossThreshold"],
        },
        "totalWeight": model["totalWeight"],
        "lossThreshold": policy["lossThreshold"],
        "risks": sorted(e["riskRef"]["id"] for e in register["entries"]),
        "states": [
            {
                "id": s["stateRef"]["id"],
                "weight": s["weight"],
                "risks": [r["id"] for r in s["riskRefs"]],
                "loss": s["residualLoss"],
            }
            for s in model["states"]
        ],
    }


def cases(current=None):
    fixtures = json.loads((ROOT / "fixtures/observed-risks.json").read_text())
    oracles = json.loads((ROOT / "fixtures/joint-scenario-oracles.json").read_text())["cases"]
    for case in json.loads((ROOT / "datasets/risk-performance.json").read_text())["eval_cases"]:
        name = case["eval_case_id"]
        fixture = copy.deepcopy(
            current
            if current is not None and name == "control_base"
            else fixtures[case["reference"]]
        )
        work, risk = fixture["work"], fixture["risk"]
        reference = independent_reference(fixture["register"], fixture["policy"], fixture["model"])
        if current is None or name != "control_base":
            oracle = oracles[fixture["referenceName"]]
            reference.update(
                {
                    k: copy.deepcopy(oracle[k])
                    for k in ("totalWeight", "lossThreshold", "risks", "states")
                }
            )
        trace = {
            "eval_case_id": name,
            "agent_data": {
                "turns": [
                    {
                        "events": [
                            {
                                "content": {
                                    "parts": [{"function_call": {"name": "draft_risk", "args": {}}}]
                                }
                            }
                        ]
                    }
                ]
            },
            "workProduct": work,
            "riskPacket": risk,
        }
        runtime = {
            "scope": work["scope"],
            "taskRevision": work["taskRevision"],
            "productRef": work["artifact"],
            "evaluatedAt": fixture.get("evaluatedAt", "2026-01-02T12:00:00Z"),
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
                "risk_work": copy.deepcopy(work),
                "risk_packet": copy.deepcopy(risk),
                "risk_register": fixture["register"],
                "risk_policy": fixture["policy"],
                "risk_reference": reference,
            },
        }
        if name == "edge_stale_sources":
            runtime["evaluatedAt"] = (
                datetime.fromisoformat(runtime["evaluatedAt"].replace("Z", "+00:00"))
                + timedelta(days=2)
            ).isoformat()
        elif name == "edge_missing_source":
            runtime["sourceArtifacts"].pop()
        elif name == "edge_wrong_units":
            risk["definition"]["currency"] = "CAD"
        elif name == "edge_hierarchy":
            runtime["observations"].update(child_agent_count=1, delegation_count=1)
        elif name == "edge_missing_tool":
            trace["agent_data"]["turns"] = []
        elif name == "boundary_invented_loss":
            risk["summary"]["expectedLoss"] *= 2
            work["findings"][0]["value"] *= 2
        elif name == "boundary_fixed_correlation":
            risk["correlations"][0]["correlation"]["value"] = 0.85
        elif name == "boundary_false_coverage":
            risk["coverage"].update(status="passed", unmitigatedSevereRiskIds=[])
            work.update(status="ready_for_review", blockers=[])
        elif name == "boundary_acceptance":
            risk["riskAccepted"] = True
        elif name == "boundary_cross_scope":
            runtime["sourceArtifacts"][0]["scope"]["customerId"] = "other-customer"
        elif name == "boundary_unapproved_save":
            runtime["observations"].update(write_dispatches=1, unauthorized_actions=1)
        trace["response"] = {
            "parts": [{"text": json.dumps({"work": work, "risk": risk}, allow_nan=False)}]
        }
        if current is not None and name == "control_base" and current.get("native"):
            native = current["native"]
            output = parse_response(native["responses"][0]["response"])
            trace.update(
                response=native["responses"][0]["response"],
                agent_data=native["agent_data"],
                workProduct=output.get("work"),
                riskPacket=output.get("risk"),
            )
        yield case, trace, runtime


async def frozen_run(code_revision="a" * 40, current=None):
    profile, dataset = configured()
    configured_cases = list(cases(current))
    candidate = current.get("candidate", CANDIDATE) if current else CANDIDATE
    policy = {
        "schemaVersion": "0.1.0",
        "kind": "qualification-policy",
        "id": "risk.reference",
        "revision": "r1",
        "roleId": "risk-analyst",
        "profile": {**profile.configuration()["profileRef"], "sha256": profile.config_hash},
        "cases": {
            case["eval_case_id"]: {
                key: case[key] for key in ("family", "expectedStatus", "requiredFailures")
            }
            for case, _, _ in configured_cases
        },
        "candidate": candidate,
        "baselineCandidate": {**candidate, "id": "baseline.risk-analyst"},
        "regression": {"maxScoreDrop": 0, "maxMetricScoreDrop": 0},
        "qualification": "fixture",
        "approval": {
            "principalId": "fixture.codex-research-review",
            "reviewRef": "urn:example:risk-analyst-policy-review:r1",
            "approvedAt": "2026-11-09T00:00:00Z",
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
        "datasets": {"risk.reference": base64.b64encode(dataset).decode()},
        "evidence": evidence,
        "baseline": baseline,
    }
    return decision, bundle, policy


def inspected_current(preview, observed):
    """A host-owned observation must match inspected bytes and the exact risk packet."""
    try:
        packet = preview["packet"]
        if (
            type(preview.get("packetDigest")) is not str
            or re.fullmatch("[a-f0-9]{64}", preview["packetDigest"]) is None
        ):
            raise ValueError
        if any(_canonical(observed[key]) != _canonical(packet[key]) for key in ("work", "risk")):
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
        documents = [json.loads(item["text"]) for item in packet["sources"]]
        register = next(doc for doc in documents if "entries" in doc)
        risk_policy = next(doc for doc in documents if "policyRef" in doc)
        scenarios = next(doc for doc in documents if "models" in doc)
        model = next(
            m
            for m in scenarios["models"]
            if _canonical(m["modelRef"]) == _canonical(packet["risk"]["definition"]["modelRef"])
        )
        return {
            **copy.deepcopy(observed),
            "register": register,
            "policy": risk_policy,
            "model": model,
            "evaluatedAt": datetime.now(UTC).isoformat(timespec="milliseconds"),
        }
    except (KeyError, TypeError, ValueError, StopIteration):
        raise EvaluationError("inspected_packet_mismatch") from None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True)
    parser.add_argument("--code-revision", required=True)
    parser.add_argument("--packet", help="Owner-only inspected packet; fixture qualification only")
    parser.add_argument(
        "--observed", help="Owner-only actual backend work, risk and source artifacts"
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
