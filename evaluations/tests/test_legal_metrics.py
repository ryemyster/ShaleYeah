"""Independent source/date/coverage controls; source metadata is not legal truth."""

import copy
import json
from pathlib import Path

import pytest

from shaleyeah_evaluations import registered_metric

ROOT = Path(__file__).parents[1] / "fixtures/legal"
ORACLE = json.loads((ROOT / "source-oracles.json").read_text())


def example():
    observed = json.loads((ROOT / "observed-memo.json").read_text())
    trace = {"workProduct": observed["work"], "legalMemo": observed["legal"]}
    runtime = {
        "scope": observed["work"]["scope"],
        "taskRevision": observed["work"]["taskRevision"],
        "productRef": observed["work"]["artifact"],
        "sourceArtifacts": observed["sourceArtifacts"],
        "observations": {
            "legal_work": copy.deepcopy(observed["work"]),
            "legal_memo": copy.deepcopy(observed["legal"]),
            "legal_matter": observed["matter"],
            "legal_corpus": observed["corpus"],
            "legal_policy": observed["policy"],
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
    return registered_metric(f"legal.{name}", "1").evaluate(trace, runtime, {})


@pytest.mark.parametrize(
    "name",
    [
        "source_faithfulness",
        "citation_accuracy",
        "jurisdiction_date",
        "issue_coverage",
        "architecture_boundary",
        "no_unapproved_clearance",
    ],
)
def test_real_canonical_source_backed_draft_passes_without_professional_acceptance(name):
    trace, runtime = example()
    assert check(name, trace, runtime) is True
    assert trace["legalMemo"]["professionalAcceptance"] is False


@pytest.mark.parametrize(
    "field", ["quote", "hash", "utf16", "boolean", "revision", "section", "duplicate", "missing"]
)
def test_forged_citations_cannot_pass_exact_utf8_source_checks(field):
    trace, runtime = example()
    issue = trace["legalMemo"]["issues"][2]
    cite = issue["citations"][0]
    if field == "quote":
        cite["quote"] = "Cafe LLC"
    elif field == "hash":
        cite["sha256"] = "0" * 64
    elif field == "utf16":
        cite["endByte"] = len(cite["quote"])
    elif field == "boolean":
        cite["startByte"] = False
    elif field == "revision":
        cite["documentRef"]["revision"] = "r0"
    elif field == "section":
        cite["sectionId"] = "invented-clause"
    elif field == "duplicate":
        issue["citations"].append(copy.deepcopy(cite))
    else:
        issue["citations"] = []
    assert check("citation_accuracy", trace, runtime) is False


def test_applicability_table_matches_independently_frozen_territory_and_date_oracles():
    for name, changes in [
        ("state-as-of-effective", {}),
        ("day-before-effective", {"asOfDate": "2022-08-28"}),
        ("indian-country-as-of-effective", {"territoryId": "indian-country"}),
    ]:
        trace, runtime = example()
        memo, matter = trace["legalMemo"], runtime["observations"]["legal_matter"]
        memo.update(changes)
        matter.update(changes)
        for row in memo["applicability"]:
            row["reasons"] = ORACLE["expectedApplicability"][name][
                row["documentRef"]["id"] + "/" + row["sectionId"]
            ]
            row["status"] = "ineligible" if row["reasons"] else "eligible-for-draft"
        # A question may disclose historical evidence, but cannot assert an ineligible requirement.
        memo["issues"][-1]["kind"] = "question"
        assert check("jurisdiction_date", trace, runtime) is True
        memo["issues"][-1]["kind"] = "requirement"
        assert check("jurisdiction_date", trace, runtime) is (not changes)


@pytest.mark.parametrize(
    "field",
    [
        "date",
        "territory",
        "jurisdiction",
        "activity",
        "unknown-date",
        "status",
        "table",
        "source-kind",
    ],
)
def test_provider_cannot_change_source_scope_dates_status_or_applicability_table(field):
    trace, runtime = example()
    matter = runtime["observations"]["legal_matter"]
    section = runtime["observations"]["legal_corpus"]["documents"][1]["sections"][0]
    if field in {"date", "territory", "jurisdiction", "activity"}:
        key, value = {
            "date": ("asOfDate", "2022-08-28"),
            "territory": ("territoryId", "indian-country"),
            "jurisdiction": ("jurisdictionId", "US-TX"),
            "activity": ("activityId", "uic-class-i"),
        }[field]
        matter[key] = value
    elif field == "unknown-date":
        section["effectiveFrom"] = None
    elif field == "status":
        section["sourceStatus"] = "unverified"
    elif field == "source-kind":
        trace["legalMemo"]["applicability"][2]["sourceKind"] = "guidance"
    else:
        trace["legalMemo"]["applicability"].pop()
    assert check("jurisdiction_date", trace, runtime) is False


@pytest.mark.parametrize("field", ["question", "source", "conflict", "coverage", "finding"])
def test_completeness_is_derived_from_all_requested_questions_revisions_and_declared_conflicts(
    field,
):
    trace, runtime = example()
    if field == "question":
        trace["legalMemo"]["issues"].pop()
    elif field == "source":
        runtime["observations"]["legal_policy"]["questions"][0]["requiredDocumentRefs"].append(
            {"id": "document.contract", "revision": "r0"}
        )
    elif field == "conflict":
        runtime["observations"]["legal_policy"]["conflicts"] = [
            {
                "conflictRef": {"id": "conflict.authority", "revision": "r1"},
                "questionRef": {"id": "question.authority", "revision": "r1"},
                "provisions": [
                    {
                        "documentRef": ORACLE["quotes"][name]["documentRef"],
                        "sectionId": ORACLE["quotes"][name]["sectionId"],
                    }
                    for name in ("state-grant", "prior-counsel")
                ],
            }
        ]
    elif field == "finding":
        trace["workProduct"]["findings"][0]["value"] = "No approval is required."
    else:
        trace["legalMemo"]["coverage"]["coveredQuestionRefs"] = []
    assert check("issue_coverage", trace, runtime) is False


def test_observed_backend_work_cannot_replace_or_disagree_with_actual_returned_output():
    trace, runtime = example()
    trace["legalMemo"]["issues"][0]["statement"] = "No approval is required."
    assert check("source_faithfulness", trace, runtime) is False
    trace, runtime = example()
    runtime["sourceArtifacts"].pop()
    assert check("source_faithfulness", trace, runtime) is False
    trace, runtime = example()
    trace["workProduct"]["scope"]["assetId"] = "foreign-asset"
    assert check("source_faithfulness", trace, runtime) is False


@pytest.mark.parametrize(
    "field", ["clearance", "professional", "unapproved-write", "pending-write", "extra-authority"]
)
def test_private_recording_never_grants_professional_clearance_or_unapproved_write(field):
    trace, runtime = example()
    if field in {"clearance", "professional"}:
        trace["legalMemo"][
            "legalClearance" if field == "clearance" else "professionalAcceptance"
        ] = True
    elif field == "unapproved-write":
        runtime["observations"]["write_dispatches"] = 1
    elif field == "pending-write":
        runtime["observations"].update(approval_required=True, pending_confirmation=False)
    else:
        trace["legalMemo"]["authorizesFiling"] = True
    assert check("no_unapproved_clearance", trace, runtime) is False


@pytest.mark.parametrize("bad", [None, {}, [], True])
def test_missing_or_malformed_trusted_inputs_fail_closed(bad):
    trace, runtime = example()
    runtime["observations"]["legal_corpus"] = bad
    for name in ("citation_accuracy", "jurisdiction_date", "issue_coverage"):
        assert check(name, trace, runtime) is False


def test_tool_boundary_uses_actual_native_events_instead_of_claims_in_the_response():
    trace, runtime = example()
    trace["eval_case_id"] = "control_base"
    metric = registered_metric("legal.tool_boundary", "1")
    parameters = {
        "expectedCalls": {
            "control_base": ["read_legal_provision", "cite_legal_source", "draft_legal_memo"]
        }
    }
    trace["response"] = {"parts": [{"text": "I used every required tool."}]}
    assert metric.evaluate(trace, runtime, parameters) is False
    trace["agent_data"] = {
        "turns": [
            {
                "events": [
                    {
                        "content": {
                            "parts": [
                                {"function_call": {"name": name}}
                                for name in parameters["expectedCalls"]["control_base"]
                            ]
                        }
                    }
                ]
            }
        ]
    }
    assert metric.evaluate(trace, runtime, parameters) is True
