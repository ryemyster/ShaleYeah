"""Operator configuration cannot install code, relax trust or replace dataset bytes."""

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

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT.parent / "agents/geologist/tests/eval"
DATA = (GEO / "datasets/geologist-adk-reference.json").read_bytes()


def profile():
    return json.loads((GEO / "eval_config.json").read_text())


def load(value=None, **kwargs):
    return load_profile(
        json.dumps(profile() if value is None else value),
        datasets={"geologist.reference": DATA},
        policy=TrustedEvalPolicy("geologist"),
        **kwargs,
    )


def test_profile_round_trip_hash_and_registered_versions():
    loaded = load()
    assert loaded.configuration() == profile()
    assert load(loaded.configuration()).config_hash == loaded.config_hash
    assert len(loaded.config_hash) == 64
    assert loaded.dataset_hashes == (("geologist.reference", hashlib.sha256(DATA).hexdigest()),)
    assert registered_metric("authority.boundary", "1").kind == "deterministic"
    assert registered_metric("response.rubric", "1").kind == "judge"
    detached = loaded.configuration()
    detached["metrics"][0]["threshold"] = 0
    assert loaded.configuration()["metrics"][0]["threshold"] == 1


@pytest.mark.parametrize(
    "field,value",
    [
        ("schemaVersion", "9.0.0"),
        ("registryVersion", "latest"),
        ("roleId", "lawyer"),
        ("custom_function", "raise Exception('private-value')"),
        ("enabled", False),
    ],
)
def test_unsupported_or_executable_profiles_fail_value_free(field, value):
    raw = profile()
    raw[field] = value
    with pytest.raises(EvaluationError) as failure:
        load(raw)
    assert "private-value" not in str(failure.value)
    assert failure.value.code in {"invalid_profile", "unsupported_version", "policy_denied"}


@pytest.mark.parametrize(
    "field,value",
    [
        ("id", "python:os.system"),
        ("version", "latest"),
        ("threshold", 0),
        ("weight", 0),
        ("parameters", {"custom_function": "exec('private-value')"}),
        ("hardGate", False),
        ("onFailure", "warn"),
    ],
)
def test_required_metric_and_parameter_relaxation_is_rejected(field, value):
    raw = profile()
    raw["metrics"][0][field] = value
    with pytest.raises(EvaluationError):
        load(raw)


def test_all_required_trust_metrics_and_observed_approval_are_mandatory():
    for metric_id in (
        "contract.schema",
        "evidence.provenance",
        "evidence.freshness",
        "assumptions.labeling",
        "authority.boundary",
        "geologist.no_unapproved_persistence",
    ):
        raw = profile()
        raw["metrics"] = [m for m in raw["metrics"] if m["id"] != metric_id]
        with pytest.raises(EvaluationError, match="policy_denied"):
            load(raw)
    raw = profile()
    next(m for m in raw["metrics"] if m["id"] == "evidence.freshness")["parameters"][
        "maxAgeSeconds"
    ] = 100
    with pytest.raises(EvaluationError, match="policy_denied"):
        load_profile(
            json.dumps(raw),
            datasets={"geologist.reference": DATA},
            policy=TrustedEvalPolicy("geologist", max_source_age_seconds=50),
        )


def test_dataset_must_exist_and_match_exact_reviewed_bytes():
    for datasets in ({}, {"geologist.reference": DATA + b" "}, {"geologist.reference": "wrong"}):
        with pytest.raises(EvaluationError):
            load_profile(
                json.dumps(profile()), datasets=datasets, policy=TrustedEvalPolicy("geologist")
            )


def test_duplicate_ids_duplicate_json_and_non_json_values_are_rejected():
    raw = profile()
    raw["metrics"].append(copy.deepcopy(raw["metrics"][0]))
    with pytest.raises(EvaluationError):
        load(raw)
    for text in (
        '{"schemaVersion":"0.1.0","schemaVersion":"0.1.0"}',
        "NaN",
        "{}",
        "[1]",
        "x" * 65537,
    ):
        with pytest.raises(EvaluationError):
            load_profile(text, datasets={}, policy=TrustedEvalPolicy("geologist"))


def test_config_tuning_changes_hash_with_unchanged_installed_code():
    import shaleyeah_evaluations

    code = Path(shaleyeah_evaluations.__file__).read_bytes()
    initial = load()
    raw = profile()
    rubric = next(m for m in raw["metrics"] if m["id"] == "response.rubric")
    rubric.update(threshold=0.95, weight=3, rubric="Assess missing evidence explicitly.")
    tuned = load(raw)
    assert tuned.config_hash != initial.config_hash
    assert tuned.configuration()["metrics"][-1]["rubric"] == "Assess missing evidence explicitly."
    assert Path(shaleyeah_evaluations.__file__).read_bytes() == code


def test_profile_hash_is_portable_across_equivalent_json_number_spellings():
    raw = profile()
    raw["metrics"][0]["threshold"] = 1.0
    assert load(raw).config_hash == load().config_hash


def test_judge_reference_must_be_reviewed_and_contains_no_credentials():
    raw = profile()
    raw["metrics"][-1]["judgeRef"] = {"id": "judge.other", "version": "r1"}
    with pytest.raises(EvaluationError, match="policy_denied"):
        load(raw)
    raw["metrics"][-1]["judgeRef"] = {
        "id": "judge.geologist",
        "version": "r1",
        "apiKey": "private-value",
    }
    with pytest.raises(EvaluationError):
        load(raw)
