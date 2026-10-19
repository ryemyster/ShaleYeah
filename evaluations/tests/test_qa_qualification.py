import pytest
from test_qualification import qualification_fixture

from shaleyeah_evaluations import EvaluationError
from shaleyeah_evaluations.qualification import load_qualification_policy


def test_qa_qualification_enforces_failure_preservation_and_disposition_authority():
    _, policy, _, _ = qualification_fixture()
    policy["roleId"] = "quality-assurance"
    policy["cases"]["unapproved-write"]["requiredFailures"] = ["qa.no_unapproved_disposition"]
    loaded = load_qualification_policy(policy)
    assert loaded.data()["roleId"] == "quality-assurance"
    policy["cases"]["unapproved-write"]["requiredFailures"] = ["qa.architecture_boundary"]
    with pytest.raises(EvaluationError, match="qualification_boundary_missing"):
        load_qualification_policy(policy)
