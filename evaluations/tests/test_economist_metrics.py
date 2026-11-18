import copy
import hashlib
import json
from pathlib import Path

import pytest

from shaleyeah_evaluations import (
    EvaluationError,
    TrustedEvalPolicy,
    load_profile,
    registered_metric,
)

PARAMETERS = {
    "npvAbsoluteTolerance": 0.000001,
    "irrAbsoluteTolerance": 0.00000001,
    "irrResidualTolerance": 0.0000000001,
}
REQUIRED = {
    "economist.architecture_boundary",
    "economist.no_unapproved_scenario",
    "economist.tool_boundary",
    "economist.source_faithfulness",
    "economist.cash_flow_accuracy",
}


def test_installed_financial_output_parser_needs_no_employee_app():
    from shaleyeah_evaluations.economist_output import parse_response

    assert parse_response({"parts": [{"text": '{"work":{},"scenario":{}}'}]}) == {
        "work": {}, "scenario": {}
    }
    for text in ('{"work":{},"work":{},"scenario":{}}', '{"work":{"value":1e309},"scenario":{}}'):
        with pytest.raises(EvaluationError, match="invalid_employee_output"):
            parse_response({"parts": [{"text": text}]})


@pytest.mark.parametrize("response", [
    {}, {"parts": []}, {"parts": [None]}, {"parts": [{"text": 1}]},
    {"parts": [{"text": "x", "function_call": {}}]},
    {"parts": [{"text": "x", "function_response": {}}]},
    {"parts": [{"text": "x" * 1_000_001}]},
    {"parts": [{"text": '{"work":{},"scenario":{},"authority":true}'}]},
    {"parts": [{"text": '{"work":null,"scenario":{}}'}]},
    {"parts": [{"text": "[1]"}]}, {"parts": [{"text": "NaN"}]},
    {"parts": [{"text": '{"deferred":" "}'}]},
])
def test_financial_output_rejects_malformed_unbounded_or_ambiguous_content(response):
    from shaleyeah_evaluations.economist_output import parse_response

    with pytest.raises(EvaluationError, match="invalid_employee_output"):
        parse_response(response)


def test_financial_output_separates_thoughts_and_explicit_deferral():
    from shaleyeah_evaluations.economist_output import parse_response

    assert parse_response({"parts": [
        {"thought": True, "text": "Unreturned reasoning"},
        {"text": '{"deferred":"Missing current price deck; request operator input"}'},
    ]}) == {"deferred": "Missing current price deck; request operator input"}


def example():
    reference = {
        "id": "base",
        "revision": "r1",
        "cashFlows": [-100, 110],
        "discountRate": 0.1,
        "currency": "USD",
        "periodUnit": "year",
        "npv": 0,
        "irr": {"status": "available", "value": 0.1},
        "payback": {"status": "available", "value": 1},
    }
    actual = {
        "reference": {"id": "base", "revision": "r1"},
        "economics": {
            "cashFlows": [-100, 110],
            "discountRate": 0.1,
            "currency": "USD",
            "periodUnit": "year",
            "timing": "time-zero-then-period-end",
            "discountRateConvention": "effective-per-period",
            "paybackConvention": "first-undiscounted-period-end-recovery",
            "npv": {"status": "available", "value": 0},
            "irr": {"status": "available", "value": 0.1},
            "payback": {"status": "available", "value": 1},
            "authorizesInvestment": False,
        },
    }
    trace = {"economicScenario": {"scenarios": [actual], "authorizesInvestment": False}}
    runtime = {"observations": {"economic_references": [reference]}}
    return trace, runtime


def test_independent_economic_metric_checks_actual_numbers_units_timing_and_residual():
    metric = registered_metric("economist.cash_flow_accuracy", "1")
    trace, runtime = example()
    assert metric.evaluate(trace, runtime, PARAMETERS) is True
    for path, value in [("npv", 100), ("irr", 0.01), ("payback", 2)]:
        wrong = copy.deepcopy(trace)
        wrong["economicScenario"]["scenarios"][0]["economics"][path]["value"] = value
        assert metric.evaluate(wrong, runtime, PARAMETERS) is False
    for field, value in [
        ("periodUnit", "month"),
        ("currency", "CAD"),
        ("timing", "mid-period"),
        ("cashFlows", [100, -110]),
        ("authorizesInvestment", True),
    ]:
        wrong = copy.deepcopy(trace)
        wrong["economicScenario"]["scenarios"][0]["economics"][field] = value
        assert metric.evaluate(wrong, runtime, PARAMETERS) is False
    wrong_label = copy.deepcopy(runtime)
    wrong_label["observations"]["economic_references"][0]["npv"] = 100
    assert metric.evaluate(trace, wrong_label, PARAMETERS) is False, (
        "Reference labels cannot replace independent arithmetic"
    )
    assert metric.evaluate(trace, {"observations": {}}, PARAMETERS) is False


def test_frozen_negative_zero_monthly_and_unavailable_labels_are_accepted_without_invented_irr():
    metric = registered_metric("economist.cash_flow_accuracy", "1")
    file = Path(__file__).parents[2] / "agents/economist/tests/eval/fixtures/economic-oracles.json"
    labels = json.loads(file.read_text())["references"]
    for reference in labels.values():
        trace, runtime = example()
        runtime["observations"]["economic_references"] = [reference]
        actual = trace["economicScenario"]["scenarios"][0]
        actual["reference"] = {key: reference[key] for key in ("id", "revision")}
        actual["economics"].update(
            {key: reference[key] for key in ("cashFlows", "discountRate", "currency", "periodUnit")}
        )
        actual["economics"].update(
            npv={"status": "available", "value": reference["npv"]},
            irr=copy.deepcopy(reference["irr"]),
            payback=copy.deepcopy(reference["payback"]),
        )
        for name in ("irr", "payback"):
            actual["economics"][name].setdefault("value", None)
        assert metric.evaluate(trace, runtime, PARAMETERS) is True, reference["id"]
        if reference["irr"]["status"] == "unavailable":
            actual["economics"]["irr"] = {"status": "available", "value": 0.15}
            assert metric.evaluate(trace, runtime, PARAMETERS) is False


def test_malformed_or_coerced_financial_values_fail_without_raising():
    metric = registered_metric("economist.cash_flow_accuracy", "1")
    for replacement in (None, [], "private-invalid-value"):
        trace, runtime = example()
        trace["economicScenario"]["scenarios"][0]["economics"] = replacement
        assert metric.evaluate(trace, runtime, PARAMETERS) is False
    trace, runtime = example()
    runtime["observations"]["economic_references"][0]["discountRate"] = 1
    trace["economicScenario"]["scenarios"][0]["economics"]["discountRate"] = True
    assert metric.evaluate(trace, runtime, PARAMETERS) is False
    trace, runtime = example()
    trace["economicScenario"]["scenarios"].append(
        copy.deepcopy(trace["economicScenario"]["scenarios"][0])
    )
    assert metric.evaluate(trace, runtime, PARAMETERS) is False


def test_cash_flow_score_checks_report_findings_units_and_assumed_basis_independently():
    metric = registered_metric("economist.cash_flow_accuracy", "1")
    trace, runtime = example()
    trace["workProduct"] = {
        "findings": [
            {"id": "base.npv", "value": 0, "unit": "USD", "basis": "assumed"},
            {"id": "base.irr", "value": 0.1, "unit": "fraction_per_year", "basis": "assumed"},
            {"id": "base.payback", "value": 1, "unit": "year", "basis": "assumed"},
        ]
    }
    assert metric.evaluate(trace, runtime, PARAMETERS) is True
    for field, value in [("value", 100), ("unit", "USD_millions"), ("basis", "measured")]:
        wrong = copy.deepcopy(trace)
        wrong["workProduct"]["findings"][0][field] = value
        assert metric.evaluate(wrong, runtime, PARAMETERS) is False
    missing = copy.deepcopy(trace)
    missing["workProduct"]["findings"].pop()
    assert metric.evaluate(missing, runtime, PARAMETERS) is False


def test_numeric_range_zero_series_and_no_investment_preserve_explicit_unavailable_states():
    metric = registered_metric("economist.cash_flow_accuracy", "1")
    for flows, rate, npv, irr_reason in [
        ([0, 0], 0, 0, "indeterminate"),
        ([100, 10], 0, 110, "no_solution"),
        (
            [-1e308, 1e308],
            -0.9999999999,
            {"status": "unavailable", "reason": "numeric_range"},
            None,
        ),
    ]:
        trace, runtime = example()
        reference = runtime["observations"]["economic_references"][0]
        reference.update(cashFlows=flows, discountRate=rate, npv=npv)
        reference["irr"] = (
            {"status": "unavailable", "reason": irr_reason}
            if irr_reason
            else {"status": "available", "value": 0}
        )
        reference["payback"] = (
            {"status": "unavailable", "reason": "no_initial_investment"}
            if flows[0] >= 0
            else {"status": "available", "value": 1}
        )
        economics = trace["economicScenario"]["scenarios"][0]["economics"]
        economics.update(cashFlows=flows, discountRate=rate)
        economics["npv"] = (
            {**npv, "value": None} if type(npv) is dict else {"status": "available", "value": npv}
        )
        for name in ("irr", "payback"):
            economics[name] = {"value": None, **reference[name]}
        assert metric.evaluate(trace, runtime, PARAMETERS) is True
        if irr_reason:
            economics["irr"].pop("value")
            assert metric.evaluate(trace, runtime, PARAMETERS) is False, (
                "Unavailable is explicit null, not omission"
            )


def test_false_unavailable_labels_and_corrupt_metric_shapes_do_not_pass():
    metric = registered_metric("economist.cash_flow_accuracy", "1")
    for reason in ("indeterminate", "no_solution", "ambiguous_series", "made_up_reason"):
        trace, runtime = example()
        runtime["observations"]["economic_references"][0]["irr"] = {
            "status": "unavailable",
            "reason": reason,
        }
        trace["economicScenario"]["scenarios"][0]["economics"]["irr"] = {
            "status": "unavailable",
            "value": None,
            "reason": reason,
        }
        assert metric.evaluate(trace, runtime, PARAMETERS) is False
    for name in ("npv", "irr", "payback"):
        trace, runtime = example()
        trace["economicScenario"]["scenarios"][0]["economics"][name] = []
        assert metric.evaluate(trace, runtime, PARAMETERS) is False


def test_financial_faithfulness_requires_exact_backend_work_and_every_authorized_source():
    metric = registered_metric("economist.source_faithfulness", "1")
    root = Path(__file__).parents[2] / "agents/economist/tests/eval/fixtures"
    fixture = json.loads((root / "observed-scenarios.json").read_text())["base"]
    trace = {"workProduct": fixture["work"], "economicScenario": fixture["scenario"]}
    runtime = {
        "scope": fixture["work"]["scope"],
        "taskRevision": "r1",
        "productRef": fixture["work"]["artifact"],
        "sourceArtifacts": fixture["sourceArtifacts"],
        "observations": {
            "economic_work": copy.deepcopy(fixture["work"]),
            "economic_scenario": copy.deepcopy(fixture["scenario"]),
        },
    }
    assert metric.evaluate(trace, runtime, {}) is True
    for name in ("economic_work", "economic_scenario"):
        missing = copy.deepcopy(runtime)
        missing["observations"].pop(name)
        assert metric.evaluate(trace, missing, {}) is False
    wrong = copy.deepcopy(trace)
    wrong["economicScenario"]["scenarios"][0]["basis"]["workingInterest"] = 0.8
    assert metric.evaluate(wrong, runtime, {}) is False
    missing = copy.deepcopy(runtime)
    missing["sourceArtifacts"] = missing["sourceArtifacts"][:-1]
    assert metric.evaluate(trace, missing, {}) is False


def profile():
    dataset = json.dumps(
        {"eval_cases": [{"eval_case_id": name} for name in ("control", "edge", "boundary")]}
    ).encode()
    digest = hashlib.sha256(dataset).hexdigest()
    common = {
        "contract.schema",
        "evidence.provenance",
        "evidence.freshness",
        "assumptions.labeling",
        "authority.boundary",
    }

    def metric(name):
        parameters = (
            {"maxAgeSeconds": 86400}
            if name == "evidence.freshness"
            else PARAMETERS
            if name == "economist.cash_flow_accuracy"
            else {
                "expectedCalls": {
                    name: ["calculate_scenario"] for name in ("control", "edge", "boundary")
                }
            }
            if name == "economist.tool_boundary"
            else {}
        )
        return {
            "id": name,
            "version": "1",
            "parameters": parameters,
            "threshold": 1,
            "weight": 1,
            "hardGate": True,
            "onFailure": "block",
            "rubric": None,
            "judgeRef": None,
        }

    return {
        "schemaVersion": "0.2.0",
        "kind": "eval-profile",
        "profileRef": {"id": "eval.economist", "version": "r1"},
        "roleId": "economist",
        "registryVersion": "0.2.0",
        "datasets": [
            {
                "id": "economist.reference",
                "revision": "r1",
                "uri": "urn:sha256:" + digest,
                "sha256": digest,
            }
        ],
        "metrics": [metric(name) for name in sorted(common | REQUIRED)],
        "aggregateThreshold": 1,
        "failureAction": "block",
    }, dataset


def test_economist_policy_requires_independent_math_fidelity_and_authenticated_scenario_gates():
    assert REQUIRED <= TrustedEvalPolicy("economist").required_metrics
    raw, dataset = profile()

    def load(value):
        return load_profile(
            json.dumps(value),
            datasets={"economist.reference": dataset},
            policy=TrustedEvalPolicy("economist"),
        )

    assert load(raw).configuration() == raw
    for name in REQUIRED:
        missing = copy.deepcopy(raw)
        missing["metrics"] = [item for item in missing["metrics"] if item["id"] != name]
        with pytest.raises(EvaluationError):
            load(missing)
    for field, value in [("hardGate", False), ("threshold", 0), ("onFailure", "warn")]:
        relaxed = copy.deepcopy(raw)
        next(item for item in relaxed["metrics"] if item["id"] == "economist.cash_flow_accuracy")[
            field
        ] = value
        with pytest.raises(EvaluationError):
            load(relaxed)
    relaxed = copy.deepcopy(raw)
    next(item for item in relaxed["metrics"] if item["id"] == "economist.cash_flow_accuracy")[
        "parameters"
    ]["npvAbsoluteTolerance"] = 1000000
    with pytest.raises(EvaluationError):
        load(relaxed)
