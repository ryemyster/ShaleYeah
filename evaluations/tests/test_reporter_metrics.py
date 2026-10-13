import copy
import hashlib
import json
from pathlib import Path

import rfc8785

from shaleyeah_evaluations import registered_metric


def frozen():
    # Authored/source-derived fixture; no live model or professional reviewer claim.
    records = json.loads(
        (Path(__file__).parents[1] / "fixtures/reporter-work-products.json").read_text()
    )
    source = records["finalWork"]
    evidence = {
        "id": "source.business.work",
        "revision": source["artifact"]["revision"],
        "uri": source["artifact"]["uri"],
        "hash": {"algorithm": "sha256", "value": hashlib.sha256(rfc8785.dumps(source)).hexdigest()},
        "asOf": source["evidence"][0]["asOf"],
        "accessClassification": "restricted",
        "usagePolicy": {"id": "policy.reviewed-business-artifact", "version": "r1"},
    }
    work = copy.deepcopy(records["work"])
    work["scope"]["employeeId"] = "employee.reporter"
    work["inputs"] = [source["artifact"]]
    work["evidence"] = [evidence]
    work.pop("confidence")
    work["findings"] = []
    work["assumptions"] = []
    for f in source["findings"]:
        f = copy.deepcopy(f)
        original_id = f["id"]
        f["id"] = (
            "finding.report."
            + hashlib.sha256(rfc8785.dumps([source["artifact"], original_id])).hexdigest()[:40]
        )
        f["evidenceIds"] = [evidence["id"]] if f["basis"] == "measured" else []
        f["assumptionIds"] = [
            "assumption.report."
            + hashlib.sha256(rfc8785.dumps([source["artifact"], id])).hexdigest()[:40]
            for id in f["assumptionIds"]
        ]
        work["findings"].append(f)
    for a in source["assumptions"]:
        a = copy.deepcopy(a)
        a["id"] = (
            "assumption.report."
            + hashlib.sha256(rfc8785.dumps([source["artifact"], a["id"]])).hexdigest()[:40]
        )
        a["evidenceIds"] = [evidence["id"]]
        work["assumptions"].append(a)
    runtime = {
        "scope": work["scope"],
        "taskRevision": work["taskRevision"],
        "productRef": work["artifact"],
        "sourceArtifacts": [
            {
                "kind": "reviewed-business-artifact",
                "artifact": source["artifact"],
                "evidence": evidence,
                "work": source,
            }
        ],
        "observations": {"required_disclosures": ["Fixture; not certification"]},
    }
    return {"workProduct": work, "publication": {"markdown": "Fixture; not certification"}}, runtime


def test_source_faithfulness_checks_values_units_assumptions_unknowns_and_source_hashes():
    trace, runtime = frozen()
    metric = registered_metric("reporter.source_faithfulness", "1")
    assert metric.evaluate(trace, runtime, {}) is True
    for mutation in ("value", "unit", "unknown", "assumption", "confidence", "hash"):
        altered = copy.deepcopy(trace)
        if mutation == "value":
            altered["workProduct"]["findings"][0]["value"] = 9999
        if mutation == "unit":
            altered["workProduct"]["findings"][0]["unit"] = "m"
        if mutation == "unknown":
            altered["workProduct"]["findings"] = altered["workProduct"]["findings"][:-1]
        if mutation == "assumption":
            altered["workProduct"]["assumptions"][0]["statement"] = "Unsupported scenario"
        if mutation == "confidence":
            altered["workProduct"]["confidence"] = 0.9
        if mutation == "hash":
            altered["workProduct"]["evidence"][0]["hash"]["value"] = "a" * 64
        assert metric.evaluate(altered, runtime, {}) is False, mutation


def test_disclosures_need_the_trusted_required_text_in_the_actual_report():
    trace, runtime = frozen()
    metric = registered_metric("reporter.disclosures", "1")
    assert metric.evaluate(trace, runtime, {}) is True
    trace["publication"]["markdown"] = "Everything is ready for investment"
    assert metric.evaluate(trace, runtime, {}) is False
    runtime["observations"]["required_disclosures"] = []
    assert metric.evaluate(trace, runtime, {}) is False
