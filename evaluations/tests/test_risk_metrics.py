"""Independent joint-state arithmetic and actual-output gates, not petroleum calibration."""

import copy
import json
import math
from pathlib import Path

import pytest

from shaleyeah_evaluations import registered_metric

ORACLES = json.loads(
    (Path(__file__).parents[1] / "fixtures/risk/joint-scenario-oracles.json").read_text()
)["cases"]
PARAMETERS = {"absoluteTolerance": 0.000001, "relativeTolerance": 1e-10}


def example(name="dependent"):
    oracle = copy.deepcopy(ORACLES[name])
    expected = oracle.pop("expected")
    reference = {"id": "joint.fixture", "revision": "r1"}
    definition = {
        "modelRef": reference,
        "method": "complete-joint-scenarios-v1",
        "currency": "USD",
        "horizon": {"start": "2026-01-01T00:00:00Z", "end": "2027-01-01T00:00:00Z"},
        "amountBasis": "undiscounted-residual-loss",
        "probabilityBasis": "assumed-joint-scenarios",
        "quantileConvention": "weighted-inverted-cdf",
        "totalWeight": oracle["totalWeight"],
        "lossThreshold": oracle["lossThreshold"],
    }
    risk = {
        "version": "0.1.0",
        "definition": definition,
        "summary": {
            "expectedLoss": expected["mean"],
            "standardDeviation": math.sqrt(expected["variance"]),
            "lossQuantiles": {key: expected[key] for key in ("p10", "p50", "p90")},
            "probabilityLossAtOrAbove": expected["tailProbability"],
            "scenarioCount": len(oracle["states"]),
            "positiveWeightScenarioCount": sum(s["weight"] > 0 for s in oracle["states"]),
        },
        "occurrence": [
            {"riskId": risk_id, "probability": value}
            for risk_id, value in zip(oracle["risks"], expected["occurrence"], strict=True)
        ],
        "correlations": [],
        "reviewStatus": "unreviewed",
        "riskAccepted": False,
        "professionalAcceptance": False,
    }
    index = 0
    for i, first in enumerate(oracle["risks"]):
        for second in oracle["risks"][i + 1 :]:
            value = expected["correlations"][index]
            risk["correlations"].append(
                {
                    "riskIds": [first, second],
                    "basis": "assumed-joint-scenarios",
                    "correlation": {
                        "status": "unavailable",
                        "value": None,
                        "reason": "zero_variance",
                    }
                    if value is None
                    else {"status": "available", "value": value},
                }
            )
            index += 1
    finding = {
        "id": "joint.fixture.expected-loss",
        "basis": "assumed",
        "value": expected["mean"],
        "unit": "USD",
    }
    return (
        {"riskPacket": risk, "workProduct": {"findings": [finding]}},
        {"observations": {"risk_reference": {"definition": copy.deepcopy(definition), **oracle}}},
    )


@pytest.mark.parametrize("name", ORACLES)
def test_independent_joint_state_moments_quantiles_and_dependence(name):
    metric = registered_metric("risk.scenario_accuracy", "1")
    trace, runtime = example(name)
    assert metric.evaluate(trace, runtime, PARAMETERS) is True


@pytest.mark.parametrize(
    "field",
    [
        "mean",
        "stddev",
        "quantile",
        "tail",
        "count",
        "occurrence",
        "correlation",
        "unit",
        "authority",
        "finding",
        "boolean-count",
    ],
)
def test_forged_joint_state_numerics_units_counts_and_authority_fail(field):
    metric = registered_metric("risk.scenario_accuracy", "1")
    trace, runtime = example()
    packet = trace["riskPacket"]
    if field == "mean":
        packet["summary"]["expectedLoss"] = 81
    elif field == "stddev":
        packet["summary"]["standardDeviation"] = 0
    elif field == "quantile":
        packet["summary"]["lossQuantiles"]["p90"] = 500
    elif field == "tail":
        packet["summary"]["probabilityLossAtOrAbove"] = 0.1
    elif field == "count":
        packet["summary"]["scenarioCount"] = 400
    elif field == "occurrence":
        packet["occurrence"][0]["probability"] = 0.1
    elif field == "correlation":
        packet["correlations"][0]["correlation"]["value"] = 0.85
    elif field == "unit":
        packet["definition"]["currency"] = "CAD"
    elif field == "authority":
        packet["riskAccepted"] = True
    elif field == "finding":
        trace["workProduct"]["findings"][0]["value"] = 81
    else:
        packet["summary"]["positiveWeightScenarioCount"] = True
    assert metric.evaluate(trace, runtime, PARAMETERS) is False


def test_missing_ambiguous_or_changed_joint_reference_is_not_numeric_truth():
    metric = registered_metric("risk.scenario_accuracy", "1")
    for value in (None, {}, [], True):
        trace, runtime = example()
        runtime["observations"]["risk_reference"] = value
        assert metric.evaluate(trace, runtime, PARAMETERS) is False
    trace, runtime = example()
    runtime["observations"]["risk_reference"]["states"][0]["weight"] = 8
    assert metric.evaluate(trace, runtime, PARAMETERS) is False
