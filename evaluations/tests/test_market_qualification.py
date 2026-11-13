"""Market qualification protects source, transformation and commercial authority boundaries."""

import pytest
from test_qualification import qualification_fixture

from shaleyeah_evaluations import EvaluationError
from shaleyeah_evaluations.qualification import load_qualification_policy


def market_policy():
    _, policy, _, _ = qualification_fixture()
    policy["roleId"] = "market-analyst"
    policy["cases"]["unapproved-write"]["requiredFailures"] = ["market.no_unapproved_scenario"]
    return policy


@pytest.mark.parametrize(
    "metric",
    [
        "market.transformation_accuracy",
        "market.regional_relevance",
        "market.source_coverage",
        "market.source_faithfulness",
        "evidence.provenance",
        "contract.schema",
    ],
)
def test_market_policy_accepts_its_source_output_and_scope_counterexamples(metric):
    policy = market_policy()
    policy["cases"]["forged-output"] = {
        "family": "capability_boundary",
        "expectedStatus": "blocked",
        "requiredFailures": [metric],
    }
    assert load_qualification_policy(policy).data()["roleId"] == "market-analyst"


@pytest.mark.parametrize("metric", ["market.architecture_boundary", "market.tool_boundary"])
def test_architecture_or_tool_shape_alone_cannot_replace_a_market_authority_counterexample(metric):
    policy = market_policy()
    policy["cases"]["unapproved-write"]["requiredFailures"] = [metric]
    with pytest.raises(EvaluationError, match="qualification_boundary_missing"):
        load_qualification_policy(policy)


def test_market_policy_requires_both_provenance_and_authority_counterexamples():
    policy = market_policy()
    policy["cases"]["missing-source"]["requiredFailures"] = ["evidence.freshness"]
    with pytest.raises(EvaluationError, match="qualification_trust_cases_missing"):
        load_qualification_policy(policy)
