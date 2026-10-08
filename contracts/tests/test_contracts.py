import copy
import json
from pathlib import Path

import pytest

from shaleyeah_contracts import CONTRACT_VERSION, ContractValidationError, validate_contract

ROOT = Path(__file__).resolve().parents[1]
RECORDS = json.loads((ROOT / "fixtures/records.json").read_text())
CASES = json.loads((ROOT / "fixtures/cases.json").read_text())


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
