"""Legal technical qualification requires citation/date/coverage and human-authority controls."""

import json
from pathlib import Path

import pytest
from test_qualification import qualification_fixture

from shaleyeah_evaluations import EvaluationError, TrustedEvalPolicy, load_profile
from shaleyeah_evaluations.qualification import load_qualification_policy


def test_legal_policy_requires_all_seven_role_floors():
    required = {
        "legal." + name
        for name in (
            "source_faithfulness",
            "citation_accuracy",
            "jurisdiction_date",
            "issue_coverage",
            "architecture_boundary",
            "tool_boundary",
            "no_unapproved_clearance",
        )
    }
    assert required <= TrustedEvalPolicy("legal-analyst").required_metrics


def test_legal_qualification_requires_source_and_authority_counterexamples():
    _, policy, _, _ = qualification_fixture()
    policy["roleId"] = "legal-analyst"
    policy["cases"]["unapproved-write"]["requiredFailures"] = ["legal.no_unapproved_clearance"]
    policy["cases"]["forged-source"] = {
        **policy["cases"]["unapproved-write"],
        "requiredFailures": ["legal.citation_accuracy"],
    }
    assert load_qualification_policy(policy).data()["roleId"] == "legal-analyst"
    policy["cases"]["forged-source"]["requiredFailures"] = ["evidence.provenance"]
    assert load_qualification_policy(policy).data()["roleId"] == "legal-analyst"
    policy["cases"]["forged-source"]["requiredFailures"] = ["legal.architecture_boundary"]
    with pytest.raises(EvaluationError, match="qualification_boundary_missing"):
        load_qualification_policy(policy)


def configured_profile():
    root = Path(__file__).parents[1] / "fixtures/legal"
    return json.loads((root / "performance_profile.json").read_text()), {"legal.reference": (root / "legal-performance.json").read_bytes()}


def test_data_only_profile_binds_all_frozen_cases_and_cannot_remove_trust_floors():
    profile, datasets = configured_profile()
    loaded = load_profile(json.dumps(profile), datasets=datasets, policy=TrustedEvalPolicy("legal-analyst"))
    assert len(loaded.case_ids) == 20
    assert loaded.configuration()["roleId"] == "legal-analyst"
    for name in ("legal.citation_accuracy", "legal.jurisdiction_date", "legal.issue_coverage", "legal.no_unapproved_clearance"):
        missing, datasets = configured_profile()
        missing["metrics"] = [metric for metric in missing["metrics"] if metric["id"] != name]
        with pytest.raises(EvaluationError, match="policy_denied"):
            load_profile(json.dumps(missing), datasets=datasets, policy=TrustedEvalPolicy("legal-analyst"))


def test_legal_metrics_cannot_be_adopted_by_another_role_or_lowered_below_mandatory_floors():
    profile, datasets = configured_profile()
    profile["roleId"] = "unrelated-role"
    with pytest.raises(EvaluationError, match="policy_denied"):
        load_profile(json.dumps(profile), datasets=datasets, policy=TrustedEvalPolicy("unrelated-role"))
    profile, datasets = configured_profile()
    next(metric for metric in profile["metrics"] if metric["id"] == "legal.citation_accuracy")["threshold"] = 0.8
    with pytest.raises(EvaluationError, match="policy_denied"):
        load_profile(json.dumps(profile), datasets=datasets, policy=TrustedEvalPolicy("legal-analyst"))
