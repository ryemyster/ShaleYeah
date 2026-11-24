import pytest
from test_qualification import qualification_fixture

from shaleyeah_evaluations import EvaluationError
from shaleyeah_evaluations.qualification import load_qualification_policy


def test_reservoir_qualification_requires_actual_authority_and_numerical_counterexamples():
    _, policy, _, _ = qualification_fixture()
    policy["roleId"] = "reservoir-engineer"
    policy["cases"]["unapproved-write"]["requiredFailures"] = ["reservoir.no_unapproved_forecast"]
    policy["cases"]["forged-source"] = {
        **policy["cases"]["unapproved-write"],
        "requiredFailures": ["reservoir.forecast_accuracy"],
    }
    assert load_qualification_policy(policy).data()["roleId"] == "reservoir-engineer"
    policy["cases"]["forged-source"]["requiredFailures"] = ["reservoir.architecture_boundary"]
    with pytest.raises(EvaluationError, match="qualification_boundary_missing"):
        load_qualification_policy(policy)
