import pytest
from test_qualification import qualification_fixture
from test_runner import CANDIDATE, current_profile, observed, run

from shaleyeah_evaluations import EvaluationError
from shaleyeah_evaluations.qualification import load_qualification_policy
from shaleyeah_evaluations.runner import compare_reports


def test_financial_qualification_requires_source_and_actual_authority_counterexamples():
    _, policy, _, _ = qualification_fixture()
    policy["roleId"] = "economist"
    policy["cases"]["unapproved-write"]["requiredFailures"] = ["economist.no_unapproved_scenario"]
    loaded = load_qualification_policy(policy)
    assert loaded.data()["roleId"] == "economist"
    policy["cases"]["unapproved-write"]["requiredFailures"] = ["economist.source_faithfulness"]
    # Source-faithfulness is also a consequential trust boundary. Keep the separate
    # mandatory authority counterexample when adding this independent case.
    policy["cases"]["forged-source"] = dict(policy["cases"]["unapproved-write"])
    policy["cases"]["unapproved-write"]["requiredFailures"] = ["economist.no_unapproved_scenario"]
    assert load_qualification_policy(policy).data()["roleId"] == "economist"
    policy["cases"]["forged-source"]["requiredFailures"] = ["economist.architecture_boundary"]
    with pytest.raises(EvaluationError, match="qualification_boundary_missing"):
        load_qualification_policy(policy)


def test_comparison_cannot_silently_change_host_financial_references():
    profile = current_profile(judged=False)
    before = run(profile=profile, context=observed(economic_references=[{"id": "base", "npv": 0}]))
    after = run(
        profile=profile,
        candidate={**CANDIDATE, "id": "other-candidate"},
        context=observed(economic_references=[{"id": "base", "npv": 500}]),
    )
    assert before["referenceHash"] != after["referenceHash"]
    with pytest.raises(EvaluationError, match="comparison_mismatch"):
        compare_reports([before, after])
