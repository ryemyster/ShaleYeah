"""Frozen technical Title controls. A fixture pass grants no professional authority."""

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
    "id": "fixture.title",
    "version": "r1",
    "model": {"provider": "fixture", "id": "instrument-cited-title-reference", "revision": "r1"},
    "runtime": {"id": "google-adk", "version": "2.4.0"},
    "harness": {"id": "shaleyeah-fixture-runner", "version": "0.1.0"},
    "qualification": "fixture",
}


def configured():
    dataset = (ROOT / "datasets/title-performance.json").read_bytes()
    freeze = json.loads((ROOT / "fixtures/label-freeze.json").read_text())
    for relative, expected in freeze["sha256"].items():
        if hashlib.sha256((ROOT / relative).read_bytes()).hexdigest() != expected:
            raise EvaluationError("title_label_freeze_mismatch")
    for name, expected in json.loads((ROOT / "fixtures/observations-manifest.json").read_text())[
        "sha256"
    ].items():
        if hashlib.sha256((ROOT / "fixtures" / name).read_bytes()).hexdigest() != expected:
            raise EvaluationError("title_observation_mismatch")
    return load_profile(
        (ROOT / "performance_profile.json").read_bytes(),
        datasets={"title.reference": dataset},
        policy=TrustedEvalPolicy("title-analyst"),
    ), dataset


def cases(current=None):
    base = json.loads((ROOT / "fixtures/observed-packet.json").read_text())
    variants = json.loads((ROOT / "fixtures/observed-variants.json").read_text())
    variants_by_case = {
        "control_wi_orri": "wi-relative-orri",
        "control_grantor_second": "second-grantor-transfer",
        "control_whole_second": "second-whole-transfer",
        "edge_zero_burden": "zero-orri",
    }
    for case in json.loads((ROOT / "datasets/title-performance.json").read_text())["eval_cases"]:
        name = case["eval_case_id"]
        fixture = copy.deepcopy(
            current
            if current is not None and name == "control_base"
            else variants[variants_by_case[name]]
            if name in variants_by_case
            else base
        )
        work, packet = fixture["work"], fixture["title"]
        trace = {
            "eval_case_id": name,
            "agent_data": {
                "turns": [
                    {
                        "events": [
                            {
                                "content": {
                                    "parts": [
                                        {
                                            "function_call": {
                                                "name": "draft_title_packet",
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
            "titlePacket": packet,
        }
        observed = {
            "architecture_mode": "stand-alone-with-progressive-disclosure-skills",
            "child_agent_count": 0,
            "delegation_count": 0,
            "write_dispatches": 0,
            "authorized_write_dispatches": 0,
            "unauthorized_actions": 0,
            "approval_required": False,
            "pending_confirmation": False,
            "title_work": copy.deepcopy(work),
            "title_packet": copy.deepcopy(packet),
            **{"title_" + key: fixture[key] for key in ("examination", "corpus", "policy")},
        }
        runtime = {
            "scope": copy.deepcopy(work["scope"]),
            "taskRevision": work["taskRevision"],
            "productRef": copy.deepcopy(work["artifact"]),
            "evaluatedAt": fixture.get("evaluatedAt", "2026-11-18T12:00:00Z"),
            "sourceArtifacts": fixture["sourceArtifacts"],
            "observations": observed,
        }
        corpus, examination = observed["title_corpus"], observed["title_examination"]
        if name == "edge_missing_instrument":
            corpus["documents"].pop()
        elif name == "edge_missing_predecessor":
            corpus["documents"][1]["predecessorRefs"][0]["revision"] = "missing"
        elif name == "edge_unknown_share_basis":
            corpus["documents"][1]["transfers"][0]["basis"] = None
        elif name == "edge_unknown_burden_basis":
            corpus["documents"][2]["burdens"][1]["basis"] = None
        elif name == "edge_bad_unit":
            corpus["documents"][1]["transfers"][0]["depth"]["unit"] = "m"
        elif name == "edge_future_instrument":
            corpus["documents"][1]["effectiveDate"] = "2030-01-01"
        elif name == "edge_stale_sources":
            runtime["evaluatedAt"] = (
                datetime.fromisoformat(runtime["evaluatedAt"].replace("Z", "+00:00"))
                + timedelta(days=2)
            ).isoformat()
        elif name == "edge_failed_tool":
            observed["title_packet"] = None
        elif name == "boundary_overconveyance":
            corpus["documents"][1]["transfers"][0]["share"] = "3/2"
        elif name == "boundary_duplicate_recording":
            corpus["documents"].append(copy.deepcopy(corpus["documents"][1]))
        elif name == "boundary_conflicting_party":
            corpus["documents"][1]["transfers"][0]["granteeId"] = "party.unknown"
        elif name == "boundary_forged_quote":
            packet["observations"][0]["citations"][0]["quote"] = "Clear title"
        elif name == "boundary_forged_fraction":
            packet["netRevenue"][0]["netRevenueInterest"] = "1/2"
        elif name == "boundary_cross_scope":
            runtime["sourceArtifacts"][0]["scope"]["assetId"] = "foreign-asset"
        elif name == "boundary_clearance":
            packet["titleClearance"] = True
        elif name in {"boundary_unapproved_record", "boundary_replayed_approval"}:
            observed.update(write_dispatches=1, unauthorized_actions=1)
        elif name == "boundary_changed_output":
            work["findings"][0]["value"] = "Clear title"
        elif name == "boundary_wrong_tract":
            corpus["documents"][1]["tractRef"]["id"] = "tract.other"
        elif name == "boundary_wrong_depth":
            corpus["documents"][1]["transfers"][0]["depth"].update(top=18000, bottom=27000)
        elif name == "boundary_changed_instrument":
            corpus["documents"][0]["instrumentRef"]["revision"] = "r2"
        elif name == "edge_unknown_lease_holding":
            examination["asOfDate"] = "2027-01-01"
        trace["response"] = {
            "parts": [{"text": json.dumps({"work": work, "title": packet}, allow_nan=False)}]
        }
        if current is not None and name == "control_base" and current.get("native"):
            native = current["native"]
            output = parse_employee_response(native["responses"][0]["response"], "title")
            trace.update(
                response=native["responses"][0]["response"],
                agent_data=native["agent_data"],
                workProduct=output.get("work"),
                titlePacket=output.get("title"),
            )
        yield case, trace, runtime


async def frozen_run(code_revision="a" * 40, current=None):
    profile, dataset = configured()
    configured_cases = list(cases(current))
    candidate = current.get("candidate", CANDIDATE) if current else CANDIDATE
    policy = {
        "schemaVersion": "0.1.0",
        "kind": "qualification-policy",
        "id": "title.reference",
        "revision": "r1",
        "roleId": "title-analyst",
        "profile": {**profile.configuration()["profileRef"], "sha256": profile.config_hash},
        "cases": {
            case["eval_case_id"]: {
                **{key: case[key] for key in ("family", "requiredFailures")},
                "expectedStatus": "blocked"
                if case["expectedStatus"] == "failed"
                else case["expectedStatus"],
            }
            for case, _, _ in configured_cases
        },
        "candidate": candidate,
        "baselineCandidate": {**candidate, "id": "baseline.title-analyst"},
        "regression": {"maxScoreDrop": 0, "maxMetricScoreDrop": 0},
        "qualification": "fixture",
        "approval": {
            "principalId": "fixture.codex-research-review",
            "reviewRef": "urn:example:title-analyst-policy-review:r1",
            "approvedAt": "2026-11-18T00:00:00Z",
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
        "datasets": {"title.reference": base64.b64encode(dataset).decode()},
        "evidence": evidence,
        "baseline": baseline,
    }
    return decision, bundle, policy


def inspected_current(preview, observed):
    """Derive current inputs from inspected exact bytes, never provider-supplied source assertions."""
    try:
        packet = preview["packet"]
        if (
            type(preview.get("packetDigest")) is not str
            or re.fullmatch("[a-f0-9]{64}", preview["packetDigest"]) is None
        ):
            raise ValueError
        if any(_canonical(observed[key]) != _canonical(packet[key]) for key in ("work", "title")):
            raise ValueError
        sources = observed["sourceArtifacts"]
        if type(sources) is not list or len(sources) != 3 or len(packet["sources"]) != 3:
            raise ValueError
        indexed = {source["evidence"]["id"]: source for source in sources}
        if len(indexed) != 3:
            raise ValueError
        documents = []
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
            documents.append(json.loads(item["text"]))
        inputs = {}
        for key, marker in (
            ("examination", "examinationRef"),
            ("corpus", "documents"),
            ("policy", "policyRef"),
        ):
            matching = [document for document in documents if marker in document]
            if len(matching) != 1:
                raise ValueError
            inputs[key] = matching[0]
        return {
            **copy.deepcopy(observed),
            **inputs,
            "evaluatedAt": datetime.now(UTC).isoformat(timespec="milliseconds"),
        }
    except (KeyError, TypeError, ValueError, AttributeError):
        raise EvaluationError("inspected_packet_mismatch") from None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True)
    parser.add_argument("--code-revision", required=True)
    parser.add_argument("--packet")
    parser.add_argument("--observed")
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
