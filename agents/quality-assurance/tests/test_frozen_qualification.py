import importlib.util
from pathlib import Path

import pytest


@pytest.mark.asyncio
async def test_frozen_qa_corpus_checks_expected_failures_without_professional_acceptance():
    file = Path(__file__).parent / "eval/run_fixture_evals.py"
    spec = importlib.util.spec_from_file_location("qa_fixture", file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    decision, bundle, policy = await module.frozen_run()
    assert decision["status"] == "passed", decision["failures"]
    assert len(decision["cases"]) == 7
    assert decision["professionalAcceptance"] is decision["promotionAllowed"] is False
    assert bundle["profile"]["roleId"] == policy["roleId"] == "quality-assurance"
