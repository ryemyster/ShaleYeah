import copy
import json
from pathlib import Path

import pytest

from shaleyeah_contracts import CONTRACT_VERSION, ContractValidationError, validate_contract

ROOT = Path(__file__).resolve().parents[1]
RECORDS = json.loads((ROOT / "fixtures/records.json").read_text())
AUTHORITY = json.loads((ROOT / "fixtures/authority-review.json").read_text())
assert set(RECORDS).isdisjoint(AUTHORITY["records"]), "authority fixture shadows a base record"
RECORDS.update(AUTHORITY["records"])
CASES = json.loads((ROOT / "fixtures/cases.json").read_text()) + AUTHORITY["validationCases"]


@pytest.mark.parametrize("fixture", CASES, ids=lambda item: item["name"])
def test_fixture_parity(fixture):
    value = copy.deepcopy(RECORDS[fixture["record"]])
    for patch in fixture.get("patches", []):
        target = value
        for key in patch["path"][:-1]:
            target = target[key]
        key = patch["path"][-1]
        if patch.get("remove"):
            del target[key]
        else:
            target[key] = patch["value"]
    before = copy.deepcopy(value)
    if fixture["valid"]:
        assert validate_contract(value, fixture.get("options")) == value
    else:
        with pytest.raises(ContractValidationError) as error:
            validate_contract(value, fixture.get("options"))
        assert error.value.code == fixture["code"]
        assert "example-secret-sentinel" not in str(error.value)
    assert value == before


def test_version_and_zero_confidence():
    assert CONTRACT_VERSION == "0.1.0"
    assert validate_contract(RECORDS["work"])["confidence"] == 0


def test_non_json_input():
    cycle = {}
    cycle["self"] = cycle
    for value in [float("nan"), float("inf"), object(), cycle, {1: "non-string-key"}]:
        with pytest.raises(ContractValidationError):
            validate_contract(value)


def test_authority_reference_binding():
    control = AUTHORITY["control"]
    assert control["scope"] == RECORDS["work"]["scope"]
    assert control["taskRevision"] == RECORDS["task"]["revision"]
    assert control["productRef"] == RECORDS["work"]["artifact"]
    assert control["requestRef"] == {"id": RECORDS["saveRequest"]["id"], "revision": RECORDS["saveRequest"]["revision"]}
    assert control["decisionRef"] == {"id": RECORDS["saveDecision"]["id"], "revision": RECORDS["saveDecision"]["revision"]}
    assert RECORDS["saveDecision"]["requestRef"] == control["requestRef"]
    assert RECORDS["saveDecision"]["productRef"] == control["productRef"]
    assert RECORDS["saveRequest"]["productRef"] == control["productRef"]
    assert control["reviewer"] == RECORDS["saveDecision"]["reviewer"]
    assert control["reviewer"]["authorityPolicy"] == RECORDS["saveRequest"]["reviewerPolicy"]
    assert control["inputs"] == RECORDS["work"]["inputs"]
    assert control["evidence"] == RECORDS["work"]["evidence"]
    assert control["assumptions"] == RECORDS["work"]["assumptions"]
    assert control["auditRef"] == RECORDS["saveDecision"]["auditRef"]
    assert RECORDS["saveDecision"]["decision"] == "approve"
    assert control["operation"]["name"] in RECORDS["saveRequest"]["requestedDecision"]
    assert control["operation"]["target"] in RECORDS["saveRequest"]["requestedDecision"]
