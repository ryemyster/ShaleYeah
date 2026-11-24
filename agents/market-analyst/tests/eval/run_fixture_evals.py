"""Frozen deterministic Market acceptance; this report cannot grant promotion authority."""

import argparse
import asyncio
import json
import os

from fixture_cases import IDENTITY, LABELS, fixture, profile
from shaleyeah_evaluations import EvaluationError

from app.evaluation import grade_case


async def run(output):
    loaded = profile()
    cases = []
    for case in LABELS["cases"]:
        native, context, _ = fixture(case)
        grade = await grade_case(loaded, native, context=context, candidate=IDENTITY)
        matched = grade["status"] == case["expectedStatus"] and set(
            case["requiredFailures"]
        ) <= set(grade["hardFailures"])
        cases.append(
            {
                "id": case["id"],
                "status": grade["status"],
                "expectedStatus": case["expectedStatus"],
                "matched": matched,
                "grade": grade,
            }
        )
    passed = all(case["matched"] for case in cases)
    report = {
        "schemaVersion": "0.1.0",
        "kind": "market-fixture-suite",
        "status": "passed" if passed else "failed",
        "promotionAllowed": False,
        "qualification": "fixture",
        "profileHash": loaded.config_hash,
        "datasetHashes": list(loaded.dataset_hashes),
        "cases": cases,
    }
    descriptor = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, "w") as handle:
        json.dump(report, handle, indent=2, allow_nan=False)
        handle.write("\n")
        handle.flush()
        os.fsync(handle.fileno())
    print("Case | Actual | Expected | Matched")
    for case in cases:
        print(f"{case['id']} | {case['status']} | {case['expectedStatus']} | {case['matched']}")
    print(
        json.dumps(
            {
                "status": report["status"],
                "matched": sum(case["matched"] for case in cases),
                "cases": len(cases),
                "promotionAllowed": False,
            }
        )
    )
    return 0 if passed else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output", required=True, help="New private JSON report file; existing files are preserved"
    )
    args = parser.parse_args()
    try:
        return asyncio.run(run(args.output))
    except EvaluationError as error:
        print("Market fixture evaluation blocked: " + error.code)
        return 1
    except (OSError, ValueError, KeyError, TypeError):
        print("Market fixture evaluation blocked: report or frozen configuration unavailable")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
