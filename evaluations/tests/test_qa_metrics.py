import copy

import pytest

from shaleyeah_evaluations import EvaluationError, TrustedEvalPolicy, registered_metric


def test_qa_faithfulness_uses_host_observations_and_preserves_failures_counts_and_revisions():
    report = {
        "kind": "qa-observed-report",
        "summary": {"status": "FAIL", "counts": {"failed": 1, "passed": 0}},
        "resultRef": {"id": "result.qa", "revision": "r1"},
        "work": {
            "findings": [{"value": "FAIL"}],
            "inputs": [{"id": "source", "revision": "r1"}],
            "evidence": [{"id": "source"}],
        },
    }
    trace = {"qualityReport": report, "workProduct": copy.deepcopy(report["work"])}
    runtime = {
        "sourceArtifacts": [{"evidence": {"id": "source"}}],
        "observations": {"qa_observed_report": copy.deepcopy(report)},
    }
    metric = registered_metric("qa.observed_faithfulness", "1")
    assert metric.evaluate(trace, runtime, {}) is True
    for field in ("status", "counts", "revision", "finding"):
        altered = copy.deepcopy(trace)
        if field == "status":
            altered["qualityReport"]["summary"]["status"] = "PASS"
        if field == "counts":
            altered["qualityReport"]["summary"]["counts"]["passed"] = 99
        if field == "revision":
            altered["qualityReport"]["resultRef"]["revision"] = "r2"
        if field == "finding":
            altered["workProduct"]["findings"][0]["value"] = "PASS"
        assert metric.evaluate(altered, runtime, {}) is False
    assert metric.evaluate(trace, {"observations": {}}, {}) is False


def test_qa_policy_requires_role_fidelity_topology_and_authenticated_disposition_gates():
    policy = TrustedEvalPolicy("quality-assurance")
    assert {
        "qa.observed_faithfulness",
        "qa.architecture_boundary",
        "qa.no_unapproved_disposition",
        "qa.tool_boundary",
    } <= policy.required_metrics
    with pytest.raises(EvaluationError):
        registered_metric("qa.model_says_approved", "1")
