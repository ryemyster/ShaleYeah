import json
from pathlib import Path

import pytest

from shaleyeah_contracts import ContractValidationError, validate_contract

REFERENCE = json.loads((Path(__file__).resolve().parents[1] / "fixtures/context-lifecycle.json").read_text())


@pytest.mark.parametrize("record", REFERENCE["records"].values(), ids=REFERENCE["records"].keys())
def test_reference_records(record):
    assert validate_contract(record) == record


@pytest.mark.parametrize("example", REFERENCE["invalidRecords"], ids=lambda item: item["name"])
def test_invalid_reference_records(example):
    with pytest.raises(ContractValidationError) as error:
        validate_contract(example["record"])
    assert error.value.code == example["code"]


def test_reference_handoff_binding():
    context = REFERENCE["records"]["sharedContext"]
    decision = REFERENCE["records"]["approval"]
    product = REFERENCE["records"]["reviewedProduct"]
    assert context["sharedKnowledge"][0]["artifact"] == product["artifact"]
    assert context["sharedKnowledge"][0]["origin"] == product["scope"]
    assert context["sharedKnowledge"][0]["evidence"] == product["evidence"]
    assert context["sharedKnowledge"][0]["reviewDecisionRef"] == {"id": decision["id"], "revision": decision["revision"]}
    assert decision["productRef"] == product["artifact"]
    assert decision["scope"] == product["scope"]
    assert decision["taskRevision"] == product["taskRevision"]
    assert product["review"]["decisionRefs"] == [{"id": decision["id"], "revision": decision["revision"]}]
    assert decision["decision"] == "approve"
    assert context["scope"]["employeeId"] == "employee.research-analyst"
