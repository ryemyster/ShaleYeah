"""Frozen employee performance, with independent host observations and no paid keys."""

import asyncio
import copy
import json
from dataclasses import replace

import pytest
from test_metrics import FROZEN, context, trace
from test_profiles import DATA, load, profile

from shaleyeah_evaluations import EvaluationError, registered_metric

CANDIDATE = {
    "id": "candidate.gemini",
    "version": "r1",
    "model": {"provider": "gemini", "id": "fixture-gemini", "revision": "r1"},
    "runtime": {"id": "google-adk", "version": "2.4.0"},
    "harness": {"id": "agents-cli", "version": "1.3.1"},
    "qualification": "fixture",
}


def observed(**changes):
    observations = {
        **FROZEN["trustedRuntime"]["observations"],
        "architecture_mode": "stand-alone-with-progressive-disclosure-skills",
        "child_agent_count": 0,
        "delegation_count": 0,
        "reference_findings": [
            {
                "id": "finding.depth",
                "value": 1200,
                "unit": "ft",
                "evidenceId": "evidence.log-1",
                "sourceHash": "1" * 64,
            }
        ],
        **changes,
    }
    return context(observations=observations)


def current_profile(judged=True):
    raw = profile()
    raw["schemaVersion"] = raw["registryVersion"] = "0.2.0"
    raw["profileRef"]["version"] = "r2"
    next(m for m in raw["metrics"] if m["id"] == "geologist.architecture_boundary")["version"] = "2"
    raw["metrics"].insert(
        -1,
        {
            "id": "numerical.measurements",
            "version": "1",
            "parameters": {},
            "threshold": 1,
            "weight": 1,
            "hardGate": True,
            "onFailure": "block",
            "rubric": None,
            "judgeRef": None,
        },
    )
    if not judged:
        raw["metrics"] = [m for m in raw["metrics"] if m["id"] != "response.rubric"]
    return load(raw)


def run(**changes):
    from shaleyeah_evaluations.runner import run_case

    args = {
        "profile": current_profile(),
        "trace": trace(),
        "context": observed(),
        "candidate": CANDIDATE,
        **changes,
    }
    return asyncio.run(run_case(**args))


def test_polished_prose_cannot_hide_actual_delegation():
    metric = registered_metric("geologist.architecture_boundary", "2")
    assert metric.evaluate(trace(), observed().data(), {}) is True
    assert metric.evaluate(trace(), observed(delegation_count=1).data(), {}) is False
    assert metric.evaluate(trace(), context().data(), {}) is False


@pytest.mark.parametrize("change", [{"value": 9999}, {"unit": "m"}, {"value": True}])
def test_cited_but_invented_measurements_fail(change):
    value = trace()
    value["workProduct"]["findings"][0].update(change)
    metric = registered_metric("numerical.measurements", "1")
    assert metric.evaluate(trace(), observed().data(), {}) is True
    assert metric.evaluate(value, observed().data(), {}) is False


def test_profile_v1_stays_loadable_but_cannot_claim_performance():
    from shaleyeah_evaluations.runner import run_case

    assert load().configuration()["schemaVersion"] == "0.1.0"
    with pytest.raises(EvaluationError, match="performance_profile_required"):
        asyncio.run(
            run_case(profile=load(), trace=trace(), context=observed(), candidate=CANDIDATE)
        )


def test_missing_judge_is_infrastructure_failure_without_fabricated_score():
    result = run()
    assert result["status"] == "infra-error" and result["promotionBlocked"] is True
    assert result["metrics"][-1]["status"] == "infra-error"
    assert result["metrics"][-1]["reason"] == "judge_unavailable"
    assert result["metrics"][-1]["score"] is None
    assert result["measurements"] == {}
    assert result["candidate"] == CANDIDATE
    assert result["scope"] == FROZEN["trustedRuntime"]["scope"]
    assert result["datasetRefs"][0]["sha256"] == load().dataset_hashes[0][1]


def judge(grade=None, **changes):
    from shaleyeah_evaluations.runner import JudgeBackend

    async def perfect(request):
        assert request["rubric"] and request["traceHash"]
        return 0.95

    return JudgeBackend(
        {"id": "judge.geologist", "version": "r1"},
        {"provider": "anthropic", "id": "fixture-judge", "revision": "r1"},
        perfect if grade is None else grade,
        **changes,
    )


def test_control_and_trusted_review_measurements_are_independent_of_confidence():
    measurements = {
        "latencyMs": 100,
        "cost": {"amount": 0.01, "currency": "USD"},
        "reviewSeconds": 30,
        "corrections": 1,
        "reworkCount": 2,
        "taskCompleted": True,
        "escalationQuality": 0.8,
        "toolFailures": 0,
    }
    result = run(judge=judge(), measurements=measurements)
    assert result["status"] == "passed" and result["promotionBlocked"] is False
    assert result["measurements"] == measurements
    assert result["modelConfidence"] == 0
    assert result["metrics"][-1]["judge"]["model"]["id"] == "fixture-judge"
    assert all(m["status"] == "passed" for m in result["metrics"])
    assert result["retention"] == "host-policy"


@pytest.mark.parametrize(
    "observations",
    [
        {"unauthorized_actions": 1},
        {"write_dispatches": 1},
        {"delegation_count": 1},
        {"reference_findings": []},
    ],
)
def test_boundary_failures_block_even_when_judge_passes(observations):
    result = run(context=observed(**observations), judge=judge())
    assert result["status"] == "blocked" and result["hardFailures"]


def test_insufficient_evidence_and_wrong_scope_do_not_pass():
    value = trace()
    value["workProduct"]["scope"]["customerId"] = "other"
    assert run(trace=value, judge=judge())["status"] == "blocked"
    assert (
        run(context=replace(observed(), _json=context(source_artifacts=[])._json), judge=judge())[
            "status"
        ]
        == "blocked"
    )


@pytest.mark.parametrize("mode", ["timeout", "raises", "nan", "boolean", "out_of_range"])
def test_judge_failures_never_become_pass_or_expose_exception_text(mode):
    async def broken(_):
        if mode == "timeout":
            await asyncio.sleep(1)
        if mode == "raises":
            raise RuntimeError("private-key-value")
        return {"nan": float("nan"), "boolean": True, "out_of_range": 2}.get(mode)

    result = run(judge=judge(broken), judge_timeout_seconds=0.01)
    assert result["status"] == "infra-error"
    assert result["metrics"][-1]["score"] is None
    assert "private-key-value" not in json.dumps(result)


def test_case_binding_and_candidate_metadata_are_strict():
    value = trace()
    value["eval_case_id"] = "unreviewed"
    for changes in (
        {"trace": value},
        {"candidate": {**CANDIDATE, "apiKey": "private-value"}},
        {"measurements": {"reviewSeconds": -1}},
        {"measurements": {"corrections": False}},
        {"judge_timeout_seconds": False},
    ):
        with pytest.raises(EvaluationError):
            run(**changes)


def test_frozen_comparison_preserves_versions_and_surfaces_nondeterminism():
    from shaleyeah_evaluations.runner import compare_reports, validate_report

    first = run(judge=judge())
    candidate = copy.deepcopy(CANDIDATE)
    candidate["id"] = "candidate.anthropic"
    candidate["model"] = {"provider": "anthropic", "id": "fixture-anthropic", "revision": "r1"}
    second = run(candidate=candidate, judge=judge())
    validate_report(first)
    compared = compare_reports([first, second])
    assert compared["comparable"] is True
    assert compared["nondeterministic"] == []
    assert compared["candidates"][1]["model"] == candidate["model"]
    changed = run(judge=judge(), context=observed(unauthorized_actions=1))
    compared = compare_reports([first, changed])
    assert compared["nondeterministic"] == [CANDIDATE["id"]]
    second["configHash"] = "0" * 64
    with pytest.raises(EvaluationError, match="comparison_mismatch"):
        compare_reports([first, second])


def test_unknown_runtime_and_data_errors_are_explicit_not_blanket_passes():
    result = run(context=context(), judge=judge())
    assert result["status"] == "blocked"
    assert "geologist.architecture_boundary" in result["hardFailures"]
    assert "numerical.measurements" in result["hardFailures"]
    assert len(DATA) > 0


def test_configured_quality_warning_remains_visible_without_weakening_hard_gates():
    raw = current_profile().configuration()
    raw["metrics"][-1].update(onFailure="warn", weight=0.01)

    async def low(_):
        return 0.1

    result = run(profile=load(raw), judge=judge(low))
    assert result["status"] == "passed"
    assert result["metrics"][-1]["status"] == "failed"
    assert result["metrics"][-1]["onFailure"] == "warn"


def test_reports_reject_forged_gate_flags_and_different_executed_judges():
    from shaleyeah_evaluations.runner import compare_reports, validate_report

    result = run(judge=judge())
    forged = copy.deepcopy(result)
    forged["hardFailures"] = ["unknown"]
    forged["status"] = "blocked"
    forged["promotionBlocked"] = True
    with pytest.raises(EvaluationError, match="invalid_report"):
        validate_report(forged)
    other = copy.deepcopy(result)
    other["metrics"][-1]["judge"]["model"]["revision"] = "r2"
    with pytest.raises(EvaluationError, match="comparison_mismatch"):
        compare_reports([result, other])


def test_mismatched_judge_and_invalid_receipts_are_value_free():
    from shaleyeah_evaluations.runner import JudgeBackend, compare_reports, validate_report

    backend = judge()
    backend.ref["version"] = "r2"
    result = run(judge=backend)
    assert result["metrics"][-1]["reason"] == "judge_mismatch"
    assert result["status"] == "infra-error"
    with pytest.raises(EvaluationError):
        JudgeBackend({"id": "x", "apiKey": "private-value"}, {}, None)
    with pytest.raises(EvaluationError):
        validate_report({"private-value": "x"})
    with pytest.raises(EvaluationError):
        compare_reports([])
    raw = current_profile().configuration()
    raw["metrics"] = [m for m in raw["metrics"] if m["id"] != "numerical.measurements"]
    with pytest.raises(EvaluationError, match="policy_denied"):
        load(raw)

    raw = current_profile().configuration()
    next(m for m in raw["metrics"] if m["id"] == "geologist.architecture_boundary")["version"] = "1"
    with pytest.raises(EvaluationError, match="policy_denied"):
        load(raw)


def test_qualitative_judge_never_receives_raw_tool_results_prompts_or_source_uris():
    value = trace()
    value["agent_data"]["turns"][0]["events"].append(
        {"content": {"parts": [{"text": "private-tool-payload"}]}}
    )
    value["prompt"] = {"parts": [{"text": "private-user-prompt"}]}

    async def inspect(request):
        supplied = json.dumps(request["trace"])
        assert "private-tool-payload" not in supplied and "private-user-prompt" not in supplied
        assert "urn:example:" not in supplied
        assert request["trace"]["response"] == value["response"]
        assert request["trace"]["workProduct"]["findings"] == value["workProduct"]["findings"]
        return 0.95

    result = run(trace=value, judge=judge(inspect))
    assert result["status"] == "passed"
