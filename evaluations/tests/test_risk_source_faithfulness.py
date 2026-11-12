"""Canonical observed-record equality; numerical correctness has separate authored controls."""

import copy
import json
from pathlib import Path

from shaleyeah_evaluations import registered_metric


def example():
    # Existing package-owned canonical synthetic records supply wire shapes only.
    source = json.loads(
        (Path(__file__).parents[1] / "fixtures/reservoir/observed-forecasts.json").read_text()
    )["harmonic"]
    work = copy.deepcopy(source["work"])
    packet = {"riskAccepted": False, "summary": {"expectedLoss": 80}}
    return (
        {"workProduct": work, "riskPacket": packet},
        {
            "scope": work["scope"],
            "taskRevision": work["taskRevision"],
            "productRef": work["artifact"],
            "sourceArtifacts": copy.deepcopy(source["sourceArtifacts"]),
            "observations": {
                "risk_work": copy.deepcopy(work),
                "risk_packet": copy.deepcopy(packet),
            },
        },
    )


def test_exact_actual_work_and_all_three_current_sources_are_required():
    metric = registered_metric("risk.source_faithfulness", "1")
    trace, runtime = example()
    assert metric.evaluate(trace, runtime, {}) is True
    trace["riskPacket"]["summary"]["expectedLoss"] = 81
    assert metric.evaluate(trace, runtime, {}) is False
    trace, runtime = example()
    runtime["sourceArtifacts"].pop()
    assert metric.evaluate(trace, runtime, {}) is False
    trace, runtime = example()
    runtime["observations"]["risk_packet"]["riskAccepted"] = True
    assert metric.evaluate(trace, runtime, {}) is False
    trace, runtime = example()
    trace["riskPacket"]["summary"]["expectedLoss"] = True
    runtime["observations"]["risk_packet"]["summary"]["expectedLoss"] = 1
    assert metric.evaluate(trace, runtime, {}) is False
