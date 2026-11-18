import hashlib
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest
from shaleyeah_evaluations import EvaluationError

ROOT = Path(__file__).parent / "eval"


def test_a_reviewed_reference_revision_can_be_selected_through_json_without_python_edits(tmp_path):
    from tests.eval.fixture_cases import profile

    previous = profile()
    target = tmp_path / "eval"
    shutil.copytree(ROOT, target)
    labels_file = target / "fixtures/evaluation-cases.json"
    labels = json.loads(labels_file.read_text())
    labels["version"] = "r2"
    labels_file.write_text(json.dumps(labels) + "\n")
    dataset_file = target / "datasets/market-performance.json"
    dataset = json.loads(dataset_file.read_text())
    dataset["references"]["evaluation-cases"].update(
        revision="r2", sha256=hashlib.sha256(labels_file.read_bytes()).hexdigest()
    )
    dataset_file.write_text(json.dumps(dataset) + "\n")
    profile_file = target / "performance_profile.json"
    configured = json.loads(profile_file.read_text())
    digest = hashlib.sha256(dataset_file.read_bytes()).hexdigest()
    configured["profileRef"]["version"] = "r2"
    configured["datasets"][0].update(revision="r2", sha256=digest, uri="urn:sha256:" + digest)
    profile_file.write_text(json.dumps(configured) + "\n")
    assert profile(target).config_hash != previous.config_hash


@pytest.mark.parametrize(
    "name", ["source-oracles", "evaluation-cases", "observed-scenario", "observed-variants"]
)
def test_frozen_reference_bytes_are_verified_before_grading(tmp_path, name):
    from tests.eval.fixture_cases import profile

    assert profile().case_ids
    target = tmp_path / "eval"
    shutil.copytree(ROOT, target)
    file = target / "fixtures" / (name + ".json")
    file.write_bytes(file.read_bytes() + b"\n")
    with pytest.raises(EvaluationError, match="market_reference_mismatch"):
        profile(target)


def test_fixture_runner_records_every_expected_decision_in_a_new_private_report(tmp_path):
    output = tmp_path / "report.json"
    result = subprocess.run(
        [sys.executable, "tests/eval/run_fixture_evals.py", "--output", str(output)],
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    report = json.loads(output.read_text())
    assert report["kind"] == "market-fixture-suite"
    assert report["status"] == "passed" and report["promotionAllowed"] is False
    assert len(report["cases"]) == 21 and all(case["matched"] for case in report["cases"])
    assert sum(case["status"] == "passed" for case in report["cases"]) == 4
    assert sum(case["status"] == "blocked" for case in report["cases"]) == 17
    assert output.stat().st_mode & 0o077 == 0
    assert json.loads(result.stdout.splitlines()[-1])["matched"] == 21
    original = output.read_bytes()
    repeated = subprocess.run(
        [sys.executable, "tests/eval/run_fixture_evals.py", "--output", str(output)],
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    assert repeated.returncode != 0 and output.read_bytes() == original
    assert os.stat(output).st_size > 0
