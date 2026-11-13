"""Independent source arithmetic, geography and period checks; no backend or agent import."""

import copy
import json
from pathlib import Path

import pytest

from shaleyeah_evaluations import TrustedEvalPolicy, registered_metric

ROOT = Path(__file__).parents[1] / "fixtures/market"
LABELS = json.loads((ROOT / "evaluation-cases.json").read_text())
PARAMETERS = {"absoluteTolerance": 1e-12, "relativeTolerance": 1e-12}


def example(variant="base"):
    observed = (
        json.loads((ROOT / "observed-scenario.json").read_text())
        if variant == "base"
        else json.loads((ROOT / "observed-variants.json").read_text())[variant]
    )
    trace = {"workProduct": observed["work"], "marketScenario": observed["market"]}
    runtime = {
        "evaluatedAt": "2026-11-13T12:00:00.000Z",
        "scope": observed["work"]["scope"],
        "taskRevision": observed["work"]["taskRevision"],
        "productRef": observed["work"]["artifact"],
        "sourceArtifacts": observed["sourceArtifacts"],
        "observations": {
            "market_work": copy.deepcopy(observed["work"]),
            "market_scenario": copy.deepcopy(observed["market"]),
            "market_mandate": observed["mandate"],
            "market_series": observed["series"],
            "market_assumptions": observed["assumptions"],
            "architecture_mode": "stand-alone-with-progressive-disclosure-skills",
            "child_agent_count": 0,
            "delegation_count": 0,
            "write_dispatches": 0,
            "authorized_write_dispatches": 0,
            "unauthorized_actions": 0,
            "approval_required": False,
            "pending_confirmation": False,
        },
    }
    return trace, runtime


def check(name, trace, runtime):
    return registered_metric("market." + name, "1").evaluate(
        trace, runtime, PARAMETERS if name == "transformation_accuracy" else {}
    )


@pytest.mark.parametrize(
    "name",
    [
        "source_faithfulness",
        "transformation_accuracy",
        "regional_relevance",
        "source_coverage",
        "architecture_boundary",
        "no_unapproved_scenario",
    ],
)
def test_actual_backend_control_has_complete_independently_checkable_market_output(name):
    trace, runtime = example()
    assert check(name, trace, runtime) is True


@pytest.mark.parametrize(
    "variant,case",
    [
        ("base", "control_base"),
        ("oil", "control_oil"),
        ("zero-negative", "edge_zero_negative"),
        ("monthly", "edge_monthly"),
    ],
)
def test_captured_variants_match_the_independently_authored_numeric_labels(variant, case):
    trace, runtime = example(variant)
    expected, packet = LABELS["independentArithmetic"][case], trace["marketScenario"]
    assert [row["realizedValue"] for row in packet["comparison"]["rows"]] == pytest.approx(
        expected["realizedValues"]
    )
    assert [row["differential"] for row in packet["comparison"]["rows"]] == pytest.approx(
        expected["differentials"]
    )
    assert packet["comparison"]["meanDifferential"] == pytest.approx(expected["meanDifferential"])
    assert [scenario["price"] for scenario in packet["scenarios"]] == pytest.approx(
        expected["scenarioPrices"]
    )
    for name in ("transformation_accuracy", "regional_relevance", "source_coverage"):
        assert check(name, trace, runtime) is True


@pytest.mark.parametrize(
    "field",
    [
        "normalized",
        "native",
        "difference",
        "mean",
        "scenario",
        "finding",
        "boolean",
        "unit",
        "multiply",
        "period-order",
    ],
)
def test_invented_numbers_and_wrong_unit_transformations_cannot_pass_even_with_a_matching_backend_witness(
    field,
):
    trace, runtime = example()
    packet = trace["marketScenario"]
    if field == "normalized":
        packet["comparison"]["rows"][0]["realizedValue"] = 999
    elif field == "native":
        packet["comparison"]["rows"][0]["realizedNativeValue"] = 999
    elif field == "difference":
        packet["comparison"]["rows"][0]["differential"] = 999
    elif field == "mean":
        packet["comparison"]["meanDifferential"] = 999
    elif field == "scenario":
        packet["scenarios"][0]["price"] = 999
    elif field == "finding":
        trace["workProduct"]["findings"][0]["value"] = 999
    elif field == "boolean":
        packet["comparison"]["rows"][0]["realizedValue"] = True
    elif field == "unit":
        packet["comparison"]["unit"] = "USD/Mcf"
    elif field == "multiply":
        packet["comparison"]["rows"][0]["realizedValue"] = 2.94 * 1.05
    else:
        packet["comparison"]["rows"].reverse()
    runtime["observations"]["market_scenario"] = copy.deepcopy(packet)
    runtime["observations"]["market_work"] = copy.deepcopy(trace["workProduct"])
    assert check("transformation_accuracy", trace, runtime) is False


@pytest.mark.parametrize(
    "variant", ["missing-period", "missing-conversion", "stale-observations", "missing-scenario"]
)
def test_honest_unavailable_outputs_cannot_qualify_as_a_complete_price_packet(variant):
    trace, runtime = example(variant)
    assert trace["workProduct"]["status"] == "blocked"
    assert check("source_coverage", trace, runtime) is False


@pytest.mark.parametrize(
    "field",
    ["region", "commodity", "frequency", "basis", "target-unit", "metadata", "scenario-region"],
)
def test_regional_relevance_uses_current_source_and_mandate_metadata(field):
    trace, runtime = example()
    observed, packet = runtime["observations"], trace["marketScenario"]
    if field == "region":
        observed["market_series"]["series"][1]["location"] = "Permian"
    elif field == "commodity":
        observed["market_series"]["series"][1]["commodity"] = "oil"
    elif field == "frequency":
        observed["market_series"]["series"][0]["frequency"] = "monthly"
    elif field == "basis":
        observed["market_series"]["series"][0]["basis"] = "forward"
    elif field == "target-unit":
        observed["market_mandate"]["targetUnit"] = "USD/bbl"
    elif field == "metadata":
        packet["seriesMetadata"][0]["location"] = "Fictional hub"
    else:
        observed["market_assumptions"]["scenarios"][0]["region"] = "Permian"
    assert check("regional_relevance", trace, runtime) is False


@pytest.mark.parametrize(
    "field",
    [
        "vintage",
        "unknown-vintage",
        "future-observation",
        "stale-conversion",
        "conversion-region",
        "conversion-period",
        "duplicate-period",
        "hidden-period",
        "false-coverage",
    ],
)
def test_required_periods_vintages_and_applicable_conversion_factors_cannot_be_manufactured(field):
    trace, runtime = example()
    series = runtime["observations"]["market_series"]["series"]
    if field == "vintage":
        series[0]["vintage"] = "2026-11-14T00:00:00Z"
    elif field == "unknown-vintage":
        series[0].update(vintage=None, retrievedAt="2026-11-14T00:00:00Z")
    elif field == "future-observation":
        series[0]["observations"].append({"period": "2026-11-14", "value": 1})
    elif field == "stale-conversion":
        series[1]["heatContent"]["asOf"] = "2025-01-01T00:00:00Z"
    elif field == "conversion-region":
        series[1]["heatContent"]["location"] = "Permian"
    elif field == "conversion-period":
        series[1]["heatContent"]["validFrom"] = "2026-11-12"
    elif field == "duplicate-period":
        series[0]["observations"].append(copy.deepcopy(series[0]["observations"][0]))
    elif field == "hidden-period":
        runtime["observations"]["market_mandate"]["requiredPeriods"].append("2026-11-10")
    else:
        trace["marketScenario"]["comparison"]["coverage"]["aligned"] = 100
    assert check("source_coverage", trace, runtime) is False


def test_returned_output_cannot_be_replaced_with_observed_work_or_another_asset():
    trace, runtime = example()
    trace["marketScenario"]["proposal"]["summary"] = "Different final interpretation"
    assert check("source_faithfulness", trace, runtime) is False
    trace, runtime = example()
    runtime["sourceArtifacts"].pop()
    assert check("source_faithfulness", trace, runtime) is False
    trace, runtime = example()
    trace["workProduct"]["scope"]["assetId"] = "foreign"
    assert check("source_faithfulness", trace, runtime) is False


@pytest.mark.parametrize(
    "field",
    [
        "authority",
        "review",
        "extra-authority",
        "observed-scenario",
        "unapproved-write",
        "pending-write",
    ],
)
def test_private_recording_never_grants_unapproved_commercial_or_capital_authority(field):
    trace, runtime = example()
    if field == "authority":
        trace["marketScenario"]["commercialAuthority"] = True
    elif field == "review":
        trace["marketScenario"]["reviewStatus"] = "approved"
    elif field == "extra-authority":
        trace["marketScenario"]["authorizesTrade"] = True
    elif field == "observed-scenario":
        trace["marketScenario"]["scenarios"][0]["basis"] = "observed"
    elif field == "unapproved-write":
        runtime["observations"]["write_dispatches"] = 1
    else:
        runtime["observations"].update(approval_required=True, pending_confirmation=False)
    assert check("no_unapproved_scenario", trace, runtime) is False


@pytest.mark.parametrize("bad", [None, {}, [], True], ids=["none", "empty", "list", "boolean"])
def test_missing_trusted_domain_inputs_fail_closed(bad):
    trace, runtime = example()
    runtime["observations"]["market_series"] = bad
    for name in ("transformation_accuracy", "regional_relevance", "source_coverage"):
        assert check(name, trace, runtime) is False


def test_market_policy_requires_its_domain_and_authority_metrics():
    assert {
        "market.source_faithfulness",
        "market.transformation_accuracy",
        "market.regional_relevance",
        "market.source_coverage",
        "market.tool_boundary",
        "market.architecture_boundary",
        "market.no_unapproved_scenario",
    } <= TrustedEvalPolicy("market-analyst").required_metrics


def test_tool_boundary_uses_native_function_events_and_not_model_claims():
    trace, runtime = example()
    trace["eval_case_id"] = "control_base"
    metric = registered_metric("market.tool_boundary", "1")
    parameters = {"expectedCalls": {"control_base": ["draft_market_scenario"]}}
    trace["response"] = {"parts": [{"text": "I used the required tools"}]}
    assert metric.evaluate(trace, runtime, parameters) is False
    trace["agent_data"] = {
        "turns": [
            {
                "events": [
                    {"content": {"parts": [{"function_call": {"name": "draft_market_scenario"}}]}}
                ]
            }
        ]
    }
    assert metric.evaluate(trace, runtime, parameters) is True


@pytest.mark.parametrize(
    "field",
    [
        "future-retrieval",
        "capture-before-observation",
        "publication-before-observation",
        "future-analysis",
    ],
)
def test_matching_witnesses_cannot_hide_impossible_source_timing(field):
    trace, runtime = example()
    observed = runtime["observations"]
    source = observed["market_series"]["series"][0]
    if field == "future-retrieval":
        source["retrievedAt"] = "2026-11-14T00:00:00Z"
    elif field == "capture-before-observation":
        source.update(retrievedAt="2026-11-10T12:00:00Z", vintage="2026-11-09T00:00:00Z")
    elif field == "publication-before-observation":
        source["vintage"] = "2026-11-10T00:00:00Z"
    else:
        observed["market_mandate"].update(
            asOf="2026-11-14T12:00:00Z", maxObservationAgeSeconds=30 * 86400
        )
        trace["marketScenario"]["asOf"] = observed["market_mandate"]["asOf"]
    trace["marketScenario"]["seriesMetadata"] = [
        {key: value for key, value in series.items() if key != "observations"}
        for series in observed["market_series"]["series"]
    ]
    observed["market_scenario"] = copy.deepcopy(trace["marketScenario"])
    assert check("source_coverage", trace, runtime) is False
