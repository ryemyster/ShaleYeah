import copy
import json
from pathlib import Path

import pytest

from shaleyeah_evaluations import EvaluationError, TrustedEvalPolicy, load_profile

ROOT = Path(__file__).parents[1] / "fixtures/market"
PROFILE = json.loads((ROOT / "performance_profile.json").read_text())
DATASET = (ROOT / "market-performance.json").read_bytes()


def load(profile):
    return load_profile(
        json.dumps(profile),
        datasets={"market.reference": DATASET},
        policy=TrustedEvalPolicy(profile["roleId"]),
    )


def test_market_profile_loads_all_frozen_cases_and_configurable_bounded_tolerances():
    loaded = load(PROFILE)
    assert len(loaded.case_ids) == 21
    revised = copy.deepcopy(PROFILE)
    metric = next(
        item for item in revised["metrics"] if item["id"] == "market.transformation_accuracy"
    )
    metric["parameters"]["absoluteTolerance"] = 0.00001
    assert load(revised).config_hash != loaded.config_hash


@pytest.mark.parametrize("change", ["remove", "soften", "loosen", "role", "tolerance", "dataset"])
def test_market_profile_cannot_drop_required_truth_or_authority_gates(change):
    revised = copy.deepcopy(PROFILE)
    metric = next(
        item for item in revised["metrics"] if item["id"] == "market.transformation_accuracy"
    )
    if change == "remove":
        revised["metrics"].remove(metric)
    elif change == "soften":
        metric["hardGate"] = False
    elif change == "loosen":
        metric["threshold"] = 0.8
    elif change == "role":
        revised["roleId"] = "unrelated-role"
    elif change == "tolerance":
        metric["parameters"]["absoluteTolerance"] = 1
    else:
        revised["datasets"][0]["sha256"] = "0" * 64
    with pytest.raises(EvaluationError):
        load(revised)
