"""Private, installed Market verifier evidence; fixture qualification grants no commercial authority."""

import argparse
import asyncio
import base64
import copy
import hashlib
import importlib.util
import json
import os
import re
from datetime import UTC, datetime, timedelta
from pathlib import Path

from shaleyeah_contracts import validate_source_contract
from shaleyeah_evaluations import EvaluationError, _canonical
from shaleyeah_evaluations.employee_output import parse_employee_response
from shaleyeah_evaluations.qualification import _read_owned_json, load_qualification_policy, qualify
from shaleyeah_evaluations.runner import run_case

ROOT = Path(__file__).resolve().parent
# Explicit trusted sibling loading works under python -I, without adding a checkout to sys.path.
_spec = importlib.util.spec_from_file_location(
    "market_qualification_fixtures", ROOT / "fixture_cases.py"
)
_fixtures = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_fixtures)


async def frozen_run(code_revision, current=None):
    loaded = _fixtures.profile()
    dataset = (ROOT / "datasets/market-performance.json").read_bytes()
    candidate = copy.deepcopy(
        current.get("candidate", _fixtures.IDENTITY) if current else _fixtures.IDENTITY
    )
    policy = {
        "schemaVersion": "0.1.0",
        "kind": "qualification-policy",
        "id": "market.reference",
        "revision": "r1",
        "roleId": "market-analyst",
        "profile": {**loaded.configuration()["profileRef"], "sha256": loaded.config_hash},
        "cases": {
            case["id"]: {key: case[key] for key in ("family", "expectedStatus", "requiredFailures")}
            for case in _fixtures.LABELS["cases"]
        },
        "candidate": candidate,
        "baselineCandidate": {**candidate, "id": "baseline.market-analyst"},
        "regression": {"maxScoreDrop": 0, "maxMetricScoreDrop": 0},
        "qualification": "fixture",
        "approval": {
            "principalId": "fixture.codex-research-review",
            "reviewRef": "urn:example:market-analyst-policy-review:r1",
            "approvedAt": "2026-11-13T00:00:00Z",
        },
    }
    evidence, baseline = [], []
    for case in _fixtures.LABELS["cases"]:
        native, context, _ = _fixtures.fixture(case, current)
        responses = native["responses"]
        if len(responses) != 1:
            raise EvaluationError("invalid_adk_trace")
        response = responses[0]["response"]
        output = parse_employee_response(response, "market")
        trace = {
            "eval_case_id": case["id"],
            "response": response,
            "agent_data": native.get("agent_data", {}),
            "workProduct": output.get("work"),
            "marketScenario": output.get("market"),
        }
        for identity, destination in (
            (candidate, evidence),
            (policy["baselineCandidate"], baseline),
        ):
            report = await run_case(
                profile=loaded, trace=trace, context=context, candidate=identity
            )
            destination.append(
                {"report": report, "trace": copy.deepcopy(trace), "runtime": context.data()}
            )
    decision = qualify(
        profile=loaded,
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
        "profile": loaded.configuration(),
        "datasets": {"market.reference": base64.b64encode(dataset).decode()},
        "evidence": evidence,
        "baseline": baseline,
    }
    return decision, bundle, policy


def inspected_current(preview, observed):
    """Bind the current control to inspected bytes; observed input assertions cannot replace them."""
    try:
        packet = preview["packet"]
        if (
            type(preview.get("packetDigest")) is not str
            or re.fullmatch("[a-f0-9]{64}", preview["packetDigest"]) is None
        ):
            raise ValueError
        if any(_canonical(observed[key]) != _canonical(packet[key]) for key in ("work", "market")):
            raise ValueError
        sources = observed["sourceArtifacts"]
        if type(sources) is not list or len(sources) != 3 or len(packet["sources"]) != 3:
            raise ValueError
        indexed = {source["evidence"]["id"]: source for source in sources}
        if len(indexed) != 3:
            raise ValueError
        documents, inspected_sources = [], []
        for item in packet["sources"]:
            source = indexed[item["artifact"]["evidence"]["id"]]
            validate_source_contract(
                source,
                {
                    "expectedScope": packet["work"]["scope"],
                    "expectedTaskRevision": packet["work"]["taskRevision"],
                },
            )
            raw = item["text"].encode()
            if (
                _canonical(source) != _canonical(item["artifact"])
                or source["format"] != "json"
                or len(raw) != source["byteLength"]
                or hashlib.sha256(raw).hexdigest() != source["evidence"]["hash"]["value"]
            ):
                raise ValueError
            documents.append(json.loads(item["text"]))
            inspected_sources.append(copy.deepcopy(source))
        inputs = {}
        for key, marker in (
            ("mandate", "requiredPeriods"),
            ("series", "series"),
            ("assumptions", "scenarios"),
        ):
            matching = [
                document for document in documents if type(document) is dict and marker in document
            ]
            if len(matching) != 1:
                raise ValueError
            inputs[key] = matching[0]
        if "native" in observed:
            responses = observed["native"]["responses"]
            if len(responses) != 1:
                raise ValueError
            output = parse_employee_response(responses[0]["response"], "market")
            if any(
                _canonical(output.get(key)) != _canonical(packet[key]) for key in ("work", "market")
            ):
                raise ValueError
        return {
            **copy.deepcopy(observed),
            **inputs,
            "sourceArtifacts": inspected_sources,
            "evaluatedAt": datetime.now(UTC).isoformat(timespec="milliseconds"),
        }
    except (EvaluationError, KeyError, TypeError, ValueError, AttributeError, UnicodeError):
        raise EvaluationError("inspected_packet_mismatch") from None


def write_new(file, value):
    descriptor = os.open(file, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, "w") as handle:
        handle.write(_canonical(value) + "\n")
        handle.flush()
        os.fsync(handle.fileno())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True)
    parser.add_argument("--code-revision", required=True)
    parser.add_argument("--packet")
    parser.add_argument("--observed")
    parser.add_argument("--evidence-directory")
    args = parser.parse_args()
    try:
        current, preview = None, None
        if args.packet or args.observed or args.evidence_directory:
            if not all((args.packet, args.observed, args.evidence_directory)):
                raise EvaluationError("inspected_packet_required")
            preview = _read_owned_json(args.packet)
            current = inspected_current(preview, _read_owned_json(args.observed))
        decision, bundle, policy = asyncio.run(frozen_run(args.code_revision, current))
        if preview is not None and decision["status"] == "passed":
            directory = Path(args.evidence_directory)
            directory.mkdir(mode=0o700, parents=True, exist_ok=True)
            if (
                directory.is_symlink()
                or directory.stat().st_mode & 0o077
                or directory.stat().st_uid != os.getuid()
            ):
                raise EvaluationError("operator_file_denied")
            bundle["expiresAt"] = preview["packet"]["expiresAt"]
            policy["approval"]["approvedAt"] = (
                datetime.now(UTC) - timedelta(seconds=1)
            ).isoformat()
            write_new(directory / (preview["packetDigest"] + ".json"), bundle)
            write_new(directory / "policy.json", policy)
        write_new(Path(args.output), decision)
        print(
            _canonical(
                {
                    key: decision[key]
                    for key in (
                        "status",
                        "qualification",
                        "professionalAcceptance",
                        "promotionAllowed",
                    )
                }
            )
        )
        return 0 if decision["status"] == "passed" else 1
    except EvaluationError as error:
        print(_canonical({"status": "blocked", "code": error.code}))
        return 1
    except (OSError, ValueError, KeyError, TypeError):
        print(_canonical({"status": "blocked", "code": "qualification_unavailable"}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
