import copy
import json
from pathlib import Path

import pytest

from shaleyeah_evaluations import EvaluationError, TrustedEvalPolicy, registered_metric

FIXTURES = Path(__file__).parents[2] / "agents/reservoir-engineer/tests/eval/fixtures"
PARAMETERS = {
    "relativeTolerance": 1e-8,
    "volumeAbsoluteTolerance": 1e-5,
    "rateAbsoluteTolerance": 1e-8,
}
REQUIRED = {
    "reservoir.architecture_boundary",
    "reservoir.no_unapproved_forecast",
    "reservoir.tool_boundary",
    "reservoir.source_faithfulness",
    "reservoir.forecast_accuracy",
}


def example(name="harmonic"):
    observed = json.loads((FIXTURES / "observed-forecasts.json").read_text())[name]
    oracle = json.loads((FIXTURES / "forecast-oracles.json").read_text())["references"][name]
    work = observed["work"]
    trace = {"workProduct": work, "reservoirForecast": observed["forecast"]}
    runtime = {
        "scope": work["scope"],
        "taskRevision": work["taskRevision"],
        "productRef": work["artifact"],
        "sourceArtifacts": observed["sourceArtifacts"],
        "observations": {
            "reservoir_work": copy.deepcopy(work),
            "reservoir_forecast": copy.deepcopy(observed["forecast"]),
            "forecast_references": [oracle],
        },
    }
    return trace, runtime


def test_reservoir_mandatory_metrics_cannot_be_omitted_from_trusted_policy():
    assert REQUIRED <= TrustedEvalPolicy("reservoir-engineer").required_metrics


def test_independently_known_synthetic_curves_and_correct_insufficient_history_are_graded():
    metric = registered_metric("reservoir.forecast_accuracy", "1")
    for name in (
        "harmonic",
        "exponential",
        "hyperbolic",
        "monthly-gas",
        "insufficient",
        "cutoff",
        "initial-cutoff",
        "no-holdout",
    ):
        trace, runtime = example(name)
        assert metric.evaluate(trace, runtime, PARAMETERS) is True, name


@pytest.mark.parametrize(
    "field",
    [
        "volume",
        "remaining",
        "fit",
        "unit",
        "counts",
        "threshold",
        "authority",
        "method",
        "cutoff",
        "work",
        "r2",
        "boolean-definition",
        "boolean-threshold",
    ],
)
def test_independent_forecast_checks_reject_changed_math_units_counts_basis_or_authority(field):
    metric = registered_metric("reservoir.forecast_accuracy", "1")
    trace, runtime = example()
    actual = trace["reservoirForecast"]["forecasts"][0]
    if field == "volume":
        actual["modeled"]["cumulativeProduction"]["value"] *= 1.1
    elif field == "remaining":
        actual["remaining"][0]["cumulativeProduction"]["value"] *= 1.1
    elif field == "fit":
        actual["modeled"]["wells"][0]["fit"]["initialRate"] *= 1.1
    elif field == "unit":
        actual["modeled"]["rateUnit"] = "Mcf/day"
    elif field == "counts":
        actual["validation"][0]["trainingCount"] = 100
    elif field == "threshold":
        actual["quality"]["thresholds"]["minimumTrainingObservations"] = 1
    elif field == "authority":
        actual["authorizesReserves"] = True
    elif field == "method":
        actual["modeled"]["method"]["bSource"] = "inferred"
    elif field == "cutoff":
        actual["definition"]["economicLimitRate"] = 80
    elif field == "work":
        trace["workProduct"]["findings"][0]["value"] *= 1.1
    elif field == "r2":
        actual["modeled"]["wells"][0]["fit"]["rSquared"]["value"] = 0.5
    elif field == "boolean-definition":
        actual["definition"]["bFactor"] = True
    elif field == "boolean-threshold":
        actual["quality"]["thresholds"]["minimumHoldoutObservations"] = True
    assert metric.evaluate(trace, runtime, PARAMETERS) is False


def test_changed_or_missing_reference_is_not_a_substitute_for_independent_arithmetic():
    metric = registered_metric("reservoir.forecast_accuracy", "1")
    trace, runtime = example()
    runtime["observations"]["forecast_references"][0]["wells"][0]["initialRate"] = 999
    assert metric.evaluate(trace, runtime, PARAMETERS) is False
    for value in (None, [], {}, "invalid", True):
        trace, runtime = example()
        runtime["observations"]["forecast_references"] = value
        assert metric.evaluate(trace, runtime, PARAMETERS) is False


def test_unavailable_fit_cannot_be_promoted_to_a_fabricated_forecast():
    metric = registered_metric("reservoir.forecast_accuracy", "1")
    trace, runtime = example("insufficient")
    trace["reservoirForecast"]["forecasts"][0]["modeled"]["cumulativeProduction"] = {
        "status": "available",
        "value": 0,
    }
    assert metric.evaluate(trace, runtime, PARAMETERS) is False


def test_source_faithfulness_requires_complete_current_source_set_and_exact_actual_work():
    metric = registered_metric("reservoir.source_faithfulness", "1")
    trace, runtime = example()
    assert metric.evaluate(trace, runtime, {}) is True
    trace["reservoirForecast"]["forecasts"][0]["definition"]["fitUntil"] = 1
    assert metric.evaluate(trace, runtime, {}) is False
    trace, runtime = example()
    runtime["sourceArtifacts"].pop()
    assert metric.evaluate(trace, runtime, {}) is False
    trace, runtime = example()
    trace["reservoirForecast"]["forecasts"][0]["definition"]["bFactor"] = True
    assert metric.evaluate(trace, runtime, {}) is False


def test_installed_forecast_output_parser_rejects_forged_ambiguous_and_nonfinite_output():
    from shaleyeah_evaluations.employee_output import parse_employee_response

    assert parse_employee_response(
        {"parts": [{"text": '{"work":{},"forecast":{}}'}]}, "forecast"
    ) == {"work": {}, "forecast": {}}
    assert parse_employee_response(
        {"parts": [{"text": '{"deferred":"Missing history"}'}]}, "forecast"
    ) == {"deferred": "Missing history"}
    for text in (
        '{"work":{},"work":{},"forecast":{}}',
        '{"work":{"value":1e309},"forecast":{}}',
        '{"work":{},"forecast":{},"approved":true}',
        '{"work":{},"scenario":{}}',
    ):
        with pytest.raises(EvaluationError, match="invalid_employee_output"):
            parse_employee_response({"parts": [{"text": text}]}, "forecast")
