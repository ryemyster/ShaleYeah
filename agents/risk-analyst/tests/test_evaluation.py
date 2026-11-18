import copy
import json
from pathlib import Path

import pytest
from google.adk.agents import Agent
from shaleyeah_evaluations import (
    EvaluationContext,
    EvaluationError,
    TrustedEvalPolicy,
    load_profile,
)

ROOT = Path(__file__).parent / "eval"


def configured(value=None):
    return load_profile(
        (ROOT / "performance_profile.json").read_bytes() if value is None else json.dumps(value),
        datasets={"risk.reference": (ROOT / "datasets/risk-performance.json").read_bytes()},
        policy=TrustedEvalPolicy("risk-analyst"),
    )


def independent_reference(oracle):
    return {
        **copy.deepcopy(oracle),
        "definition": {
            "modelRef": {"id": "joint.fixture", "revision": "r1"},
            "method": "complete-joint-scenarios-v1",
            "currency": "USD",
            "horizon": {"start": "2026-01-01T00:00:00Z", "end": "2027-01-01T00:00:00Z"},
            "amountBasis": "undiscounted-residual-loss",
            "probabilityBasis": "assumed-joint-scenarios",
            "quantileConvention": "weighted-inverted-cdf",
            "totalWeight": oracle["totalWeight"],
            "lossThreshold": oracle["lossThreshold"],
        },
    }


def test_existing_tolerances_are_configurable_without_waiving_the_six_risk_trust_floors():
    profile = configured()
    raw = profile.configuration()
    tuned = copy.deepcopy(raw)
    next(m for m in tuned["metrics"] if m["id"] == "risk.scenario_accuracy")["parameters"][
        "absoluteTolerance"
    ] = 1e-7
    assert configured(tuned).config_hash != profile.config_hash
    for name in [m["id"] for m in raw["metrics"] if m["id"].startswith("risk.")]:
        altered = copy.deepcopy(raw)
        altered["metrics"] = [m for m in altered["metrics"] if m["id"] != name]
        with pytest.raises(EvaluationError):
            configured(altered)


@pytest.mark.asyncio
async def test_grader_reads_actual_response_and_rejects_changed_loss_coverage_units_and_self_acceptance():
    from app.evaluation import grade_case, observe_risk

    fixture = json.loads((ROOT / "fixtures/observed-risks.json").read_text())["dependent"]
    oracle = json.loads((ROOT / "fixtures/joint-scenario-oracles.json").read_text())["cases"][
        "dependent"
    ]
    work, risk = fixture["work"], fixture["risk"]
    observations = observe_risk(
        Agent(name="risk_analyst", model="fixture-not-called"),
        [],
        observed_work=work,
        observed_risk=risk,
        register=fixture["register"],
        policy=fixture["policy"],
        reference=independent_reference(oracle),
        write_dispatches=0,
        authorized_write_dispatches=0,
        unauthorized_actions=0,
        approval_required=False,
    )
    context = EvaluationContext.from_trusted_runtime(
        scope=work["scope"],
        task_revision=work["taskRevision"],
        product_ref=work["artifact"],
        evaluated_at=fixture["evaluatedAt"],
        source_artifacts=fixture["sourceArtifacts"],
        observations=observations,
    )
    native = {
        "eval_case_id": "control_base",
        "responses": [
            {"response": {"parts": [{"text": json.dumps({"work": work, "risk": risk})}]}}
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
    candidate = {
        "id": "fixture.risk",
        "version": "r1",
        "model": {"provider": "fixture", "id": "joint-scenario-reference", "revision": "r1"},
        "runtime": {"id": "google-adk", "version": "2.4.0"},
        "harness": {"id": "shaleyeah-fixture-runner", "version": "0.1.0"},
        "qualification": "fixture",
    }
    # Adapter test only; real native MCP dispatch remains a separate required gate.
    result = await grade_case(configured(), native, context=context, candidate=candidate)
    assert result["status"] == "passed", [(m["id"], m["status"]) for m in result["metrics"]]
    for mutate in (
        lambda p: p["risk"]["summary"].update(expectedLoss=999),
        lambda p: p["risk"]["definition"].update(currency="CAD"),
        lambda p: p["risk"]["coverage"].update(status="failed"),
        lambda p: p["risk"].update(riskAccepted=True),
        lambda p: p["work"]["findings"][0].update(value=999),
    ):
        output = copy.deepcopy({"work": work, "risk": risk})
        mutate(output)
        wrong = copy.deepcopy(native)
        wrong["responses"][0]["response"]["parts"][0]["text"] = json.dumps(output)
        result = await grade_case(configured(), wrong, context=context, candidate=candidate)
        assert result["status"] == "blocked"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "native",
    [
        {"responses": []},
        {"responses": [{}]},
        {"responses": [{"response": {"parts": None}}]},
        {"responses": [{"response": {"parts": [{"text": "Risk accepted by the model"}]}}]},
    ],
)
async def test_missing_or_unstructured_native_output_cannot_be_given_a_grade(native):
    from app.evaluation import grade_case

    with pytest.raises(EvaluationError):
        await grade_case(configured(), native, context=None, candidate={})
