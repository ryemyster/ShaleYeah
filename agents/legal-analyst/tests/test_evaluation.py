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
        datasets={"legal.reference": (ROOT / "datasets/legal-performance.json").read_bytes()},
        policy=TrustedEvalPolicy("legal-analyst"),
    )


def test_owner_can_tune_freshness_without_code_but_cannot_remove_legal_trust_floors():
    profile = configured()
    tuned = profile.configuration()
    next(metric for metric in tuned["metrics"] if metric["id"] == "evidence.freshness")[
        "parameters"
    ]["maxAgeSeconds"] = 3600
    assert configured(tuned).config_hash != profile.config_hash
    for name in [
        metric["id"]
        for metric in profile.configuration()["metrics"]
        if metric["id"].startswith("legal.")
    ]:
        altered = profile.configuration()
        altered["metrics"] = [metric for metric in altered["metrics"] if metric["id"] != name]
        with pytest.raises(EvaluationError):
            configured(altered)


@pytest.mark.asyncio
async def test_grader_reads_actual_response_and_rejects_changed_citations_coverage_scope_or_clearance():
    from app.evaluation import grade_case, observe_legal

    fixture = json.loads((ROOT / "fixtures/observed-memo.json").read_text())
    work, memo = fixture["work"], fixture["legal"]
    observed = observe_legal(
        Agent(name="legal_analyst", model="fixture-not-called"),
        [],
        observed_work=work,
        observed_legal=memo,
        matter=fixture["matter"],
        corpus=fixture["corpus"],
        policy=fixture["policy"],
        write_dispatches=0,
        authorized_write_dispatches=0,
        unauthorized_actions=0,
        approval_required=False,
    )
    context = EvaluationContext.from_trusted_runtime(
        scope=work["scope"],
        task_revision=work["taskRevision"],
        product_ref=work["artifact"],
        evaluated_at="2026-11-12T12:00:00Z",
        source_artifacts=fixture["sourceArtifacts"],
        observations=observed,
    )
    native = {
        "eval_case_id": "control_base",
        "responses": [
            {"response": {"parts": [{"text": json.dumps({"work": work, "legal": memo})}]}}
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
    candidate = {
        "id": "fixture.legal",
        "version": "r1",
        "model": {"provider": "fixture", "id": "source-cited-legal-reference", "revision": "r1"},
        "runtime": {"id": "google-adk", "version": "2.4.0"},
        "harness": {"id": "shaleyeah-fixture-runner", "version": "0.1.0"},
        "qualification": "fixture",
    }
    result = await grade_case(configured(), native, context=context, candidate=candidate)
    assert result["status"] == "passed", [
        (metric["id"], metric["status"]) for metric in result["metrics"]
    ]
    for mutate in (
        lambda value: value["legal"]["issues"][0]["citations"][0].update(
            quote="No approval required"
        ),
        lambda value: value["legal"]["coverage"].update(coveredQuestionRefs=[]),
        lambda value: value["legal"].update(territoryId="indian-country"),
        lambda value: value["legal"].update(legalClearance=True),
        lambda value: value["work"]["findings"][0].update(value="No approval required"),
    ):
        actual = copy.deepcopy({"work": work, "legal": memo})
        mutate(actual)
        wrong = copy.deepcopy(native)
        wrong["responses"][0]["response"]["parts"][0]["text"] = json.dumps(actual)
        assert (await grade_case(configured(), wrong, context=context, candidate=candidate))[
            "status"
        ] == "blocked"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "native",
    [
        {"responses": []},
        {"responses": [{}]},
        {"responses": [{"response": {"parts": None}}]},
        {"responses": [{"response": {"parts": [{"text": "The model grants legal clearance"}]}}]},
    ],
)
async def test_missing_or_unstructured_native_output_cannot_be_graded(native):
    from app.evaluation import grade_case

    with pytest.raises(EvaluationError):
        await grade_case(configured(), native, context=None, candidate={})
