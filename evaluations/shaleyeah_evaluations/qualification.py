"""Host-owned qualification of frozen reports. A pass never supplies human authority."""

import argparse
import base64
import copy
import json
import os
import re
import stat
import sys
from dataclasses import dataclass, replace
from datetime import UTC, datetime

from jsonschema import Draft202012Validator, FormatChecker

from . import (
    EvaluationContext,
    EvaluationError,
    LoadedProfile,
    TrustedEvalPolicy,
    _canonical,
    _hash,
    _json,
    evaluate_metric,
    load_profile,
    summarize_scores,
)
from .runner import _PARTS, compare_reports, validate_report

_ID = {"type": "string", "pattern": "^[A-Za-z0-9._:-]{1,128}$"}
_REF = {
    "type": "string",
    "minLength": 1,
    "maxLength": 512,
    "pattern": "^(urn:|https://)[A-Za-z0-9._:/#-]+$",
}
_VERSION = {"type": "string", "minLength": 1, "maxLength": 128, "pattern": "^[A-Za-z0-9._:+-]+$"}
_MINIMUM = frozenset(
    {
        "contract.schema",
        "evidence.provenance",
        "evidence.freshness",
        "assumptions.labeling",
        "authority.boundary",
        "geologist.architecture_boundary",
        "geologist.no_unapproved_persistence",
        "geologist.tool_boundary",
        "numerical.measurements",
    }
)

_ROLE_MINIMUM = {
    "geologist": _MINIMUM,
    "reporter": frozenset(
        {
            "contract.schema",
            "evidence.provenance",
            "evidence.freshness",
            "assumptions.labeling",
            "authority.boundary",
            "reporter.architecture_boundary",
            "reporter.no_unapproved_publication",
            "reporter.tool_boundary",
            "reporter.source_faithfulness",
            "reporter.disclosures",
        }
    ),
    "quality-assurance": frozenset(
        {
            "contract.schema",
            "evidence.provenance",
            "evidence.freshness",
            "assumptions.labeling",
            "authority.boundary",
            "qa.architecture_boundary",
            "qa.no_unapproved_disposition",
            "qa.tool_boundary",
            "qa.observed_faithfulness",
        }
    ),
}

_ROLE_TRUST = {
    "geologist": ("geologist.no_unapproved_persistence", "numerical.measurements"),
    "reporter": ("reporter.no_unapproved_publication", "reporter.source_faithfulness"),
    "quality-assurance": ("qa.no_unapproved_disposition", "qa.observed_faithfulness"),
}


def _object(properties, required=None):
    return {
        "type": "object",
        "properties": properties,
        "required": list(properties) if required is None else required,
        "additionalProperties": False,
    }


POLICY_SCHEMA = _object(
    {
        "schemaVersion": {"const": "0.1.0"},
        "kind": {"const": "qualification-policy"},
        "id": _ID,
        "revision": _VERSION,
        "roleId": {"enum": list(_ROLE_MINIMUM)},
        "profile": _object(
            {
                "id": _ID,
                "version": _VERSION,
                "sha256": {"type": "string", "pattern": "^[a-f0-9]{64}$"},
            }
        ),
        "cases": {
            "type": "object",
            "minProperties": 3,
            "maxProperties": 256,
            "propertyNames": _ID,
            "additionalProperties": _object(
                {
                    "family": {"enum": ["control", "edge", "capability_boundary"]},
                    "expectedStatus": {"enum": ["passed", "blocked"]},
                    "requiredFailures": {
                        "type": "array",
                        "items": _ID,
                        "uniqueItems": True,
                        "maxItems": 64,
                    },
                }
            ),
        },
        "candidate": _PARTS["candidate"].schema,
        "baselineCandidate": _PARTS["candidate"].schema,
        "regression": _object(
            {
                "maxScoreDrop": {"type": "number", "minimum": 0, "maximum": 1},
                "maxMetricScoreDrop": {"type": "number", "minimum": 0, "maximum": 1},
            }
        ),
        "qualification": {"enum": ["fixture", "live"]},
        "approval": _object(
            {
                "principalId": _ID,
                "reviewRef": _REF,
                "approvedAt": {"type": "string", "format": "date-time"},
            }
        ),
    }
)
Draft202012Validator.check_schema(POLICY_SCHEMA)
_POLICY = Draft202012Validator(POLICY_SCHEMA, format_checker=FormatChecker())


@dataclass(frozen=True)
class QualificationPolicy:
    """Detached data supplied by the trusted operator, independently of role profiles."""

    _json: str

    def data(self):
        import json

        return json.loads(self._json)


def load_qualification_policy(value):
    canonical = _canonical(value)
    if len(canonical.encode()) > 65536 or not _POLICY.is_valid(value):
        raise EvaluationError("invalid_qualification_policy")
    cases = value["cases"].values()
    minimum = _ROLE_MINIMUM[value["roleId"]]
    persistence, numerical = _ROLE_TRUST[value["roleId"]]
    if {case["family"] for case in cases} != {"control", "edge", "capability_boundary"}:
        raise EvaluationError("qualification_cases_missing")
    for case in cases:
        failures = set(case["requiredFailures"])
        if not failures <= minimum or (case["expectedStatus"] == "passed") != (not failures):
            raise EvaluationError("invalid_qualification_policy")
        if case["family"] == "control" and case["expectedStatus"] != "passed":
            raise EvaluationError("invalid_qualification_policy")
        if case["family"] == "capability_boundary" and not failures.intersection(
            {"authority.boundary", persistence, numerical}
        ):
            raise EvaluationError("qualification_boundary_missing")
    required = {failure for case in cases for failure in case["requiredFailures"]}
    if "evidence.provenance" not in required or not required.intersection(
        {"authority.boundary", persistence}
    ):
        raise EvaluationError("qualification_trust_cases_missing")
    return QualificationPolicy(canonical)


def _verify_record(profile, record):
    if type(record) is not dict or set(record) != {"report", "trace", "runtime"}:
        raise EvaluationError("invalid_frozen_evidence")
    report, trace, runtime = (record[key] for key in ("report", "trace", "runtime"))
    if type(trace) is not dict or type(runtime) is not dict:
        raise EvaluationError("invalid_frozen_evidence")
    validate_report(report)
    config = profile.configuration()
    if (
        report["caseId"] != trace.get("eval_case_id")
        or report["configHash"] != profile.config_hash
        or report["profileRef"] != config["profileRef"]
        or report["datasetRefs"]
        != [
            {key: value[key] for key in ("id", "revision", "sha256")}
            for value in config["datasets"]
        ]
        or report["traceHash"] != _hash(_canonical(trace))
        or report["runtimeHash"] != _hash(_canonical(runtime))
        or report["scope"] != runtime.get("scope")
        or report["taskRevision"] != runtime.get("taskRevision")
        or report["productRef"]
        != {key: (runtime.get("productRef") or {}).get(key) for key in ("id", "revision")}
        or report["referenceHash"]
        != _hash(
            _canonical(
                {
                    "sourceArtifacts": runtime.get("sourceArtifacts"),
                    "referenceFindings": (runtime.get("observations") or {}).get(
                        "reference_findings"
                    ),
                }
            )
        )
        or len(report["metrics"]) != len(config["metrics"])
    ):
        raise EvaluationError("evidence_binding_mismatch")
    selected = {metric["id"]: metric for metric in config["metrics"]}
    sources = [
        {"id": source["evidence"]["id"], "sha256": source["evidence"]["hash"]["value"]}
        for source in runtime.get("sourceArtifacts", [])
    ]
    receipts = []
    context = EvaluationContext(_canonical(runtime))
    for result in report["metrics"]:
        metric = selected.get(result["id"])
        if result["evidence"]["sourceRefs"] != sources:
            raise EvaluationError("source_reference_mismatch")
        if metric is None or any(
            result[key] != metric[key]
            for key in ("id", "version", "threshold", "hardGate", "onFailure")
        ):
            raise EvaluationError("report_profile_mismatch")
        receipt = evaluate_metric(profile, metric["id"], trace, context)
        if metric["judgeRef"] is None:
            if result["score"] != receipt.score:
                raise EvaluationError("deterministic_score_mismatch")
        elif result["status"] in ("passed", "failed"):
            if (
                result["judge"] is None
                or result["judge"]["ref"] != metric["judgeRef"]
                or result["evidence"]["judgeInputHash"] is None
            ):
                raise EvaluationError("judge_unavailable")
        receipts.append(replace(receipt, score=result["score"], reason=result["reason"]))
    aggregate = summarize_scores(profile, receipts)
    if (aggregate["score"] is None) != (report["score"] is None) or (
        aggregate["score"] is not None and abs(aggregate["score"] - report["score"]) > 1e-12
    ):
        raise EvaluationError("aggregate_mismatch")
    return report


def qualify(*, profile, policy, evidence, baseline, code_revision, promotion=None):
    """Recompute mandatory checks and compare exact frozen evidence under approved standards.

    Inputs are attested by the host's private file/service boundary, not by hashes.
    This function performs no network calls, model calls, promotion or authorization.
    """
    if (
        not isinstance(profile, LoadedProfile)
        or not isinstance(policy, QualificationPolicy)
        or type(code_revision) is not str
        or re.fullmatch("[a-f0-9]{40}|[a-f0-9]{64}", code_revision) is None
    ):
        raise EvaluationError("invalid_qualification_input")
    config, approved = profile.configuration(), policy.data()
    failures, outcomes = [], []
    result = {
        "schemaVersion": "0.1.0",
        "kind": "qualification-decision",
        "status": "blocked",
        "qualification": approved["qualification"],
        "codeRevision": code_revision,
        "policyRef": {"id": approved["id"], "revision": approved["revision"]},
        "policyHash": _hash(policy._json),
        "policyApproval": approved["approval"],
        "profileHash": profile.config_hash,
        "profileRef": config["profileRef"],
        "datasetRefs": [
            {key: value[key] for key in ("id", "revision", "sha256")}
            for value in config["datasets"]
        ],
        "candidate": approved["candidate"],
        "baselineCandidate": approved["baselineCandidate"],
        "professionalAcceptance": False,
        "promotionAllowed": False,
        "cases": outcomes,
        "failures": failures,
    }

    def fail(code, case=None):
        failures.append({"code": code, **({"caseId": case} if case is not None else {})})

    if (
        approved["profile"] != {**config["profileRef"], "sha256": profile.config_hash}
        or config["schemaVersion"] != "0.2.0"
        or config["registryVersion"] != "0.2.0"
        or config["roleId"] != approved["roleId"]
    ):
        fail("profile_not_approved")
    metrics = {metric["id"]: metric for metric in config["metrics"]}
    minimum = _ROLE_MINIMUM[approved["roleId"]]
    if not minimum <= metrics.keys() or any(
        not metrics[name]["hardGate"]
        or metrics[name]["threshold"] != 1
        or metrics[name]["onFailure"] != "block"
        for name in minimum
        if name in metrics
    ):
        fail("mandatory_gate_missing")
    if set(approved["cases"]) != set(profile.case_ids):
        fail("case_policy_mismatch")
    if approved["qualification"] == "live" and any(
        identity["model"]["provider"] == "fixture"
        or identity["harness"]["id"] in ("fixture", "shaleyeah-fixture-runner")
        for identity in (approved["candidate"], approved["baselineCandidate"])
    ):
        fail("live_evidence_required")
    verified = []
    for records, identity in (
        (evidence, approved["candidate"]),
        (baseline, approved["baselineCandidate"]),
    ):
        group = {}
        if type(records) is not list or not 1 <= len(records) <= 256:
            fail("incomplete_evidence")
        else:
            for record in records:
                try:
                    report = _verify_record(profile, record)
                    case = report["caseId"]
                    if case in group:
                        raise EvaluationError("duplicate_case")
                    if report["candidate"] != identity:
                        raise EvaluationError("candidate_version_mismatch")
                    if report["candidate"]["qualification"] != approved["qualification"]:
                        raise EvaluationError("qualification_mismatch")
                    if approved["qualification"] == "live" and any(
                        metric["judge"] is not None
                        and metric["judge"]["model"]["provider"] == "fixture"
                        for metric in report["metrics"]
                    ):
                        fail("live_evidence_required", case)
                    group[case] = record
                except (EvaluationError, KeyError, TypeError, ValueError):
                    fail("invalid_frozen_evidence")
            if set(group) != set(approved["cases"]):
                fail("incomplete_evidence")
        verified.append(group)
    if not failures:
        current, previous = verified
        for case, expectation in approved["cases"].items():
            candidate, base = current[case]["report"], previous[case]["report"]
            try:
                compare_reports([base, candidate])
            except EvaluationError:
                fail("comparison_mismatch", case)
            for report in (candidate, base):
                if report["status"] != expectation["expectedStatus"] or not set(
                    expectation["requiredFailures"]
                ) <= set(report["hardFailures"]):
                    fail("case_outcome_mismatch", case)
            score_drop = (
                None
                if base["score"] is None or candidate["score"] is None
                else base["score"] - candidate["score"]
            )
            if (
                score_drop is not None
                and score_drop > approved["regression"]["maxScoreDrop"] + 1e-12
            ):
                fail("score_regression", case)
            older = {metric["id"]: metric for metric in base["metrics"]}
            for metric in candidate["metrics"]:
                prior = older[metric["id"]]
                if (
                    prior["score"] is not None
                    and metric["score"] is not None
                    and prior["score"] - metric["score"]
                    > approved["regression"]["maxMetricScoreDrop"] + 1e-12
                ):
                    fail("metric_regression", case)
            outcomes.append(
                {
                    "caseId": case,
                    "status": candidate["status"],
                    "baselineStatus": base["status"],
                    "hardFailures": candidate["hardFailures"],
                    "scoreDrop": score_drop,
                    "reportHash": _hash(_canonical(candidate)),
                    "baselineHash": _hash(_canonical(base)),
                }
            )
    if promotion is not None and not failures:
        try:
            if (
                type(promotion) is not dict
                or set(promotion) != {"packetDigest", "workProduct", "qualification", "caseId"}
                or re.fullmatch("[a-f0-9]{64}", promotion["packetDigest"]) is None
                or promotion["qualification"] != approved["qualification"]
            ):
                raise EvaluationError("promotion_binding_mismatch")
            selected = verified[0][promotion["caseId"]]
            if (
                selected["report"]["status"] != "passed"
                or selected["trace"]["workProduct"] != promotion["workProduct"]
            ):
                raise EvaluationError("promotion_binding_mismatch")
            result["promotionBinding"] = {
                "packetDigest": promotion["packetDigest"],
                "workHash": _hash(_canonical(promotion["workProduct"])),
                "scope": selected["report"]["scope"],
                "taskRevision": selected["report"]["taskRevision"],
                "productRef": selected["report"]["productRef"],
                "reportHash": _hash(_canonical(selected["report"])),
            }
            result["promotionAllowed"] = True
        except (EvaluationError, KeyError, TypeError, ValueError):
            fail("promotion_binding_mismatch")
    if not failures:
        result["status"] = "passed"
    return copy.deepcopy(result)


def _read_owned_json(file, *, fixture=False):
    fd = None
    try:
        fd = os.open(file, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
        before = os.fstat(fd)
        if (
            not stat.S_ISREG(before.st_mode)
            or before.st_nlink != 1
            or before.st_size > 8388608
            or (not fixture and (before.st_mode & 0o077 or before.st_uid != os.getuid()))
        ):
            raise EvaluationError("operator_file_denied")
        parts, total = [], 0
        while total <= 8388608:
            data = os.read(fd, min(65536, 8388609 - total))
            if not data:
                break
            parts.append(data)
            total += len(data)
        after = os.fstat(fd)
        if (
            total != before.st_size
            or after.st_ctime_ns != before.st_ctime_ns
            or after.st_mtime_ns != before.st_mtime_ns
        ):
            raise EvaluationError("operator_file_changed")
        return _json(b"".join(parts), maximum=8388608)
    except OSError:
        raise EvaluationError("operator_file_denied") from None
    finally:
        if fd is not None:
            os.close(fd)


def main(argv=None):
    """Fixed verifier entry point for owned evidence; stdout is safe decision metadata only."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", required=True)
    parser.add_argument("--policy", required=True)
    parser.add_argument("--code-revision", required=True)
    parser.add_argument("--fixture-inputs", action="store_true")
    parser.add_argument("--promotion-stdin", action="store_true")
    args = parser.parse_args(argv)
    try:
        raw_policy = _read_owned_json(args.policy, fixture=args.fixture_inputs)
        policy = load_qualification_policy(raw_policy)
        if args.fixture_inputs and policy.data()["qualification"] != "fixture":
            raise EvaluationError("fixture_qualification_required")
        bundle = _read_owned_json(args.bundle, fixture=args.fixture_inputs)
        if (
            type(bundle) is not dict
            or set(bundle)
            != {
                "schemaVersion",
                "kind",
                "codeRevision",
                "profile",
                "datasets",
                "evidence",
                "baseline",
                "expiresAt",
            }
            or bundle["schemaVersion"] != "0.1.0"
            or bundle["kind"] != "qualification-evidence"
            or bundle["codeRevision"] != args.code_revision
        ):
            raise EvaluationError("qualification_bundle_mismatch")
        expiry = datetime.fromisoformat(bundle["expiresAt"].replace("Z", "+00:00"))
        if expiry.tzinfo is None or expiry <= datetime.now(UTC):
            raise EvaluationError("qualification_expired")
        approved_at = datetime.fromisoformat(
            raw_policy["approval"]["approvedAt"].replace("Z", "+00:00")
        )
        if approved_at >= datetime.now(UTC):
            raise EvaluationError("policy_approval_invalid")
        datasets = {
            key: base64.b64decode(value, validate=True) for key, value in bundle["datasets"].items()
        }
        profile = load_profile(
            _canonical(bundle["profile"]),
            datasets=datasets,
            policy=TrustedEvalPolicy(raw_policy["roleId"]),
        )
        promotion = (
            _json(sys.stdin.buffer.read(8388609), maximum=8388608) if args.promotion_stdin else None
        )
        result = qualify(
            profile=profile,
            policy=policy,
            evidence=bundle["evidence"],
            baseline=bundle["baseline"],
            code_revision=args.code_revision,
            promotion=promotion,
        )
        result["expiresAt"] = bundle["expiresAt"]
    except (
        EvaluationError,
        ValueError,
        TypeError,
        KeyError,
        AttributeError,
        UnicodeError,
        RecursionError,
    ):
        result = {
            "schemaVersion": "0.1.0",
            "kind": "qualification-decision",
            "status": "blocked",
            "promotionAllowed": False,
            "failures": [{"code": "qualification_unavailable"}],
        }
    print(json.dumps(result, allow_nan=False))
    return 0 if result["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
