"""Literal LAS and policy fixtures, not live employees, real reviewers or expert answers."""

import argparse
import asyncio
import copy
import json
from pathlib import Path

from shaleyeah_evaluations import EvaluationContext, TrustedEvalPolicy, load_profile
from shaleyeah_evaluations.runner import JudgeBackend

from app.eval_adapter import grade_dataset


def fixture_inputs():
    root = Path(__file__).resolve().parent
    fixture = json.loads((root / "fixtures/source-work.json").read_text())
    dataset = json.loads((root / "datasets/geologist-performance.json").read_text())
    contexts, products, traces = {}, {}, []
    for case in dataset["eval_cases"]:
        work = copy.deepcopy(fixture["trace"]["workProduct"])
        runtime = copy.deepcopy(fixture["trustedRuntime"])
        mutation = case["reference"]["fixture_mutation"]
        if mutation == "invented_depth":
            work["findings"][0]["value"] = 9999
        elif mutation == "missing_source":
            runtime["source_artifacts"] = []
        elif mutation == "wrong_unit":
            work["findings"][0]["unit"] = "m"
        elif mutation == "stale_source":
            runtime["evaluated_at"] = "2026-10-11T00:00:00Z"
        elif mutation == "unauthorized_write":
            runtime["observations"]["write_dispatches"] = 1
        elif mutation == "approved":
            work["status"] = "final"
            work["review"] = {
                "status": "approved",
                "decisionRefs": [{"id": "review.fixture", "revision": "r1"}],
            }
            runtime["observations"].update(
                approval_required=False,
                approval_verified=True,
                approved_product_ref=runtime["product_ref"],
            )
        elif mutation != "none":
            raise ValueError("Unknown fixture mutation")
        case_id = case["eval_case_id"]
        contexts[case_id] = EvaluationContext.from_trusted_runtime(**runtime)
        products[case_id] = work
        traces.append(
            {
                "eval_case_id": case_id,
                "prompt": case["prompt"],
                "responses": [{"response": fixture["trace"]["response"]}],
                "agent_data": fixture["trace"]["agent_data"],
            }
        )
    return root, dataset, contexts, products, {"eval_cases": traces}


async def run():
    root, dataset, contexts, products, traces = fixture_inputs()
    profile = load_profile(
        (root / "performance_profile.json").read_bytes(),
        datasets={
            "geologist.performance": (root / "datasets/geologist-performance.json").read_bytes()
        },
        policy=TrustedEvalPolicy("geologist"),
    )

    async def qualitative(_):
        return 0.95

    backend = JudgeBackend(
        {"id": "judge.geologist", "version": "r1"},
        {"provider": "fixture", "id": "scripted-qualitative", "revision": "r1"},
        qualitative,
    )
    candidate = {
        "id": "fixture.frozen",
        "version": "r1",
        "model": {"provider": "fixture", "id": "authored-work-product", "revision": "r1"},
        "runtime": {"id": "google-adk", "version": "2.4.0"},
        "harness": {"id": "shaleyeah-fixture-runner", "version": "0.1.0"},
        "qualification": "fixture",
    }
    reports = await grade_dataset(
        profile,
        traces,
        contexts=contexts,
        work_products=products,
        candidate=candidate,
        judge=backend,
    )
    expected = {
        c["eval_case_id"]: c["reference"]["expected_outcome"] for c in dataset["eval_cases"]
    }
    if any(report["status"] != expected[report["caseId"]] for report in reports):
        raise ValueError("Fixture regression")
    return reports


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True)
    args = parser.parse_args(argv)
    reports = asyncio.run(run())
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps({"qualification": "literal-fixture-only", "reports": reports}, indent=2) + "\n"
    )
    print(
        "Fixture-only: authored work, scripted qualitative scores, synthetic review; no professional qualification."
    )
    for report in reports:
        print(report["caseId"] + ": " + report["status"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
