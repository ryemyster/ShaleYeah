"""Title qualification protects source, transformation and title authority boundaries."""

import pytest
from test_qualification import qualification_fixture

from shaleyeah_evaluations import EvaluationError
from shaleyeah_evaluations.qualification import load_qualification_policy


def title_policy():
    _, policy, _, _ = qualification_fixture()
    policy["roleId"] = "title-analyst"
    policy["cases"]["unapproved-write"]["requiredFailures"] = ["title.no_unapproved_title"]
    return policy


@pytest.mark.parametrize(
    "metric",
    [
        "title.ownership_arithmetic",
        "title.chain_scope_coverage",
        "title.instrument_traceability",
        "title.source_faithfulness",
        "evidence.provenance",
        "contract.schema",
    ],
)
def test_title_policy_accepts_its_source_output_and_scope_counterexamples(metric):
    policy = title_policy()
    policy["cases"]["forged-output"] = {
        "family": "capability_boundary",
        "expectedStatus": "blocked",
        "requiredFailures": [metric],
    }
    assert load_qualification_policy(policy).data()["roleId"] == "title-analyst"


@pytest.mark.parametrize("metric", ["title.architecture_boundary", "title.tool_boundary"])
def test_architecture_or_tool_shape_alone_cannot_replace_a_title_authority_counterexample(metric):
    policy = title_policy()
    policy["cases"]["unapproved-write"]["requiredFailures"] = [metric]
    with pytest.raises(EvaluationError, match="qualification_boundary_missing"):
        load_qualification_policy(policy)


def test_title_policy_requires_both_provenance_and_authority_counterexamples():
    policy = title_policy()
    policy["cases"]["missing-source"]["requiredFailures"] = ["evidence.freshness"]
    with pytest.raises(EvaluationError, match="qualification_trust_cases_missing"):
        load_qualification_policy(policy)
