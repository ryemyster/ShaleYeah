import json
from pathlib import Path

import pytest
from shaleyeah_evaluations import (
    EvaluationContext,
    EvaluationError,
    TrustedEvalPolicy,
    load_profile,
)

from app.agent import create_reporter_agent
from app.evaluation import grade_case, observe_reporter


def profile():
    root = Path(__file__).parent / "eval"
    return load_profile(
        (root / "performance_profile.json").read_bytes(),
        datasets={"reporter.reference": (root / "datasets/reporter.json").read_bytes()},
        policy=TrustedEvalPolicy("reporter"),
    )


def test_configuration_contains_every_case_family_and_cannot_remove_source_or_publication_gates():
    loaded = profile()
    raw = loaded.configuration()
    assert raw["roleId"] == "reporter"
    root = Path(__file__).parent / "eval"
    assert {
        case["family"]
        for case in json.loads((root / "datasets/reporter.json").read_bytes())["eval_cases"]
    } == {"control", "edge", "capability_boundary"}
    raw["metrics"] = [
        metric for metric in raw["metrics"] if metric["id"] != "reporter.source_faithfulness"
    ]
    with pytest.raises(EvaluationError):
        load_profile(
            json.dumps(raw),
            datasets={"reporter.reference": (root / "datasets/reporter.json").read_bytes()},
            policy=TrustedEvalPolicy("reporter"),
        )


def test_topology_and_authority_observations_come_from_the_runtime():
    observed = observe_reporter(
        create_reporter_agent(),
        [],
        write_dispatches=0,
        authorized_write_dispatches=0,
        unauthorized_actions=0,
        approval_required=True,
        required_disclosures=["Fixture"],
    )
    assert observed["child_agent_count"] == observed["delegation_count"] == 0
    assert observed["pending_confirmation"] is False
    assert observed["architecture_mode"] == "stand-alone-with-progressive-disclosure-skills"


@pytest.mark.asyncio
async def test_invalid_trace_does_not_grade_the_employee_claim():
    with pytest.raises(EvaluationError):
        await grade_case(
            profile(), {"responses": []}, context=None, work={}, publication={}, candidate={}
        )


@pytest.mark.asyncio
async def test_actual_source_derived_report_is_scored_with_portable_versions_and_all_trust_gates():
    fixture = json.loads((Path(__file__).parent / "eval/fixtures/source-report.json").read_text())
    work = fixture["report"]["work"]
    observations = observe_reporter(
        create_reporter_agent(),
        [],
        write_dispatches=0,
        authorized_write_dispatches=0,
        unauthorized_actions=0,
        approval_required=False,
        required_disclosures=fixture["report"]["requirements"]["disclosures"],
    )
    context = EvaluationContext.from_trusted_runtime(
        scope=work["scope"],
        task_revision=work["taskRevision"],
        product_ref=work["artifact"],
        evaluated_at="2026-10-13T00:00:00Z",
        source_artifacts=fixture["sourceArtifacts"],
        observations=observations,
    )
    case = {
        "eval_case_id": "control_source_faithful",
        "responses": [
            {"response": {"parts": [{"text": "Private report requires human publication review"}]}}
        ],
        "agent_data": {
            "turns": [
                {
                    "events": [
                        {
                            "content": {
                                "parts": [{"function_call": {"name": "draft_report", "args": {}}}]
                            }
                        }
                    ]
                }
            ]
        },
    }
    candidate = {
        "id": "fixture.reporter",
        "version": "r1",
        "model": {"provider": "fixture", "id": "source-derived", "revision": "r1"},
        "runtime": {"id": "google-adk", "version": "2.4.0"},
        "harness": {"id": "shaleyeah-fixture-runner", "version": "0.1.0"},
        "qualification": "fixture",
    }
    result = await grade_case(
        profile(),
        case,
        context=context,
        work=work,
        publication=fixture["report"],
        candidate=candidate,
    )
    assert result["status"] == "passed"
    assert len(result["metrics"]) == 10
    assert result["candidate"]["qualification"] == "fixture"
