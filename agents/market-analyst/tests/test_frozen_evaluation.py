"""Frozen metric acceptance, separate from actual native model/tool journey qualification."""

import copy
from types import SimpleNamespace

import pytest
from shaleyeah_evaluations import EvaluationError

from tests.eval.fixture_cases import BASE, IDENTITY, LABELS, fixture, profile


@pytest.mark.asyncio
@pytest.mark.parametrize("case", LABELS["cases"], ids=[case["id"] for case in LABELS["cases"]])
async def test_frozen_role_case_has_the_independent_expected_decision(case):
    from app.evaluation import grade_case

    native, context, _ = fixture(case)
    result = await grade_case(profile(), native, context=context, candidate=IDENTITY)
    assert result["status"] == case["expectedStatus"]
    assert set(case["requiredFailures"]) <= set(result["hardFailures"])


@pytest.mark.asyncio
async def test_grader_rejects_invalid_actual_output_instead_of_substituting_backend_work():
    from app.evaluation import grade_case

    native, context, _ = fixture(LABELS["cases"][0])
    native["responses"][0]["response"]["parts"][0]["text"] = (
        "Unstructured confident pricing narrative"
    )
    with pytest.raises(EvaluationError, match="invalid_employee_output"):
        await grade_case(profile(), native, context=context, candidate=IDENTITY)


def test_observations_come_from_native_wiring_and_are_detached_from_mutable_host_records():
    from app.agent import create_market_analyst_agent
    from app.evaluation import observe_market

    work = copy.deepcopy(BASE["work"])
    event = SimpleNamespace(
        actions=SimpleNamespace(transfer_to_agent=None, requested_tool_confirmations={"record": {}})
    )
    observed = observe_market(
        create_market_analyst_agent(),
        [event],
        observed_work=work,
        observed_market=BASE["market"],
        mandate=BASE["mandate"],
        series=BASE["series"],
        assumptions=BASE["assumptions"],
        write_dispatches=0,
        authorized_write_dispatches=0,
        unauthorized_actions=0,
        approval_required=True,
    )
    work["scope"]["assetId"] = "changed"
    assert observed["market_work"]["scope"]["assetId"] != "changed"
    assert observed["pending_confirmation"] is True
    assert observed["architecture_mode"] == "stand-alone-with-progressive-disclosure-skills"
