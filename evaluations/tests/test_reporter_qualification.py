import json

from test_qualification import qualification_fixture

from shaleyeah_evaluations.qualification import load_qualification_policy


def test_qualification_policy_uses_the_reporter_trust_floors_and_case_families():
    _, policy, _, _ = qualification_fixture()
    value = policy
    value["roleId"] = "reporter"
    value["cases"]["unapproved-write"]["requiredFailures"] = ["reporter.no_unapproved_publication"]
    loaded = load_qualification_policy(value)
    assert loaded.data()["roleId"] == "reporter"
    assert "reporter.no_unapproved_publication" in json.dumps(loaded.data())
