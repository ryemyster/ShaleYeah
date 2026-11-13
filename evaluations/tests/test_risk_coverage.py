"""Human risk-policy coverage cannot be replaced by a plausible numerical summary."""

import copy

import pytest

from shaleyeah_evaluations import registered_metric


def example():
    register = {
        "entries": [
            {
                "riskRef": {"id": "risk.a", "revision": "r1"},
                "category": "geological",
                "severity": "medium",
                "severityBasis": "Operator-assumed synthetic severity",
                "evidenceState": "supported",
                "evidenceRefs": [{"id": "specialist.a", "revision": "r1"}],
                "conflicts": [],
                "mitigation": {"state": "proposed", "ownerId": "owner.a", "verificationRef": None},
            },
            {
                "riskRef": {"id": "risk.b", "revision": "r1"},
                "category": "economic",
                "severity": "low",
                "severityBasis": "Operator-assumed synthetic severity",
                "evidenceState": "supported",
                "evidenceRefs": [{"id": "specialist.b", "revision": "r1"}],
                "conflicts": [],
                "mitigation": {"state": "none", "ownerId": "owner.b", "verificationRef": None},
            },
        ]
    }
    policy = {
        "requiredCategories": ["geological", "economic"],
        "escalateSeverities": ["high", "critical"],
        "maxUnmitigatedSevereRisks": 0,
        "maxExpectedLoss": 100,
        "maxTailProbability": 0.25,
    }
    coverage = {
        "coveredCategories": ["economic", "geological"],
        "missingCategories": [],
        "unsupportedRiskIds": [],
        "conflictingRiskIds": [],
        "unknownSeverityRiskIds": [],
        "unmitigatedSevereRiskIds": [],
        "expectedLossWithinLimit": True,
        "tailProbabilityWithinLimit": True,
        "status": "passed",
    }
    packet = {
        "coverage": coverage,
        "summary": {"expectedLoss": 80, "probabilityLossAtOrAbove": 0.2},
    }
    return (
        {"riskPacket": packet, "workProduct": {"status": "draft", "blockers": []}},
        {"observations": {"risk_register": register, "risk_policy": policy}},
    )


def test_complete_supported_register_retains_policy_and_human_review_requirement():
    trace, runtime = example()
    assert registered_metric("risk.register_coverage", "1").evaluate(trace, runtime, {}) is True
    trace["workProduct"]["status"] = "ready_for_review"
    assert registered_metric("risk.register_coverage", "1").evaluate(trace, runtime, {}) is True
    trace["workProduct"]["status"] = "final"
    assert registered_metric("risk.register_coverage", "1").evaluate(trace, runtime, {}) is False


@pytest.mark.parametrize(
    "case",
    [
        "missing-category",
        "missing-evidence",
        "conflicting",
        "unknown-severity",
        "missing-severity-basis",
        "unmitigated-severe",
        "missing-verification",
        "mean-limit",
        "tail-limit",
    ],
)
def test_invented_coverage_pass_cannot_hide_missing_conflicting_or_severe_risks(case):
    metric = registered_metric("risk.register_coverage", "1")
    trace, runtime = example()
    entry = runtime["observations"]["risk_register"]["entries"][0]
    if case == "missing-category":
        runtime["observations"]["risk_policy"]["requiredCategories"].append("environmental")
    elif case == "missing-evidence":
        entry["evidenceState"], entry["evidenceRefs"] = "missing", []
    elif case == "conflicting":
        entry["conflicts"] = ["Two specialist interpretations disagree"]
    elif case == "unknown-severity":
        entry["severity"] = "unknown"
    elif case == "missing-severity-basis":
        entry["severityBasis"] = ""
    elif case == "unmitigated-severe":
        entry["severity"] = "critical"
    elif case == "missing-verification":
        entry["severity"], entry["mitigation"]["state"] = "high", "verified"
    elif case == "mean-limit":
        trace["riskPacket"]["summary"]["expectedLoss"] = 101
    else:
        trace["riskPacket"]["summary"]["probabilityLossAtOrAbove"] = 0.26
    assert metric.evaluate(trace, runtime, {}) is False


def test_correctly_blocked_severe_risk_is_correct_analysis_even_at_zero_probability():
    metric = registered_metric("risk.register_coverage", "1")
    trace, runtime = example()
    entry = runtime["observations"]["risk_register"]["entries"][0]
    entry["severity"] = "critical"
    trace["riskPacket"]["occurrence"] = [{"riskId": "risk.a", "probability": 0}]
    trace["riskPacket"]["coverage"].update(status="failed", unmitigatedSevereRiskIds=["risk.a"])
    trace["workProduct"].update(
        status="blocked",
        blockers=[
            {
                "code": "approval_required",
                "message": "unmitigated-severe-risk-limit",
                "references": [],
            }
        ],
    )
    assert metric.evaluate(trace, runtime, {}) is True
    changed = copy.deepcopy(trace)
    changed["workProduct"]["blockers"] = []
    assert metric.evaluate(changed, runtime, {}) is False
