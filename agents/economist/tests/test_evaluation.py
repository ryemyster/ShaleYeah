import copy
import json
from pathlib import Path

import pytest
from shaleyeah_evaluations import (
    EvaluationContext,
    EvaluationError,
    TrustedEvalPolicy,
    load_profile,
)

from app.agent import create_economist_agent
from app.evaluation import grade_case, observe_economist

ROOT = Path(__file__).parent / "eval"


def configured(value=None):
    return load_profile(
        (ROOT / "performance_profile.json").read_bytes() if value is None else json.dumps(value),
        datasets={
            "economist.reference": (ROOT / "datasets/economist-performance.json").read_bytes()
        },
        policy=TrustedEvalPolicy("economist"),
    )


def test_existing_criteria_are_editable_but_financial_and_authority_floors_cannot_be_removed():
    raw = configured().configuration()
    tuned = copy.deepcopy(raw)
    next(m for m in tuned["metrics"] if m["id"] == "economist.cash_flow_accuracy")["parameters"][
        "npvAbsoluteTolerance"
    ] = 0.00001
    assert configured(tuned).config_hash != configured().config_hash
    for name in ("economist.cash_flow_accuracy", "economist.source_faithfulness"):
        altered = copy.deepcopy(raw)
        altered["metrics"] = [m for m in altered["metrics"] if m["id"] != name]
        with pytest.raises(EvaluationError):
            configured(altered)


@pytest.mark.asyncio
async def test_actual_backend_packet_is_checked_against_independent_frozen_math_and_source_observation():
    fixture = json.loads((ROOT / "fixtures/observed-scenarios.json").read_text())["base"]
    oracle = json.loads((ROOT / "fixtures/economic-oracles.json").read_text())["references"]["base"]
    work, scenario = fixture["work"], fixture["scenario"]
    observed = observe_economist(
        create_economist_agent(),
        [],
        observed_work=work,
        observed_scenario=scenario,
        references=[oracle],
        write_dispatches=0,
        authorized_write_dispatches=0,
        unauthorized_actions=0,
        approval_required=False,
    )
    context = EvaluationContext.from_trusted_runtime(
        scope=work["scope"],
        task_revision=work["taskRevision"],
        product_ref=work["artifact"],
        evaluated_at="2026-10-19T12:00:00Z",
        source_artifacts=fixture["sourceArtifacts"],
        observations=observed,
    )
    # This short constructed trace tests the grading adapter only. Native MCP traces
    # are generated separately and are required for employee qualification.
    native = {
        "eval_case_id": "control_base",
        "responses": [
            {"response": {"parts": [{"text": json.dumps({"work": work, "scenario": scenario})}]}}
        ],
        "agent_data": {
            "turns": [
                {
                    "events": [
                        {
                            "content": {
                                "parts": [{"function_call": {"name": "draft_scenario", "args": {}}}]
                            }
                        }
                    ]
                }
            ]
        },
    }
    candidate = {
        "id": "fixture.economist",
        "version": "r1",
        "model": {"provider": "fixture", "id": "financial-reference", "revision": "r1"},
        "runtime": {"id": "google-adk", "version": "2.4.0"},
        "harness": {"id": "shaleyeah-fixture-runner", "version": "0.1.0"},
        "qualification": "fixture",
    }
    options = dict(context=context, candidate=candidate)
    result = await grade_case(configured(), native, **options)
    assert result["status"] == "passed", [(m["id"], m["status"]) for m in result["metrics"]]
    for field, value in [("basis", "measured"), ("unit", "CAD"), ("value", 500)]:
        wrong = copy.deepcopy(work)
        wrong["findings"][0][field] = value
        wrong_native = copy.deepcopy(native)
        wrong_native["responses"][0]["response"]["parts"][0]["text"] = json.dumps(
            {"work": wrong, "scenario": scenario}
        )
        result = await grade_case(configured(), wrong_native, **options)
        assert result["status"] == "blocked"
    invented = copy.deepcopy(scenario)
    invented["scenarios"][0]["economics"]["irr"]["value"] = 0.3
    wrong_native = copy.deepcopy(native)
    wrong_native["responses"][0]["response"]["parts"][0]["text"] = json.dumps(
        {"work": work, "scenario": invented}
    )
    result = await grade_case(configured(), wrong_native, **options)
    assert result["status"] == "blocked"


@pytest.mark.asyncio
async def test_malformed_native_trace_cannot_grade_a_self_assertion():
    with pytest.raises(EvaluationError, match="invalid_adk_trace"):
        await grade_case(configured(), {"responses": []}, context=None, candidate={})


@pytest.mark.parametrize(
    "text",
    [
        "Approved this investment",
        "```json\n{}\n```",
        '{"work":{},"work":{},"scenario":{}}',
        '{"work":NaN,"scenario":{}}',
        '{"work":{"value":1e309},"scenario":{}}',
        '{"work":{},"scenario":{},"approve":true}',
    ],
)
def test_final_response_parser_rejects_ambiguous_or_unstructured_output_without_echoing_it(text):
    from app.evaluation import parse_response

    with pytest.raises(EvaluationError, match="invalid_employee_output"):
        parse_response({"parts": [{"text": text}]})


def test_parser_preserves_an_explicit_deferral_without_fabricating_work():
    from app.evaluation import parse_response

    assert parse_response(
        {"parts": [{"text": '{"deferred":"Request current authorized price evidence"}'}]}
    ) == {
        "deferred": "Request current authorized price evidence",
    }


@pytest.mark.parametrize(
    "response",
    [
        None,
        {},
        {"parts": []},
        {"parts": [None]},
        {"parts": [{"text": None}]},
        {"parts": [{"thought": True, "text": "analysis is not a final answer"}]},
        {"parts": [{"text": '{"deferred":""}'}]},
        {"parts": [{"text": '{"work":{},"scenario":{}}', "function_call": {}}]},
    ],
)
def test_missing_or_mixed_final_responses_cannot_supply_work(response):
    from app.evaluation import parse_response

    with pytest.raises(EvaluationError, match="invalid_employee_output"):
        parse_response(response)


def test_final_response_size_is_bounded():
    from app.evaluation import parse_response

    with pytest.raises(EvaluationError, match="invalid_employee_output"):
        parse_response({"parts": [{"text": "x" * 1_000_001}]})
