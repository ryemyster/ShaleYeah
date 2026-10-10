"""Framework-independent employee business contracts, validated from JSON Schema."""

import json
import math
from datetime import datetime
from importlib.resources import files

from jsonschema import Draft202012Validator, FormatChecker

_SCHEMA = json.loads(
    files(__package__).joinpath("schemas/employee-0.1.0.schema.json").read_text()
)
CONTRACT_VERSION = _SCHEMA["$defs"]["ContractVersion"]["const"]
Draft202012Validator.check_schema(_SCHEMA)
_FORMAT_CHECKER = FormatChecker(formats=["uri", "date-time"])
_VALIDATOR = Draft202012Validator(_SCHEMA, format_checker=_FORMAT_CHECKER)
_OPTIONS = Draft202012Validator(
    {"$defs": _SCHEMA["$defs"], "$ref": "#/$defs/ValidationOptions"},
    format_checker=_FORMAT_CHECKER,
)


class ContractValidationError(ValueError):
    """Stable error codes and value-free diagnostics suitable for caller handling."""

    def __init__(self, code, issues=None):
        self.code = code
        self.issues = issues or []
        super().__init__("Employee contract rejected: " + code)


def _fail(code, path, keyword):
    raise ContractValidationError(code, [{"path": path, "keyword": keyword}])


def _is_json(value, ancestors=None):
    if value is None or type(value) in (str, bool, int):
        return True
    if type(value) is float:
        return math.isfinite(value)
    if type(value) not in (dict, list):
        return False
    ancestors = set() if ancestors is None else ancestors
    if id(value) in ancestors:
        return False
    ancestors.add(id(value))
    valid = (
        all(type(key) is str and _is_json(item, ancestors) for key, item in value.items())
        if type(value) is dict
        else all(_is_json(item, ancestors) for item in value)
    )
    ancestors.remove(id(value))
    return valid


def _unique_ids(values, path):
    if len({item["id"] for item in values}) != len(values):
        _fail("invalid_contract", path, "uniqueIds")


def _check_semantics(record):
    if record["kind"] == "task-assignment" and record["id"] != record["scope"]["taskId"]:
        _fail("scope_mismatch", "/scope/taskId", "taskIdentity")
    if record["kind"] == "work-product":
        _unique_ids(record["evidence"], "/evidence")
        _unique_ids(record["assumptions"], "/assumptions")
        _unique_ids(record["findings"], "/findings")
        evidence = {item["id"] for item in record["evidence"]}
        assumptions = {item["id"] for item in record["assumptions"]}
        for item in record["findings"] + record["assumptions"]:
            if any(ref not in evidence for ref in item["evidenceIds"]):
                _fail("invalid_contract", "/evidence", "reference")
        for item in record["findings"]:
            if any(ref not in assumptions for ref in item["assumptionIds"]):
                _fail("invalid_contract", "/assumptions", "reference")
    if record["kind"] == "context-manifest":
        assembled = datetime.fromisoformat(record["assembledAt"].upper().replace("Z", "+00:00"))
        expires = datetime.fromisoformat(record["retention"]["expiresAt"].upper().replace("Z", "+00:00"))
        if expires <= assembled:
            _fail("invalid_contract", "/retention/expiresAt", "chronology")
        count = sum(
            len(record[key])
            for key in ("selectedEvidence", "workingArtifactRefs", "sharedKnowledge")
        )
        if count > record["budget"]["maxItems"]:
            _fail("invalid_contract", "/budget/maxItems", "itemBudget")
        for item in record["sharedKnowledge"]:
            if item["origin"]["customerId"] != record["scope"]["customerId"]:
                _fail("scope_mismatch", "/sharedKnowledge", "customerBoundary")


def _check_expectations(record, options):
    if "expectedScope" in options:
        if record.get("scope") != options["expectedScope"]:
            _fail("scope_mismatch", "/scope", "expectedScope")
    if "expectedTaskRevision" in options:
        revision = record.get("revision") if record["kind"] == "task-assignment" else record.get("taskRevision")
        if revision != options["expectedTaskRevision"]:
            _fail("revision_mismatch", "/taskRevision", "expectedTaskRevision")
    if "expectedProductRef" in options:
        product = record.get("artifact") if record["kind"] == "work-product" else record.get("productRef")
        if product != options["expectedProductRef"]:
            _fail("revision_mismatch", "/productRef", "expectedProductRef")
    # Policy provenance and reviewer authentication belong to the caller's trusted boundary.
    if "trustedAuthority" in options:
        grant = options["trustedAuthority"]
        if (
            record["kind"] != "employee-charter"
            or record["employeeId"] != grant["employeeId"]
            or record["owner"]["customerId"] != grant["customerId"]
            or record["authorityPolicy"] != grant["authorityPolicy"]
            or any(capability not in grant["capabilities"] for capability in record["capabilities"])
        ):
            _fail("authority_denied", "/authorityPolicy", "trustedPolicy")


def validate_contract(value, options=None):
    """Validate without mutation; does not execute or authorize employee actions."""
    options = {} if options is None else options
    if not _is_json(value) or not _is_json(options):
        _fail("invalid_contract", "", "jsonValue")
    if (
        type(value) is dict
        and type(value.get("contractVersion")) is str
        and value["contractVersion"] != CONTRACT_VERSION
    ):
        _fail("unsupported_version", "/contractVersion", "supportedVersion")
    errors = list(_VALIDATOR.iter_errors(value))
    if errors:
        raise ContractValidationError(
            "invalid_contract",
            [
                {"path": "/" + "/".join(map(str, error.path)), "keyword": error.validator}
                for error in errors
            ],
        )
    if not _OPTIONS.is_valid(options):
        _fail("invalid_contract", "/options", "validationOptions")
    _check_semantics(value)
    _check_expectations(value, options)
    return value
