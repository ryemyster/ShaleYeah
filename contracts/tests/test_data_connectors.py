import copy
import json
from pathlib import Path

import pytest

from shaleyeah_contracts import (
    ContractValidationError,
    validate_connector_configuration,
    validate_contract,
    validate_source_contract,
)

RECORDS = json.loads((Path(__file__).parents[1] / "fixtures/data-connectors.json").read_text())


@pytest.mark.parametrize("record", [value for key, value in RECORDS.items() if key != "configuration"], ids=[key for key in RECORDS if key != "configuration"])
def test_portable_connector_round_trip(record):
    assert validate_source_contract(record) == record


@pytest.mark.parametrize("path,value", [
    (("artifact", "revision"), "changed"),
    (("evidence", "uri"), "https://example.com/log?api_key=example-secret-sentinel"),
    (("retrievedAt",), "2026-10-06T12:00:00Z"),
    (("units",), [RECORDS["artifact"]["units"][0]] * 2),
])
def test_source_artifact_cannot_misstate_provenance(path, value):
    record = copy.deepcopy(RECORDS["artifact"])
    target = record
    for key in path[:-1]:
        target = target[key]
    target[path[-1]] = value
    with pytest.raises(ContractValidationError) as error:
        validate_source_contract(record)
    assert "example-secret-sentinel" not in str(error.value)


def test_private_connector_configuration():
    assert validate_connector_configuration(RECORDS["configuration"]) == RECORDS["configuration"]
    with pytest.raises(ContractValidationError):
        validate_contract(RECORDS["configuration"])
    variants = [None, object(), {**RECORDS["configuration"], "contractVersion": "2.0.0"}, {**RECORDS["configuration"], "secret": "example-secret-sentinel"}]
    for path, value in [(("manifest", "owner", "customerId"), "different"), (("grant", "scope", "taskId"), "different"), (("manifest", "formats"), ["csv"]), (("sources", 0, "evidence", "uri"), "https://user:password@example.com/log"), (("sources", 0, "units"), [*RECORDS["configuration"]["sources"][0]["units"], {**RECORDS["configuration"]["sources"][0]["units"][0], "unit": "M"}])]:
        record = copy.deepcopy(RECORDS["configuration"])
        target = record
        for key in path[:-1]:
            target = target[key]
        target[path[-1]] = value
        variants.append(record)
    duplicate = copy.deepcopy(RECORDS["configuration"])
    duplicate["sources"].append(duplicate["sources"][0])
    variants.append(duplicate)
    for value in variants:
        with pytest.raises(ContractValidationError):
            validate_connector_configuration(value)


def test_employee_profile_remains_closed():
    with pytest.raises(ContractValidationError):
        validate_contract(RECORDS["manifest"])
