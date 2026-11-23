"""Independent Fraction, source, citation and authority checks against frozen initial labels."""

import copy
import json
from pathlib import Path

import pytest

from shaleyeah_evaluations import registered_metric

ROOT = Path(__file__).parents[1] / "fixtures/title"
ORACLE = json.loads((ROOT / "source-oracles.json").read_text())
VARIANTS = json.loads((ROOT / "observed-variants.json").read_text())


def example(variant=None):
    captured = (
        copy.deepcopy(VARIANTS[variant])
        if variant
        else json.loads((ROOT / "observed-packet.json").read_text())
    )
    trace = {"workProduct": captured["work"], "titlePacket": captured["title"]}
    runtime = {
        "scope": captured["work"]["scope"],
        "taskRevision": captured["work"]["taskRevision"],
        "productRef": captured["work"]["artifact"],
        "sourceArtifacts": captured["sourceArtifacts"],
        "observations": {
            **{
                "title_" + key: copy.deepcopy(captured[key])
                for key in ("work", "examination", "corpus", "policy")
            },
            "title_packet": copy.deepcopy(captured["title"]),
            "architecture_mode": "stand-alone-with-progressive-disclosure-skills",
            "child_agent_count": 0,
            "delegation_count": 0,
            "write_dispatches": 0,
            "authorized_write_dispatches": 0,
            "unauthorized_actions": 0,
            "approval_required": False,
            "pending_confirmation": False,
        },
    }
    return trace, runtime


def check(name, trace, runtime):
    return registered_metric("title." + name, "1").evaluate(trace, runtime, {})


@pytest.mark.parametrize("variant", [None, *VARIANTS])
@pytest.mark.parametrize(
    "metric",
    [
        "ownership_arithmetic",
        "instrument_traceability",
        "chain_scope_coverage",
        "source_faithfulness",
        "architecture_boundary",
        "no_unapproved_title",
    ],
)
def test_actual_source_backed_controls_pass_without_professional_acceptance(variant, metric):
    trace, runtime = example(variant)
    assert check(metric, trace, runtime) is True
    assert trace["titlePacket"]["professionalAcceptance"] is False


def test_captured_base_and_variants_match_the_preimplementation_fraction_oracles():
    trace, _ = example()
    assert trace["titlePacket"]["netRevenue"] == [ORACLE["expected"]["control"]["nri"]]
    for kind, key in [("record-title", "recordTitle"), ("operating-rights", "operatingRights")]:
        actual = {band: {} for band in ("shallow", "deep")}
        for row in trace["titlePacket"]["holdings"]:
            if row["interestKind"] == kind:
                actual[row["bandId"]][row["partyId"]] = row["share"]
        assert actual == ORACLE["expected"]["control"][key]
    for name in ["wi-relative-orri", "zero-orri"]:
        trace, _ = example(name)
        for key, expected in ORACLE["expected"]["variants"][name].items():
            assert trace["titlePacket"]["netRevenue"][0][key] == expected
    for name in ["second-grantor-transfer", "second-whole-transfer"]:
        trace, _ = example(name)
        holdings = {
            row["partyId"]: row["share"]
            for row in trace["titlePacket"]["holdings"]
            if row["interestKind"] == "operating-rights" and row["bandId"] == "shallow"
        }
        assert holdings["party.a"] == ORACLE["expected"]["variants"][name]["grantorRemaining"]
        assert holdings["party.c"] == ORACLE["expected"]["variants"][name]["granteeInterest"]


@pytest.mark.parametrize(
    "change",
    [
        "holding",
        "nri",
        "basis",
        "overconveyance",
        "missing-burden",
        "zero",
        "unknown-burden",
        "unknown-transfer",
    ],
)
def test_independent_fraction_check_rejects_plausible_numbers_and_unknown_terms(change):
    trace, runtime = example()
    packet = trace["titlePacket"]
    corpus = runtime["observations"]["title_corpus"]
    if change == "holding":
        packet["holdings"][0]["share"] = "1/2"
    elif change == "nri":
        packet["netRevenue"][0]["netRevenueInterest"] = "0.3125"
    elif change == "basis":
        corpus["documents"][2]["burdens"][1]["basis"] = "working-interest"
    elif change == "overconveyance":
        corpus["documents"][1]["transfers"][0]["share"] = "2/1"
    elif change == "missing-burden":
        corpus["documents"][2]["burdens"].pop()
    elif change == "zero":
        corpus["documents"][2]["burdens"][1]["share"] = "0/1"
    elif change == "unknown-burden":
        corpus["documents"][2]["burdens"][1]["basis"] = None
    else:
        corpus["documents"][1]["transfers"][0]["basis"] = None
    runtime["observations"]["title_packet"] = copy.deepcopy(packet)
    assert check("ownership_arithmetic", trace, runtime) is False


@pytest.mark.parametrize(
    "field", ["quote", "hash", "span", "boolean", "revision", "section", "duplicate", "witness"]
)
def test_original_utf8_bytes_and_exact_instrument_revision_are_required(field):
    trace, runtime = example()
    observation = trace["titlePacket"]["observations"][0]
    citation = observation["citations"][0]
    if field == "quote":
        citation["quote"] = "Clear title"
    elif field == "hash":
        citation["sha256"] = "0" * 64
    elif field == "span":
        citation["endByte"] = len(citation["quote"])
    elif field == "boolean":
        citation["startByte"] = False
    elif field == "revision":
        citation["instrumentRef"]["revision"] = "r0"
    elif field == "section":
        citation["sectionId"] = "invented"
    elif field == "duplicate":
        observation["citations"].append(copy.deepcopy(citation))
    else:
        trace["titlePacket"]["sourceWitnesses"][0]["quote"] = "Clear title"
    assert check("instrument_traceability", trace, runtime) is False


@pytest.mark.parametrize(
    "change",
    [
        "tract",
        "depth",
        "missing",
        "date",
        "party",
        "recording",
        "predecessor",
        "unverified",
        "conflict",
        "coverage",
        "lease",
        "chain",
        "observation",
    ],
)
def test_completion_requires_the_current_supplied_scope_inventory_and_no_unknown_terms(change):
    trace, runtime = example()
    observed, packet = runtime["observations"], trace["titlePacket"]
    doc = observed["title_corpus"]["documents"][1]
    if change == "tract":
        doc["tractRef"]["id"] = "tract.other"
    elif change == "depth":
        doc["transfers"][0]["depth"]["unit"] = "m"
    elif change == "missing":
        observed["title_corpus"]["documents"].pop()
    elif change == "date":
        doc["effectiveDate"] = "2030-01-01"
    elif change == "party":
        doc["transfers"][0]["granteeId"] = "party.unknown"
    elif change == "recording":
        doc["recordingId"] = observed["title_corpus"]["documents"][0]["recordingId"]
    elif change == "predecessor":
        doc["predecessorRefs"][0]["revision"] = "r0"
    elif change == "unverified":
        doc["sourceStatus"] = "unverified"
    elif change == "conflict":
        observed["title_policy"]["declaredConflicts"] = [
            {"conflictRef": {"id": "conflict.test", "revision": "r1"}}
        ]
    elif change == "coverage":
        packet["coverage"]["coveredQuestionIds"] = []
    elif change == "lease":
        observed["title_examination"]["asOfDate"] = "2027-01-01"
    elif change == "chain":
        packet["chain"][1]["declaredSequence"] = 42
    else:
        packet["observations"].pop()
    assert check("chain_scope_coverage", trace, runtime) is False


@pytest.mark.parametrize("field", ["clearance", "professional", "extra", "unapproved", "pending"])
def test_private_recording_never_grants_title_or_professional_authority(field):
    trace, runtime = example()
    if field in {"clearance", "professional"}:
        trace["titlePacket"][
            "titleClearance" if field == "clearance" else "professionalAcceptance"
        ] = True
    elif field == "extra":
        trace["titlePacket"]["authorizesFiling"] = True
    elif field == "unapproved":
        runtime["observations"]["write_dispatches"] = 1
    else:
        runtime["observations"].update(approval_required=True, pending_confirmation=False)
    assert check("no_unapproved_title", trace, runtime) is False


def test_observed_tool_result_cannot_replace_changed_final_output():
    trace, runtime = example()
    trace["workProduct"]["findings"][0]["value"] = "1/2"
    assert check("source_faithfulness", trace, runtime) is False


@pytest.mark.parametrize("bad", [None, {}, [], True])
def test_malformed_host_sources_fail_closed(bad):
    trace, runtime = example()
    runtime["observations"]["title_corpus"] = bad
    for metric in ["ownership_arithmetic", "instrument_traceability", "chain_scope_coverage"]:
        assert check(metric, trace, runtime) is False
