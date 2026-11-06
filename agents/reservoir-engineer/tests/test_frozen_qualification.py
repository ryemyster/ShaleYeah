import copy
import importlib.util
import json
import shutil
from pathlib import Path

import pytest
from shaleyeah_evaluations import EvaluationError


@pytest.mark.asyncio
async def test_frozen_forecast_counterexamples_remain_provisional_and_cover_every_configured_case():
    dataset = json.loads(
        (Path(__file__).parent / "eval/datasets/reservoir-performance.json").read_text()
    )
    assert dataset["architectureMode"] == "Stand-alone Agent with Progressive Disclosure (Skills)"
    assert (
        dataset["humanReviewBoundary"]
        == "exact-authenticated-forecast-review-no-reserves-or-capital-authority"
    )
    file = Path(__file__).parent / "eval/run_fixture_evals.py"
    spec = importlib.util.spec_from_file_location("reservoir-engineer_fixture", file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    decision, bundle, policy = await module.frozen_run()
    assert decision["status"] == "passed", decision["failures"]
    assert len(decision["cases"]) == 21
    assert decision["professionalAcceptance"] is decision["promotionAllowed"] is False
    assert bundle["profile"]["roleId"] == policy["roleId"] == "reservoir-engineer"
    assert {c["status"] for c in decision["cases"]} == {"passed", "blocked"}


@pytest.mark.asyncio
async def test_current_packet_cannot_replace_the_frozen_forecast_answer_with_backend_invented_math():
    root = Path(__file__).parent / "eval"
    spec = importlib.util.spec_from_file_location(
        "reservoir-engineer_current", root / "run_fixture_evals.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    current = json.loads((root / "fixtures/observed-forecasts.json").read_text())["harmonic"]
    current["evaluatedAt"] = "2026-01-02T12:00:00Z"
    decision, _, _ = await module.frozen_run(current=current)
    assert decision["status"] == "passed", decision["failures"]
    wrong = copy.deepcopy(current)
    wrong["forecast"]["forecasts"][0]["modeled"]["cumulativeProduction"]["value"] = 500
    wrong["work"]["findings"][0]["value"] = 500
    decision, _, _ = await module.frozen_run(current=wrong)
    assert decision["status"] == "blocked"
    assert any(item.get("caseId") == "control_base" for item in decision["failures"])


def test_changed_forecast_reference_bytes_require_an_explicit_dataset_revision(tmp_path):
    root = Path(__file__).parent / "eval"
    spec = importlib.util.spec_from_file_location(
        "reservoir-engineer_binding", root / "run_fixture_evals.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    for name in (
        "performance_profile.json",
        "datasets/reservoir-performance.json",
        "fixtures/forecast-oracles.json",
        "fixtures/observed-forecasts.json",
    ):
        target = tmp_path / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(root / name, target)
    module.ROOT = tmp_path
    assert module.configured()[0].configuration()["roleId"] == "reservoir-engineer"
    oracle = tmp_path / "fixtures/forecast-oracles.json"
    oracle.write_text(oracle.read_text() + "\n")
    with pytest.raises(EvaluationError, match="forecast_reference_mismatch"):
        module.configured()


@pytest.mark.asyncio
async def test_native_output_is_graded_even_when_the_trusted_backend_result_is_correct():
    root = Path(__file__).parent / "eval"
    spec = importlib.util.spec_from_file_location(
        "reservoir-engineer_native", root / "run_fixture_evals.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    current = json.loads((root / "fixtures/observed-forecasts.json").read_text())["harmonic"]
    current["evaluatedAt"] = "2026-01-02T12:00:00Z"
    wrong = copy.deepcopy(current["work"])
    wrong["findings"][0]["value"] = 500
    current["native"] = {
        "responses": [
            {
                "response": {
                    "parts": [
                        {"text": json.dumps({"work": wrong, "forecast": current["forecast"]})}
                    ]
                }
            }
        ],
        "agent_data": {
            "turns": [
                {
                    "events": [
                        {
                            "content": {
                                "parts": [{"function_call": {"name": "draft_forecast", "args": {}}}]
                            }
                        }
                    ]
                }
            ]
        },
    }
    decision, _, _ = await module.frozen_run(current=current)
    assert decision["status"] == "blocked"
    assert any(case.get("caseId") == "control_base" for case in decision["failures"])
