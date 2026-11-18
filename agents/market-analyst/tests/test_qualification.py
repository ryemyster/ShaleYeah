"""Installed Market qualification replays actual output and exact inspected source bytes."""

import copy
import hashlib
import json

import pytest
from shaleyeah_evaluations import EvaluationError, _canonical, _hash
from shaleyeah_evaluations.qualification import load_qualification_policy, qualify

from tests.eval.fixture_cases import BASE, profile


@pytest.mark.asyncio
async def test_frozen_qualification_keeps_all_expected_failures_and_cannot_claim_professional_acceptance():
    from tests.eval.run_qualification import frozen_run

    decision, bundle, policy = await frozen_run("a" * 40)
    assert decision["status"] == "passed", decision["failures"]
    assert decision["professionalAcceptance"] is False
    assert decision["promotionAllowed"] is False
    assert len(decision["cases"]) == len(bundle["evidence"]) == len(bundle["baseline"]) == 21
    assert policy["roleId"] == "market-analyst"


@pytest.mark.asyncio
@pytest.mark.parametrize("change", ["scenario", "work", "malformed", "missing"])
async def test_rehashed_final_response_cannot_inherit_unchanged_extracted_output(change):
    from tests.eval.run_qualification import frozen_run

    _, bundle, policy = await frozen_run("a" * 40)
    record = bundle["evidence"][0]
    response = record["trace"]["response"]
    if change == "missing":
        del record["trace"]["response"]
    elif change == "malformed":
        response["parts"][0]["text"] = "An unsupported confident price"
    else:
        output = json.loads(response["parts"][0]["text"])
        if change == "scenario":
            output["market"]["proposal"]["summary"] = "A different commercial interpretation"
        else:
            output["work"]["findings"][0]["value"] = 999
        response["parts"][0]["text"] = json.dumps(output)
    record["report"]["traceHash"] = _hash(_canonical(record["trace"]))
    for metric in record["report"]["metrics"]:
        metric["evidence"]["traceHash"] = record["report"]["traceHash"]
    decision = qualify(
        profile=profile(),
        policy=load_qualification_policy(policy),
        evidence=bundle["evidence"],
        baseline=bundle["baseline"],
        code_revision="a" * 40,
    )
    assert decision["status"] == "blocked" and decision["promotionAllowed"] is False
    assert {failure["code"] for failure in decision["failures"]} >= {"invalid_frozen_evidence"}


def inspected_fixture():
    observed = copy.deepcopy(BASE)
    sources = []
    for index, key in enumerate(("mandate", "series", "assumptions")):
        text = _canonical(observed[key])
        source = observed["sourceArtifacts"][index]
        digest = hashlib.sha256(text.encode()).hexdigest()
        source["evidence"]["hash"]["value"] = digest
        source["evidence"]["revision"] = source["artifact"]["revision"] = digest
        source["artifact"]["uri"] = "urn:sha256:" + digest
        source["byteLength"] = len(text.encode())
        observed["work"]["inputs"][index] = copy.deepcopy(source["artifact"])
        observed["work"]["evidence"][index] = copy.deepcopy(source["evidence"])
        sources.append({"artifact": copy.deepcopy(source), "text": text})
    packet = {"work": observed["work"], "market": observed["market"], "sources": sources}
    return {"packetDigest": "b" * 64, "packet": packet}, observed


def test_current_inputs_come_from_inspected_bytes_and_not_observed_input_assertions():
    from tests.eval.run_qualification import inspected_current

    preview, observed = inspected_fixture()
    observed["series"]["series"][0]["observations"][0]["value"] = 999
    current = inspected_current(preview, observed)
    assert current["series"]["series"][0]["observations"][0]["value"] == 3
    assert current["sourceArtifacts"] == observed["sourceArtifacts"]


@pytest.mark.parametrize("change", ["bytes", "metadata", "duplicates", "work", "market", "native"])
def test_inspected_packet_binding_rejects_source_or_output_substitution(change):
    from tests.eval.run_qualification import inspected_current

    preview, observed = inspected_fixture()
    if change == "bytes":
        preview["packet"]["sources"][0]["text"] += " "
    elif change == "metadata":
        observed["sourceArtifacts"][0]["retrievedAt"] = "2026-11-12T00:00:00Z"
    elif change == "duplicates":
        observed["sourceArtifacts"][1] = observed["sourceArtifacts"][0]
    elif change == "work":
        observed["work"] = {**observed["work"], "taskRevision": "r2"}
    elif change == "market":
        observed["market"] = {**observed["market"], "commercialAuthority": True}
    else:
        observed["native"] = {
            "responses": [{"response": {"parts": [{"text": '{"deferred":"No inputs"}'}]}}],
            "agent_data": {},
        }
    with pytest.raises(EvaluationError, match="inspected_packet_mismatch"):
        inspected_current(preview, observed)
