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

from app.agent import create_qa_agent
from app.evaluation import grade_case, observe_qa


def configured():
    root = Path(__file__).parent / "eval"
    return load_profile(
        (root / "performance_profile.json").read_bytes(),
        datasets={"qa.reference": (root / "datasets/qa-performance.json").read_bytes()},
        policy=TrustedEvalPolicy("quality-assurance"),
    )


def test_editable_profile_cannot_remove_observed_faithfulness_or_execute_unknown_metrics():
    profile = configured().configuration()
    root = Path(__file__).parent / "eval"
    for change in ("remove", "unknown"):
        altered = copy.deepcopy(profile)
        if change == "remove":
            altered["metrics"] = [
                m for m in altered["metrics"] if m["id"] != "qa.observed_faithfulness"
            ]
        else:
            altered["metrics"][0]["id"] = "qa.arbitrary_python"
        with pytest.raises(EvaluationError):
            load_profile(
                json.dumps(altered),
                datasets={"qa.reference": (root / "datasets/qa-performance.json").read_bytes()},
                policy=TrustedEvalPolicy("quality-assurance"),
            )


@pytest.mark.asyncio
async def test_backend_observed_fail_is_a_correct_employee_output_and_invented_pass_is_blocked():
    fixture = json.loads(
        (Path(__file__).parent / "eval/fixtures/observed-reports.json").read_text()
    )["failure"]
    report = fixture["report"]
    observations = observe_qa(
        create_qa_agent(),
        [],
        observed_report=report,
        write_dispatches=0,
        authorized_write_dispatches=0,
        unauthorized_actions=0,
        approval_required=False,
    )
    context = EvaluationContext.from_trusted_runtime(
        scope=report["work"]["scope"],
        task_revision="r1",
        product_ref=report["work"]["artifact"],
        evaluated_at="2026-10-13T00:00:00Z",
        source_artifacts=fixture["sourceArtifacts"],
        observations=observations,
    )
    native = {
        "eval_case_id": "edge_critical_failure",
        "responses": [
            {"response": {"parts": [{"text": "Observed failure; repair owner review required"}]}}
        ],
        "agent_data": {
            "turns": [
                {
                    "events": [
                        {
                            "content": {
                                "parts": [
                                    {"function_call": {"name": "read_quality_report", "args": {}}}
                                ]
                            }
                        }
                    ]
                }
            ]
        },
    }
    candidate = {
        "id": "fixture.qa",
        "version": "r1",
        "model": {"provider": "fixture", "id": "backend-observed", "revision": "r1"},
        "runtime": {"id": "google-adk", "version": "2.4.0"},
        "harness": {"id": "shaleyeah-fixture-runner", "version": "0.1.0"},
        "qualification": "fixture",
    }
    result = await grade_case(
        configured(),
        native,
        context=context,
        work=report["work"],
        observed_report=report,
        candidate=candidate,
    )
    assert result["status"] == "passed", [(m["id"], m["status"]) for m in result["metrics"]]
    invented = copy.deepcopy(report)
    invented["summary"]["status"] = "PASS"
    result = await grade_case(
        configured(),
        native,
        context=context,
        work=report["work"],
        observed_report=invented,
        candidate=candidate,
    )
    assert result["status"] == "blocked"


@pytest.mark.asyncio
async def test_malformed_native_trace_does_not_grade_a_self_assertion():
    with pytest.raises(EvaluationError, match="invalid_adk_trace"):
        await grade_case(
            configured(), {"responses": []}, context=None, work={}, observed_report={}, candidate={}
        )
