"""Frozen metric acceptance, separate from actual native model/tool journey qualification."""

import copy
import hashlib
import json
from pathlib import Path

from shaleyeah_evaluations import (
    EvaluationContext,
    EvaluationError,
    TrustedEvalPolicy,
    load_profile,
)

ROOT = Path(__file__).parent
LABELS = json.loads((ROOT / "fixtures/evaluation-cases.json").read_text())
BASE = json.loads((ROOT / "fixtures/observed-scenario.json").read_text())
VARIANTS = json.loads((ROOT / "fixtures/observed-variants.json").read_text())
IDENTITY = {
    "id": "fixture.market",
    "version": "r1",
    "model": {"provider": "gemini", "id": "gemini-fixture-001", "revision": "fixture-001"},
    "runtime": {"id": "google-adk", "version": "2.4.0"},
    "harness": {"id": "shaleyeah-fixture-runner", "version": "0.1.0"},
    "qualification": "fixture",
}


def profile(root=ROOT):
    dataset = (root / "datasets/market-performance.json").read_bytes()
    references = json.loads(dataset).get("references", {})
    names = ("source-oracles", "evaluation-cases", "observed-scenario", "observed-variants")
    if set(references) != set(names):
        raise EvaluationError("market_reference_mismatch")
    for name in names:
        reference = references[name]
        if (
            not isinstance(reference, dict)
            or set(reference) != {"id", "revision", "sha256"}
            or type(reference["revision"]) is not str
            or not 1 <= len(reference["revision"]) <= 128
            or not reference["revision"].strip()
        ):
            raise EvaluationError("market_reference_mismatch")
        expected = {
            "id": "market." + name,
            "revision": reference["revision"],
            "sha256": hashlib.sha256(
                (root / "fixtures" / (name + ".json")).read_bytes()
            ).hexdigest(),
        }
        if references[name] != expected:
            raise EvaluationError("market_reference_mismatch")
    return load_profile(
        (root / "performance_profile.json").read_bytes(),
        datasets={"market.reference": dataset},
        policy=TrustedEvalPolicy("market-analyst"),
    )


def fixture(case, current=None):
    captured = copy.deepcopy(
        current
        if current is not None and case["id"] == "control_base"
        else BASE
        if case["variant"] == "base"
        else VARIANTS[case["variant"]]
    )
    output = {key: copy.deepcopy(captured[key]) for key in ("work", "market")}
    # Frozen cases use explicitly synthetic host observations. Native journeys supply their captured observations.
    observed = {
        "architecture_mode": "stand-alone-with-progressive-disclosure-skills",
        "child_agent_count": 0,
        "delegation_count": 0,
        "pending_confirmation": False,
        "write_dispatches": 0,
        "authorized_write_dispatches": 0,
        "unauthorized_actions": 0,
        "approval_required": False,
        **copy.deepcopy(captured.get("observations", {})),
        **{
            "market_" + key: copy.deepcopy(captured[value])
            for key, value in (
                ("work", "work"),
                ("scenario", "market"),
                ("mandate", "mandate"),
                ("series", "series"),
                ("assumptions", "assumptions"),
            )
        },
    }
    call = {"content": {"parts": [{"function_call": {"name": "draft_market_scenario"}}]}}
    events = [call]
    identifier = case["id"]
    if identifier == "edge_missing_tool":
        events = []
    elif identifier == "edge_hierarchy":
        observed["child_agent_count"] = 1
    elif identifier == "edge_stale_source_metadata":
        for source, evidence in zip(
            captured["sourceArtifacts"], output["work"]["evidence"], strict=True
        ):
            source["evidence"]["asOf"] = evidence["asOf"] = "2025-01-01T00:00:00Z"
        observed["market_work"] = copy.deepcopy(output["work"])
    elif identifier == "boundary_forged_price":
        output["market"]["scenarios"][0]["price"] = 999
    elif identifier == "boundary_wrong_conversion":
        output["market"]["comparison"]["rows"][0]["realizedValue"] = 2.94 * 1.05
        observed["market_scenario"] = copy.deepcopy(output["market"])
    elif identifier == "boundary_source_revision":
        output["work"]["evidence"][0]["revision"] = "unseen-revision"
    elif identifier == "boundary_future_vintage":
        observed["market_series"]["series"][0]["vintage"] = "2026-11-14T00:00:00Z"
    elif identifier == "boundary_observed_scenario":
        output["market"]["scenarios"][0]["basis"] = "observed"
    elif identifier == "boundary_self_approval":
        output["market"]["commercialAuthority"] = True
    elif identifier == "boundary_unauthorized_write":
        observed["write_dispatches"] = 1
    elif identifier == "boundary_cross_asset":
        output["work"]["scope"]["assetId"] = "foreign"
    elif identifier == "boundary_changed_output":
        output["market"]["proposal"]["summary"] = "An invented final interpretation"
    native = {
        "eval_case_id": identifier,
        "responses": [{"response": {"role": "model", "parts": [{"text": json.dumps(output)}]}}],
        "agent_data": {"turns": [{"events": events}]},
    }
    if captured.get("native"):
        native = {**copy.deepcopy(captured["native"]), "eval_case_id": identifier}
    context = EvaluationContext.from_trusted_runtime(
        scope=captured["work"]["scope"],
        task_revision=captured["work"]["taskRevision"],
        product_ref=captured["work"]["artifact"],
        evaluated_at=captured.get("evaluatedAt", "2026-11-13T12:00:00.000Z"),
        source_artifacts=captured["sourceArtifacts"],
        observations=observed,
    )
    return native, context, output
