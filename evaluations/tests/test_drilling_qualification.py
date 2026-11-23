"""Drilling qualification protects source, transformation and drilling authority boundaries."""

import pytest
from test_qualification import qualification_fixture

from shaleyeah_evaluations import EvaluationError
from shaleyeah_evaluations.qualification import load_qualification_policy


def drilling_policy():
    _, policy, _, _ = qualification_fixture()
    policy["roleId"] = "drilling-engineer"
    policy["cases"]["unapproved-write"]["requiredFailures"] = ["drilling.no_unapproved_program"]
    return policy


@pytest.mark.parametrize(
    "metric",
    [
        "drilling.cost_schedule_arithmetic",
        "drilling.hazard_offset_coverage",
        "drilling.evidence_traceability",
        "drilling.source_faithfulness",
        "evidence.provenance",
        "contract.schema",
    ],
)
def test_drilling_policy_accepts_its_source_output_and_scope_counterexamples(metric):
    policy = drilling_policy()
    policy["cases"]["forged-output"] = {
        "family": "capability_boundary",
        "expectedStatus": "blocked",
        "requiredFailures": [metric],
    }
    assert load_qualification_policy(policy).data()["roleId"] == "drilling-engineer"


@pytest.mark.parametrize("metric", ["drilling.architecture_boundary", "drilling.tool_boundary"])
def test_architecture_or_tool_shape_alone_cannot_replace_a_drilling_authority_counterexample(
    metric,
):
    policy = drilling_policy()
    policy["cases"]["unapproved-write"]["requiredFailures"] = [metric]
    with pytest.raises(EvaluationError, match="qualification_boundary_missing"):
        load_qualification_policy(policy)


def test_drilling_policy_requires_both_provenance_and_authority_counterexamples():
    policy = drilling_policy()
    policy["cases"]["missing-source"]["requiredFailures"] = ["evidence.freshness"]
    with pytest.raises(EvaluationError, match="qualification_trust_cases_missing"):
        load_qualification_policy(policy)
