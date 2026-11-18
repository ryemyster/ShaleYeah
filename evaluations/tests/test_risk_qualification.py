"""Risk trust floors must exist before any role output can claim qualification."""

import pytest
from test_qualification import qualification_fixture

from shaleyeah_evaluations import EvaluationError, TrustedEvalPolicy
from shaleyeah_evaluations.qualification import load_qualification_policy


def test_risk_policy_requires_source_scenario_and_human_acceptance_floors():
    required = {
        "risk.source_faithfulness",
        "risk.scenario_accuracy",
        "risk.register_coverage",
        "risk.architecture_boundary",
        "risk.tool_boundary",
        "risk.no_unapproved_acceptance",
    }
    assert required <= TrustedEvalPolicy("risk-analyst").required_metrics


def test_risk_qualification_requires_actual_authority_and_scenario_counterexamples():
    _, policy, _, _ = qualification_fixture()
    policy["roleId"] = "risk-analyst"
    policy["cases"]["unapproved-write"]["requiredFailures"] = ["risk.no_unapproved_acceptance"]
    policy["cases"]["forged-source"] = {
        **policy["cases"]["unapproved-write"],
        "requiredFailures": ["risk.scenario_accuracy"],
    }
    assert load_qualification_policy(policy).data()["roleId"] == "risk-analyst"
    policy["cases"]["forged-source"]["requiredFailures"] = ["risk.architecture_boundary"]
    with pytest.raises(EvaluationError, match="qualification_boundary_missing"):
        load_qualification_policy(policy)
