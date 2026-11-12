import asyncio
import copy
import importlib.util
import json
import shutil
from pathlib import Path

import pytest
from shaleyeah_evaluations import EvaluationError

ROOT = Path(__file__).parent / "eval"


def runner():
    spec = importlib.util.spec_from_file_location("legal_fixture", ROOT / "run_fixture_evals.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_every_frozen_legal_case_is_required_and_remains_provisional():
    decision, bundle, policy = asyncio.run(runner().frozen_run())
    assert decision["status"] == "passed", decision["failures"]
    assert len(decision["cases"]) == 20
    assert decision["promotionAllowed"] is decision["professionalAcceptance"] is False
    assert {case["status"] for case in decision["cases"]} == {"passed", "blocked"}
    assert bundle["profile"]["roleId"] == policy["roleId"] == "legal-analyst"


def test_actual_returned_native_memo_cannot_be_replaced_by_correct_backend_work():
    current = json.loads((ROOT / "fixtures/observed-memo.json").read_text())
    module = runner()
    decision, _, _ = asyncio.run(module.frozen_run(current=current))
    assert decision["status"] == "passed", decision["failures"]
    wrong = copy.deepcopy(current)
    wrong["legal"]["issues"][0]["citations"][0]["quote"] = "No approval required"
    decision, _, _ = asyncio.run(module.frozen_run(current=wrong))
    assert decision["status"] == "blocked"
    returned_work = copy.deepcopy(current["work"])
    returned_work["findings"][0]["value"] = "No approval required"
    current["native"] = {
        "responses": [
            {
                "response": {
                    "parts": [
                        {"text": json.dumps({"work": returned_work, "legal": current["legal"]})}
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
                                "parts": [
                                    {"function_call": {"name": "draft_legal_memo", "args": {}}}
                                ]
                            }
                        }
                    ]
                }
            ]
        },
    }
    decision, _, _ = asyncio.run(module.frozen_run(current=current))
    assert decision["status"] == "blocked"
    assert any(failure.get("caseId") == "control_base" for failure in decision["failures"])


def test_source_labels_and_observed_variants_are_exactly_bound_into_dataset(tmp_path):
    module = runner()
    for name in (
        "performance_profile.json",
        "datasets/legal-performance.json",
        "fixtures/source-oracles.json",
        "fixtures/evaluation-cases.json",
        "fixtures/observed-memo.json",
        "fixtures/observed-variants.json",
    ):
        target = tmp_path / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / name, target)
    module.ROOT = tmp_path
    assert module.configured()[0].configuration()["roleId"] == "legal-analyst"
    file = tmp_path / "fixtures/source-oracles.json"
    file.write_text(file.read_text() + "\n")
    with pytest.raises(EvaluationError, match="legal_reference_mismatch"):
        module.configured()
