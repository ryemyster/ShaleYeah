"""Independent numeric/evidence/authority sensitivity checks for supplied drilling packets."""

import copy
import json
from pathlib import Path

import pytest

from shaleyeah_evaluations.drilling import (
    cost_schedule_arithmetic,
    evidence_traceability,
    hazard_offset_coverage,
    no_drilling_authority,
    unit_design_consistency,
)

ROOT = Path(__file__).parents[1] / "fixtures" / "drilling"


def observed():
    f = json.loads((ROOT / "observed-packet.json").read_text())
    return {"workProduct": f["work"], "drillingPacket": f["drilling"]}, {
        "observations": {"drilling_" + key: f[key] for key in ("design", "corpus", "policy")}
    }


@pytest.mark.parametrize(
    "metric",
    [
        unit_design_consistency,
        cost_schedule_arithmetic,
        hazard_offset_coverage,
        evidence_traceability,
    ],
)
def test_independent_checks_accept_actual_backend_observations(metric):
    trace, runtime = observed()
    assert metric(trace, runtime, {})


@pytest.mark.parametrize(
    "mutate,metric",
    [
        (
            lambda p: p["programs"][0]["sections"][0].update(bottomMdMetres="1/1"),
            unit_design_consistency,
        ),
        (lambda p: p["costs"][0].update(totalExact="1/1"), cost_schedule_arithmetic),
        (lambda p: p["costs"][0].update(totalCents="45000001"), cost_schedule_arithmetic),
        (lambda p: p["schedules"][0].update(totalDays="20/1"), cost_schedule_arithmetic),
        (lambda p: p.update(offsets=[]), hazard_offset_coverage),
        (lambda p: p["hazards"][0].update(severity="operator-low"), hazard_offset_coverage),
        (
            lambda p: p["observations"][0]["citations"][0].update(quote="Approved to spud"),
            evidence_traceability,
        ),
        (lambda p: p["observations"][0]["citations"][0].update(startByte=1), evidence_traceability),
    ],
)
def test_one_field_forgery_fails_its_independent_check(mutate, metric):
    trace, runtime = observed()
    mutate(trace["drillingPacket"])
    assert not metric(trace, runtime, {})


def test_professional_or_operational_approval_is_never_inferred_from_packet_state():
    trace, _ = observed()
    assert no_drilling_authority(trace)
    for field in ("operationalApproval", "professionalAcceptance"):
        forged = copy.deepcopy(trace)
        forged["drillingPacket"][field] = True
        assert not no_drilling_authority(forged)


def test_common_work_findings_must_project_independently_checked_packet_values():
    trace, runtime = observed()
    trace["workProduct"]["findings"][0]["value"] = "1/1"
    assert not cost_schedule_arithmetic(trace, runtime, {})


@pytest.mark.parametrize(
    "metric",
    [
        unit_design_consistency,
        cost_schedule_arithmetic,
        hazard_offset_coverage,
        evidence_traceability,
    ],
)
def test_malformed_or_foreign_inputs_fail_closed(metric):
    trace, runtime = observed()
    runtime["observations"]["drilling_corpus"]["documents"][0]["wellRef"]["id"] = "well.foreign"
    assert not metric(trace, runtime, {})


LABELS = json.loads((ROOT / "case-labels.json").read_text())


@pytest.mark.parametrize("label", [v for v in LABELS if v["exceptionCodes"]], ids=lambda v: v["id"])
def test_frozen_missing_or_mismatched_basis_cannot_receive_design_qualification(label):
    trace, runtime = observed()
    for change in label["changes"]:
        target = runtime["observations"]["drilling_" + change["path"][0]]
        for part in change["path"][1:-1]:
            target = target[part]
        target[change["path"][-1]] = copy.deepcopy(change["value"])
    assert not unit_design_consistency(trace, runtime, {})


@pytest.mark.parametrize(
    "name", ["control_metric_equivalent", "edge_explicit_zero_quote", "edge_fractional_quote"]
)
def test_changed_synthetic_inputs_use_actual_observations_and_independent_exact_arithmetic(name):
    f = json.loads((ROOT / "observed-variants.json").read_text())[name]
    trace = {"workProduct": f["work"], "drillingPacket": f["drilling"]}
    runtime = {
        "observations": {"drilling_" + key: f[key] for key in ("design", "corpus", "policy")}
    }
    assert unit_design_consistency(trace, runtime, {})
    assert cost_schedule_arithmetic(trace, runtime, {})
    assert evidence_traceability(trace, runtime, {})
