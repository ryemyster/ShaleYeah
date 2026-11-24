import copy
import importlib.util
import json
import shutil
from pathlib import Path

import pytest
from shaleyeah_evaluations import EvaluationError

ROOT = Path(__file__).parent / "eval"


def runner():
    spec = importlib.util.spec_from_file_location("risk_fixture", ROOT / "run_fixture_evals.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.asyncio
async def test_every_frozen_control_edge_and_authority_case_is_required_and_remains_provisional():
    decision, bundle, policy = await runner().frozen_run()
    assert decision["status"] == "passed", decision["failures"]
    assert len(decision["cases"]) == 18
    assert decision["promotionAllowed"] is decision["professionalAcceptance"] is False
    assert {c["status"] for c in decision["cases"]} == {"passed", "blocked"}
    assert bundle["profile"]["roleId"] == policy["roleId"] == "risk-analyst"


@pytest.mark.asyncio
async def test_current_backend_math_and_actual_native_output_have_independent_failure_paths():
    module = runner()
    current = json.loads((ROOT / "fixtures/observed-risks.json").read_text())["dependent"]
    decision, _, _ = await module.frozen_run(current=current)
    assert decision["status"] == "passed", decision["failures"]
    wrong = copy.deepcopy(current)
    wrong["risk"]["summary"]["expectedLoss"] = 999
    wrong["work"]["findings"][0]["value"] = 999
    decision, _, _ = await module.frozen_run(current=wrong)
    assert decision["status"] == "blocked"
    work = copy.deepcopy(current["work"])
    work["findings"][0]["value"] = 999
    current["native"] = {
        "responses": [
            {"response": {"parts": [{"text": json.dumps({"work": work, "risk": current["risk"]})}]}}
        ],
        "agent_data": {
            "turns": [
                {
                    "events": [
                        {
                            "content": {
                                "parts": [{"function_call": {"name": "draft_risk", "args": {}}}]
                            }
                        }
                    ]
                }
            ]
        },
    }
    decision, _, _ = await module.frozen_run(current=current)
    assert decision["status"] == "blocked"
    assert any(f.get("caseId") == "control_base" for f in decision["failures"])


def test_frozen_source_reference_bytes_are_bound_into_the_dataset(tmp_path):
    module = runner()
    for name in (
        "performance_profile.json",
        "datasets/risk-performance.json",
        "fixtures/joint-scenario-oracles.json",
        "fixtures/observed-risks.json",
    ):
        target = tmp_path / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / name, target)
    module.ROOT = tmp_path
    assert module.configured()[0].configuration()["roleId"] == "risk-analyst"
    file = tmp_path / "fixtures/joint-scenario-oracles.json"
    file.write_text(file.read_text() + "\n")
    with pytest.raises(EvaluationError, match="risk_reference_mismatch"):
        module.configured()
