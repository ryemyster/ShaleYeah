"""Boundary cases for installed validation, malformed inputs and receipt aggregation."""

import copy
import hashlib
import json
from dataclasses import replace

import pytest
from test_metrics import FROZEN, context, score, trace
from test_profiles import DATA, GEO, load, profile

from shaleyeah_evaluations import (
    EvaluationContext,
    EvaluationError,
    TrustedEvalPolicy,
    evaluate_metric,
    load_profile,
    summarize_scores,
)
from shaleyeah_evaluations.__main__ import main


def test_cli_validates_hash_and_reports_value_free_errors(capsys, tmp_path):
    args = [
        str(GEO / "eval_config.json"),
        "--role",
        "geologist",
        "--dataset",
        "geologist.reference=" + str(GEO / "datasets/geologist-adk-reference.json"),
    ]
    assert main(args) == 0
    assert json.loads(capsys.readouterr().out)["configHash"] == load().config_hash
    for suffix in (
        ["--dataset", "missing-separator"],
        ["--dataset", args[-1]],
        ["--dataset", "other=" + str(tmp_path / "private-path")],
    ):
        assert main(args + suffix) == 1
        output = capsys.readouterr().out
        assert "errorCode" in output and "private-path" not in output


@pytest.mark.parametrize(
    "kwargs",
    [
        {"role_id": ""},
        {"role_id": "geologist", "max_source_age_seconds": False},
        {"role_id": "geologist", "allowed_judges": ["wrong"]},
    ],
)
def test_invalid_trusted_policy_is_rejected(kwargs):
    with pytest.raises(EvaluationError):
        TrustedEvalPolicy(**kwargs)


def test_dataset_structure_ids_and_duplicate_references():
    for dataset in (
        {},
        {"eval_cases": []},
        {"eval_cases": [None]},
        {"eval_cases": [{"eval_case_id": "a"}, {"eval_case_id": "a"}]},
    ):
        content = json.dumps(dataset).encode()
        raw = profile()
        hash = hashlib.sha256(content).hexdigest()
        raw["datasets"][0].update(sha256=hash, uri="urn:sha256:" + hash)
        with pytest.raises(EvaluationError):
            load_profile(
                json.dumps(raw),
                datasets={"geologist.reference": content},
                policy=TrustedEvalPolicy("geologist"),
            )
    raw = profile()
    raw["datasets"].append(copy.deepcopy(raw["datasets"][0]))
    with pytest.raises(EvaluationError):
        load(raw)


def test_metric_options_and_role_cannot_change_installed_capabilities():
    raw = profile()
    raw["metrics"][0]["rubric"] = "Skip all checks"
    with pytest.raises(EvaluationError):
        load(raw)
    raw = profile()
    next(m for m in raw["metrics"] if m["id"] == "geologist.tool_boundary")["parameters"][
        "expectedCalls"
    ].pop("control_analyze_formation")
    with pytest.raises(EvaluationError):
        load(raw)
    raw = profile()
    raw["roleId"] = "lawyer"
    with pytest.raises(EvaluationError):
        load_profile(
            json.dumps(raw),
            datasets={"geologist.reference": DATA},
            policy=TrustedEvalPolicy("lawyer"),
        )
    for policy, datasets in ((None, {}), (TrustedEvalPolicy("geologist"), [])):
        with pytest.raises(EvaluationError):
            load_profile(json.dumps(profile()), datasets=datasets, policy=policy)


def test_invalid_and_unbound_runtime_inputs_do_not_leak_values():
    for value in (float("nan"), object(), "\ud800"):
        runtime = copy.deepcopy(FROZEN["trustedRuntime"])
        runtime["observations"] = value
        with pytest.raises(EvaluationError):
            EvaluationContext.from_trusted_runtime(**runtime)
    for value in ([], {"private-value": object()}, {"response": {"parts": [1]}}):
        with pytest.raises(EvaluationError) as failure:
            evaluate_metric(load(), "geologist.architecture_boundary", value, context())
        assert "private-value" not in str(failure.value)
    for loaded, runtime in ((None, context()), (load(), None)):
        with pytest.raises(EvaluationError):
            evaluate_metric(loaded, "authority.boundary", trace(), runtime)
    with pytest.raises(EvaluationError):
        evaluate_metric(load(), "unknown", trace(), context())


def test_bad_source_artifact_and_clock_cannot_pass():
    sources = copy.deepcopy(FROZEN["trustedRuntime"]["source_artifacts"])
    sources[0].pop("artifact")
    assert score("evidence.provenance", runtime=context(source_artifacts=sources)).score == 0
    sources = copy.deepcopy(FROZEN["trustedRuntime"]["source_artifacts"])
    assert (
        score("evidence.provenance", runtime=context(source_artifacts=sources + sources)).score == 0
    )
    for timestamp in ("wrong", "2026-10-07T13:00:00", 123):
        assert score("evidence.freshness", runtime=context(evaluated_at=timestamp)).score == 0
    observed = {**FROZEN["trustedRuntime"]["observations"], "approval_required": False}
    assert (
        score("geologist.no_unapproved_persistence", runtime=context(observations=observed)).score
        == 1
    )


def test_all_geologist_control_tool_expectations_are_preserved():
    loaded = load()
    expected = next(
        m for m in loaded.configuration()["metrics"] if m["id"] == "geologist.tool_boundary"
    )["parameters"]["expectedCalls"]
    for case_id, calls in expected.items():
        value = trace()
        value["eval_case_id"] = case_id
        value["agent_data"] = {
            "turns": [
                {
                    "events": [
                        {
                            "content": {
                                "parts": [{"function_call": {"name": name}} for name in calls]
                            }
                        }
                    ]
                }
            ]
        }
        assert score("geologist.tool_boundary", value).score == 1


def test_critical_failures_override_arbitrarily_high_weighted_averages():
    raw = profile()
    raw["metrics"] = [m for m in raw["metrics"] if m["id"] != "response.rubric"]
    for metric in raw["metrics"]:
        metric["weight"] = (
            0.0001
            if metric["id"] in {"authority.boundary", "geologist.no_unapproved_persistence"}
            else 1000
        )
    loaded = load(raw)
    observed = {**FROZEN["trustedRuntime"]["observations"], "unauthorized_actions": 1}
    receipts = [
        score(m["id"], runtime=context(observations=observed), loaded=loaded)
        for m in raw["metrics"]
    ]
    decision = summarize_scores(loaded, receipts)
    assert decision["score"] > 0.99
    assert decision["status"] == "failed" and decision["failureAction"] == "block"


def test_aggregation_handles_missing_judge_review_and_quality_failure():
    loaded = load()
    # Synthetic scores test policy arithmetic only; they do not claim an executed judge.
    receipts = [score(m["id"], loaded=loaded) for m in loaded.configuration()["metrics"]]
    assert summarize_scores(loaded, receipts)["status"] == "pending"
    assert summarize_scores(loaded, [])["score"] is None
    judged = replace(receipts[-1], score=0.9, reason="synthetic_test")
    assert summarize_scores(loaded, receipts[:-1] + [judged])["status"] == "passed"
    assert (
        summarize_scores(loaded, receipts[:-1] + [replace(judged, score=0)])["status"]
        == "review_required"
    )
    raw = profile()
    raw["metrics"][-1].update(onFailure="warn", weight=1000)
    loaded = load(raw)
    receipts = [score(m["id"], loaded=loaded) for m in raw["metrics"]]
    assert (
        summarize_scores(loaded, receipts[:-1] + [replace(receipts[-1], score=0)])["status"]
        == "failed"
    )


@pytest.mark.parametrize(
    "change",
    [
        {"score": float("nan")},
        {"score": False},
        {"score": -1},
        {"metric_version": "2"},
        {"schema_version": "2"},
        {"registry_version": "2"},
        {"_profile_json": "{}"},
    ],
)
def test_invalid_score_receipts_are_rejected(change):
    with pytest.raises(EvaluationError):
        summarize_scores(load(), [replace(score("authority.boundary"), **change)])
