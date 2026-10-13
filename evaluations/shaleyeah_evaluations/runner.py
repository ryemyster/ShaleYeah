"""Framework-neutral grading of frozen work; reports cannot authorize an action."""

import asyncio
import json
import math
from collections import defaultdict
from dataclasses import dataclass, replace
from importlib.resources import files

from jsonschema import Draft202012Validator

from . import (
    EvaluationContext,
    EvaluationError,
    LoadedProfile,
    _canonical,
    _hash,
    evaluate_metric,
    summarize_scores,
)

REPORT_SCHEMA = json.loads(
    files("shaleyeah_evaluations").joinpath("schemas/eval-report-0.1.0.schema.json").read_text()
)
Draft202012Validator.check_schema(REPORT_SCHEMA)
_REPORT = Draft202012Validator(REPORT_SCHEMA)
_PARTS = {key: Draft202012Validator(value) for key, value in REPORT_SCHEMA["$defs"].items()}


@dataclass(frozen=True)
class JudgeBackend:
    """Host-installed asynchronous qualitative judge, never loaded from profile code."""

    ref: dict
    model: dict
    grade: object

    def __post_init__(self):
        if (
            not _PARTS["judgeRef"].is_valid(self.ref)
            or not _PARTS["judgeModel"].is_valid(self.model)
            or not callable(self.grade)
        ):
            raise EvaluationError("invalid_judge")
        object.__setattr__(self, "ref", json.loads(_canonical(self.ref)))
        object.__setattr__(self, "model", json.loads(_canonical(self.model)))


def validate_report(value):
    """Validate portable shape and internal decision bindings; not a signature check."""
    _canonical(value)
    if not _REPORT.is_valid(value):
        raise EvaluationError("invalid_report")
    ids = [item["id"] for item in value["metrics"]]
    expected_hard = [
        item["id"]
        for item in value["metrics"]
        if item["status"] == "failed" and (item["hardGate"] or item["onFailure"] == "block")
    ]
    if (
        not ids
        or len(set(ids)) != len(ids)
        or value["promotionBlocked"] != (value["status"] != "passed")
        or any(
            item["evidence"]["traceHash"] != value["traceHash"]
            or item["evidence"]["runtimeHash"] != value["runtimeHash"]
            for item in value["metrics"]
        )
        or (
            value["status"] == "passed"
            and any(
                item["status"] != "passed"
                and not (
                    item["status"] == "failed"
                    and item["onFailure"] == "warn"
                    and not item["hardGate"]
                )
                for item in value["metrics"]
            )
        )
        or value["hardFailures"] != expected_hard
        or any(
            (item["status"] in ("infra-error", "skipped")) != (item["score"] is None)
            or (
                item["score"] is not None
                and (item["score"] >= item["threshold"]) != (item["status"] == "passed")
            )
            for item in value["metrics"]
        )
        or bool(value["hardFailures"]) != (value["status"] == "blocked")
    ):
        raise EvaluationError("invalid_report")


async def run_case(
    *, profile, trace, context, candidate, measurements=None, judge=None, judge_timeout_seconds=30
):
    """Grade one reviewed case. Failures and missing infrastructure never become PASS."""
    if (
        not isinstance(profile, LoadedProfile)
        or not isinstance(context, EvaluationContext)
        or profile.configuration()["schemaVersion"] != "0.2.0"
    ):
        raise EvaluationError("performance_profile_required")
    if (
        not _PARTS["candidate"].is_valid(candidate)
        or type(judge_timeout_seconds) not in (int, float)
        or not math.isfinite(judge_timeout_seconds)
        or not 0 < judge_timeout_seconds <= 300
    ):
        raise EvaluationError("invalid_run")
    candidate = json.loads(_canonical(candidate))
    measurements = {} if measurements is None else json.loads(_canonical(measurements))
    if not _PARTS["measurements"].is_valid(measurements) or any(
        type(measurements.get(key)) is bool
        for key in (
            "latencyMs",
            "reviewSeconds",
            "corrections",
            "reworkCount",
            "toolFailures",
            "escalationQuality",
        )
    ):
        raise EvaluationError("invalid_measurements")
    if type(trace) is not dict or trace.get("eval_case_id") not in profile.case_ids:
        raise EvaluationError("unreviewed_case")
    config, runtime = profile.configuration(), context.data()
    receipts, results, hard = [], [], []
    # Deterministic gates run before any qualitative request, regardless of profile order.
    metrics = sorted(config["metrics"], key=lambda item: item["judgeRef"] is not None)
    for metric in metrics:
        receipt = evaluate_metric(profile, metric["id"], trace, context)
        reason, score, judge_info, judge_input_hash = receipt.reason, receipt.score, None, None
        if metric["judgeRef"] is not None:
            if hard:
                status, reason = "skipped", "critical_failure"
            elif judge is None:
                status, reason = "infra-error", "judge_unavailable"
            elif not isinstance(judge, JudgeBackend) or judge.ref != metric["judgeRef"]:
                status, reason = "infra-error", "judge_mismatch"
            else:
                judge_info = {"ref": judge.ref, "model": judge.model}
                work = trace["workProduct"]
                response = trace.get("response") if type(trace.get("response")) is dict else {}
                parts = response.get("parts") if type(response.get("parts")) is list else []
                response_view = {
                    "parts": [
                        {"text": part["text"]}
                        for part in parts
                        if type(part) is dict and type(part.get("text")) is str
                    ]
                }
                if response.get("role") in ("model", "assistant"):
                    response_view["role"] = response["role"]
                work_view = {
                    key: work[key] for key in ("findings", "assumptions", "uncertainty", "blockers")
                }
                work_view["reviewStatus"] = work["review"]["status"]
                request = {
                    "rubric": metric["rubric"],
                    "trace": json.loads(
                        _canonical({"response": response_view, "workProduct": work_view})
                    ),
                    "traceHash": receipt.trace_hash,
                    "configHash": profile.config_hash,
                }
                judge_input_hash = _hash(_canonical(request))
                try:
                    score = await asyncio.wait_for(judge.grade(request), judge_timeout_seconds)
                    if (
                        type(score) not in (int, float)
                        or not math.isfinite(score)
                        or not 0 <= score <= 1
                    ):
                        raise ValueError
                    status = "passed" if score >= metric["threshold"] else "failed"
                    reason = "qualitative_score"
                except TimeoutError:
                    score, status, reason = None, "infra-error", "judge_timeout"
                except Exception:
                    # Untrusted transport errors may contain headers, credentials or prompts.
                    score, status, reason = None, "infra-error", "judge_failed"
        else:
            status = "passed" if score >= metric["threshold"] else "failed"
        if status == "failed" and (metric["hardGate"] or metric["onFailure"] == "block"):
            hard.append(metric["id"])
        receipts.append(replace(receipt, score=score, reason=reason))
        sources = runtime.get("sourceArtifacts") or []
        source_refs = [
            {"id": item["id"], "sha256": item["hash"]["value"]}
            for source in sources
            if type(source) is dict
            for item in [source.get("evidence")]
            if type(item) is dict
            and type(item.get("hash")) is dict
            and type(item.get("id")) is str
            and type(item["hash"].get("value")) is str
        ]
        results.append(
            {
                "id": metric["id"],
                "version": metric["version"],
                "threshold": metric["threshold"],
                "hardGate": metric["hardGate"],
                "onFailure": metric["onFailure"],
                "status": status,
                "score": score,
                "reason": reason,
                "evidence": {
                    "traceHash": receipt.trace_hash,
                    "runtimeHash": receipt.runtime_hash,
                    "judgeInputHash": judge_input_hash,
                    "sourceRefs": source_refs,
                },
                "judge": judge_info,
            }
        )
    decision = summarize_scores(profile, receipts)
    status = (
        "blocked"
        if hard
        else "infra-error"
        if any(r["status"] == "infra-error" for r in results)
        else {
            "passed": "passed",
            "failed": "failed",
            "review_required": "review-required",
            "pending": "infra-error",
        }[decision["status"]]
    )
    product = runtime.get("productRef") or {}
    report = {
        "schemaVersion": "0.1.0",
        "kind": "eval-report",
        "caseId": trace["eval_case_id"],
        "profileRef": config["profileRef"],
        "profileSchemaVersion": config["schemaVersion"],
        "registryVersion": config["registryVersion"],
        "configHash": profile.config_hash,
        "datasetRefs": [
            {key: d[key] for key in ("id", "revision", "sha256")} for d in config["datasets"]
        ],
        "traceHash": receipts[0].trace_hash,
        "runtimeHash": receipts[0].runtime_hash,
        "referenceHash": _hash(
            _canonical(
                {
                    "sourceArtifacts": runtime.get("sourceArtifacts"),
                    "referenceFindings": (runtime.get("observations") or {}).get(
                        "reference_findings"
                    ),
                }
            )
        ),
        "scope": runtime.get("scope"),
        "taskRevision": runtime.get("taskRevision"),
        "productRef": {key: product.get(key) for key in ("id", "revision")},
        "candidate": candidate,
        "status": status,
        "promotionBlocked": status != "passed",
        "hardFailures": hard,
        "metrics": results,
        "score": decision["score"],
        "measurements": measurements,
        "modelConfidence": trace["workProduct"].get("confidence")
        if type(trace.get("workProduct")) is dict
        else None,
        "retention": "host-policy",
    }
    validate_report(report)
    return json.loads(_canonical(report))


def compare_reports(reports):
    """Compare the same scorecard/dataset/scope/case and flag repeated candidate variation."""
    if type(reports) is not list or not 2 <= len(reports) <= 256:
        raise EvaluationError("comparison_mismatch")
    for report in reports:
        validate_report(report)
    keys = (
        "caseId",
        "profileRef",
        "configHash",
        "datasetRefs",
        "scope",
        "taskRevision",
        "productRef",
        "referenceHash",
    )
    if len({_canonical({key: report[key] for key in keys}) for report in reports}) != 1:
        raise EvaluationError("comparison_mismatch")
    repeated, candidates = defaultdict(set), {}
    judges = defaultdict(set)
    for report in reports:
        for metric in report["metrics"]:
            if metric["judge"] is not None:
                judges[metric["id"]].add(_canonical(metric["judge"]))
    if any(len(values) > 1 for values in judges.values()):
        raise EvaluationError("comparison_mismatch")
    for report in reports:
        candidate = report["candidate"]
        identity = _canonical(candidate)
        if candidate["id"] in candidates and candidates[candidate["id"]] != candidate:
            raise EvaluationError("comparison_mismatch")
        candidates[candidate["id"]] = candidate
        repeated[identity].add(
            _hash(
                _canonical(
                    {
                        "status": report["status"],
                        "traceHash": report["traceHash"],
                        "metrics": [
                            {k: m[k] for k in ("id", "version", "status", "score", "judge")}
                            for m in report["metrics"]
                        ],
                    }
                )
            )
        )
    return {
        "comparable": True,
        "configHash": reports[0]["configHash"],
        "candidates": list(candidates.values()),
        "nondeterministic": [
            json.loads(key)["id"] for key, values in repeated.items() if len(values) > 1
        ],
        "outcomes": [
            {
                "candidateId": r["candidate"]["id"],
                "status": r["status"],
                "hardFailures": r["hardFailures"],
                "score": r["score"],
                "measurements": r["measurements"],
            }
            for r in reports
        ],
    }
