import importlib.util
from pathlib import Path

import pytest


@pytest.mark.asyncio
async def test_all_configured_case_families_qualify_with_expected_failures_and_no_professional_claim():
    file = Path(__file__).parent / "eval/run_fixture_evals.py"
    spec = importlib.util.spec_from_file_location("reporter_fixture", file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    decision, bundle, policy = await module.frozen_run()
    assert decision["status"] == "passed", decision["failures"]
    assert len(decision["cases"]) == 6
    assert decision["professionalAcceptance"] is False
    assert decision["promotionAllowed"] is False
    assert bundle["profile"]["roleId"] == policy["roleId"] == "reporter"
