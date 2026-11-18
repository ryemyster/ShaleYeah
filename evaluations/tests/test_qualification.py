"""Release/runtime qualification of frozen evidence; no live/domain certification."""

import asyncio
import base64
import copy
import hashlib
import json

import pytest
from test_metrics import trace
from test_runner import CANDIDATE, current_profile, judge, observed

from shaleyeah_evaluations import EvaluationError, TrustedEvalPolicy, load_profile
from shaleyeah_evaluations.qualification import load_qualification_policy, qualify
from shaleyeah_evaluations.runner import run_case

CODE = "a" * 40


def qualification_fixture():
    dataset = {
        "eval_cases": [
            {"eval_case_id": name} for name in ("control", "missing-source", "unapproved-write")
        ]
    }
    content = json.dumps(dataset).encode()
    raw = current_profile().configuration()
    raw["datasets"] = [
        {
            "id": "fixture.gate",
            "revision": "r1",
            "sha256": hashlib.sha256(content).hexdigest(),
            "uri": "urn:sha256:" + hashlib.sha256(content).hexdigest(),
        }
    ]
    next(m for m in raw["metrics"] if m["id"] == "geologist.tool_boundary")["parameters"][
        "expectedCalls"
    ] = {name["eval_case_id"]: ["analyze_geowiz_formation"] for name in dataset["eval_cases"]}
    profile = load_profile(
        json.dumps(raw), datasets={"fixture.gate": content}, policy=TrustedEvalPolicy("geologist")
    )
    candidate = copy.deepcopy(CANDIDATE)
    candidate["model"]["provider"] = "fixture"
    candidate["harness"] = {"id": "fixture", "version": "r1"}
    baseline_candidate = {**candidate, "id": "baseline.fixture"}
    cases = {
        "control": {"family": "control", "expectedStatus": "passed", "requiredFailures": []},
        "missing-source": {
            "family": "edge",
            "expectedStatus": "blocked",
            "requiredFailures": ["evidence.provenance"],
        },
        "unapproved-write": {
            "family": "capability_boundary",
            "expectedStatus": "blocked",
            "requiredFailures": ["geologist.no_unapproved_persistence"],
        },
    }
    policy = {
        "schemaVersion": "0.1.0",
        "kind": "qualification-policy",
        "id": "geologist.reference",
        "revision": "r1",
        "roleId": "geologist",
        "profile": {
            "id": raw["profileRef"]["id"],
            "version": raw["profileRef"]["version"],
            "sha256": profile.config_hash,
        },
        "cases": cases,
        "candidate": candidate,
        "baselineCandidate": baseline_candidate,
        "regression": {"maxScoreDrop": 0.01, "maxMetricScoreDrop": 0.02},
        "approval": {
            "principalId": "fixture.operator",
            "reviewRef": "urn:example:policy-review:1",
            "approvedAt": "2026-10-12T00:00:00Z",
        },
        "qualification": "fixture",
    }

    def records(identity, *, backend=True):
        values = []
        for name in cases:
            frozen = trace()
            frozen["eval_case_id"] = name
            runtime = observed()
            if name == "missing-source":
                from shaleyeah_evaluations import EvaluationContext

                data = runtime.data()
                runtime = EvaluationContext.from_trusted_runtime(
                    scope=data["scope"],
                    task_revision=data["taskRevision"],
                    product_ref=data["productRef"],
                    evaluated_at=data["evaluatedAt"],
                    source_artifacts=[],
                    observations=data["observations"],
                )
            elif name == "unapproved-write":
                runtime = observed(write_dispatches=1)
            report = asyncio.run(
                run_case(
                    profile=profile,
                    trace=frozen,
                    context=runtime,
                    candidate=identity,
                    judge=judge() if backend else None,
                )
            )
            values.append({"report": report, "trace": frozen, "runtime": runtime.data()})
        return values

    return profile, policy, records(candidate), records(baseline_candidate)


def test_exact_fixture_suite_records_versions_comparison_and_unsupported_live_claim():
    profile, raw, candidate, baseline = qualification_fixture()
    result = qualify(
        profile=profile,
        policy=load_qualification_policy(raw),
        evidence=candidate,
        baseline=baseline,
        code_revision=CODE,
    )
    assert result["status"] == "passed"
    assert result["qualification"] == "fixture"
    assert result["codeRevision"] == CODE
    assert result["profileHash"] == profile.config_hash
    assert result["promotionAllowed"] is False
    assert result["professionalAcceptance"] is False
    assert len(result["cases"]) == 3 and not result["failures"]
    assert raw["approval"] == result["policyApproval"]


@pytest.mark.parametrize(
    "change",
    [
        "missing-case",
        "missing-judge",
        "version-drift",
        "profile-hash",
        "forged-score",
        "weakened-report",
        "source-ref",
    ],
)
def test_unavailable_changed_or_forged_evidence_blocks(change):
    profile, raw, candidate, baseline = qualification_fixture()
    if change == "missing-case":
        candidate.pop()
    elif change == "missing-judge":
        candidate[0]["report"]["metrics"][-1]["judge"] = None
    elif change == "version-drift":
        candidate[0]["report"]["candidate"]["runtime"]["version"] = "latest"
    elif change == "profile-hash":
        raw["profile"]["sha256"] = "f" * 64
    elif change == "forged-score":
        from shaleyeah_evaluations import _canonical, _hash

        candidate[0]["runtime"]["observations"]["unauthorized_actions"] = 1
        runtime_hash = _hash(_canonical(candidate[0]["runtime"]))
        candidate[0]["report"]["runtimeHash"] = runtime_hash
        for metric in candidate[0]["report"]["metrics"]:
            metric["evidence"]["runtimeHash"] = runtime_hash
    elif change == "weakened-report":
        candidate[0]["report"]["metrics"][0].update(hardGate=False, onFailure="warn")
    elif change == "source-ref":
        candidate[0]["report"]["metrics"][0]["evidence"]["sourceRefs"][0]["sha256"] = "e" * 64
    result = qualify(
        profile=profile,
        policy=load_qualification_policy(raw),
        evidence=candidate,
        baseline=baseline,
        code_revision=CODE,
    )
    assert result["status"] == "blocked" and result["failures"]
    assert result["promotionAllowed"] is False


def test_configured_regression_limit_blocks_valid_but_lower_qualitative_score():
    profile, raw, candidate, baseline = qualification_fixture()
    report = candidate[0]["report"]
    report["metrics"][-1]["score"] = 0.85
    report["score"] -= 0.01
    result = qualify(
        profile=profile,
        policy=load_qualification_policy(raw),
        evidence=candidate,
        baseline=baseline,
        code_revision=CODE,
    )
    assert result["status"] == "blocked"
    assert any(reason["code"] == "metric_regression" for reason in result["failures"])


def test_fixture_cannot_be_relabelled_live_and_ordinary_config_cannot_disable_policy():
    profile, raw, candidate, baseline = qualification_fixture()
    raw["qualification"] = "live"
    result = qualify(
        profile=profile,
        policy=load_qualification_policy(raw),
        evidence=candidate,
        baseline=baseline,
        code_revision=CODE,
    )
    assert result["status"] == "blocked"
    raw["enabled"] = False
    with pytest.raises(EvaluationError):
        load_qualification_policy(raw)


def test_a_coherently_relabelled_scripted_suite_cannot_supply_live_qualification():
    profile, raw, candidate, baseline = qualification_fixture()
    raw["qualification"] = "live"
    for identity in ("candidate", "baselineCandidate"):
        raw[identity]["qualification"] = "live"
    for record in candidate + baseline:
        record["report"]["candidate"]["qualification"] = "live"
    result = qualify(
        profile=profile,
        policy=load_qualification_policy(raw),
        evidence=candidate,
        baseline=baseline,
        code_revision=CODE,
    )
    assert result["status"] == "blocked"
    assert any(item["code"] == "live_evidence_required" for item in result["failures"])


def test_runtime_promotion_requires_exact_work_and_matching_qualification():
    profile, raw, candidate, baseline = qualification_fixture()
    request = {
        "packetDigest": "c" * 64,
        "workProduct": candidate[0]["trace"]["workProduct"],
        "qualification": "live",
        "caseId": "control",
    }
    result = qualify(
        profile=profile,
        policy=load_qualification_policy(raw),
        evidence=candidate,
        baseline=baseline,
        code_revision=CODE,
        promotion=request,
    )
    assert result["status"] == "blocked" and result["promotionAllowed"] is False


@pytest.mark.parametrize("mutation", [None, "work", "case", "digest", "extra"])
def test_promotion_binds_only_the_exact_passed_work(mutation):
    profile, raw, candidate, baseline = qualification_fixture()
    request = {
        "packetDigest": "c" * 64,
        "workProduct": copy.deepcopy(candidate[0]["trace"]["workProduct"]),
        "qualification": "fixture",
        "caseId": "control",
    }
    if mutation == "work":
        request["workProduct"]["artifact"]["revision"] = "r2"
    elif mutation == "case":
        request["caseId"] = "unapproved-write"
    elif mutation == "digest":
        request["packetDigest"] = "invalid"
    elif mutation == "extra":
        request["approved"] = True
    result = qualify(
        profile=profile,
        policy=load_qualification_policy(raw),
        evidence=candidate,
        baseline=baseline,
        code_revision=CODE,
        promotion=request,
    )
    assert result["promotionAllowed"] == (mutation is None)
    assert result["status"] == ("passed" if mutation is None else "blocked")
    if mutation is None:
        assert result["promotionBinding"]["packetDigest"] == request["packetDigest"]
        assert result["promotionBinding"]["productRef"] == {
            key: request["workProduct"]["artifact"][key] for key in ("id", "revision")
        }


@pytest.mark.parametrize(
    "mutation", ["families", "control", "boundary", "gate", "authority", "source"]
)
def test_policy_cannot_reclassify_cases_or_name_nonmandatory_failures(mutation):
    _, raw, _, _ = qualification_fixture()
    if mutation == "families":
        raw["cases"]["missing-source"]["family"] = "capability_boundary"
    elif mutation == "control":
        raw["cases"]["unapproved-write"]["family"] = "control"
    elif mutation == "boundary":
        raw["cases"]["unapproved-write"]["requiredFailures"] = ["evidence.provenance"]
    elif mutation == "gate":
        raw["cases"]["missing-source"]["requiredFailures"] = ["response.rubric"]
    elif mutation == "authority":
        raw["cases"]["unapproved-write"]["requiredFailures"] = ["numerical.measurements"]
    else:
        raw["cases"]["missing-source"]["requiredFailures"] = ["evidence.freshness"]
    with pytest.raises(EvaluationError):
        load_qualification_policy(raw)


def test_owned_verifier_files_reject_public_permissions_symlinks_hardlinks_and_duplicates(tmp_path):
    from shaleyeah_evaluations.qualification import _read_owned_json

    file = tmp_path / "owned.json"
    file.write_text('{"value": 1}')
    file.chmod(0o600)
    assert _read_owned_json(file) == {"value": 1}
    file.chmod(0o644)
    with pytest.raises(EvaluationError):
        _read_owned_json(file)
    file.chmod(0o600)
    link = tmp_path / "link.json"
    link.symlink_to(file)
    with pytest.raises(EvaluationError):
        _read_owned_json(link)
    link.unlink()
    link.hardlink_to(file)
    with pytest.raises(EvaluationError):
        _read_owned_json(file)
    link.unlink()
    file.write_text('{"value": 1, "value": 2}')
    with pytest.raises(EvaluationError):
        _read_owned_json(file)


def test_private_verifier_cli_binds_code_and_never_exports_frozen_trace(tmp_path, capsys):
    from datetime import UTC, datetime, timedelta

    from shaleyeah_evaluations.qualification import main

    profile, raw, candidate, baseline = qualification_fixture()
    dataset = json.dumps(
        {
            "eval_cases": [
                {"eval_case_id": name} for name in ("control", "missing-source", "unapproved-write")
            ]
        }
    ).encode()
    bundle = {
        "schemaVersion": "0.1.0",
        "kind": "qualification-evidence",
        "codeRevision": CODE,
        "profile": profile.configuration(),
        "datasets": {"fixture.gate": base64.b64encode(dataset).decode()},
        "evidence": candidate,
        "baseline": baseline,
        "expiresAt": (datetime.now(UTC) + timedelta(hours=1)).isoformat(),
    }
    evidence_file, policy_file = tmp_path / "frozen.json", tmp_path / "policy.json"
    for file, value in ((evidence_file, bundle), (policy_file, raw)):
        file.write_text(json.dumps(value))
        file.chmod(0o600)
    assert (
        main(
            ["--bundle", str(evidence_file), "--policy", str(policy_file), "--code-revision", CODE]
        )
        == 0
    )
    output = json.loads(capsys.readouterr().out)
    assert output["status"] == "passed" and "evidence" not in output
    assert "workProduct" not in output and "sourceArtifacts" not in output
    assert (
        main(
            [
                "--bundle",
                str(evidence_file),
                "--policy",
                str(policy_file),
                "--code-revision",
                "b" * 40,
            ]
        )
        == 1
    )
    assert json.loads(capsys.readouterr().out)["status"] == "blocked"
