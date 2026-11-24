"""Content-free employee event validation and bounded allowlist redaction."""

import json
from importlib.resources import files

from jsonschema import Draft202012Validator, FormatChecker

from . import _is_json

EVENT_SCHEMA_VERSION = "0.1.0"
EVENT_SCHEMA = json.loads(files(__package__).joinpath("schemas/employee-events-0.1.0.schema.json").read_text())
Draft202012Validator.check_schema(EVENT_SCHEMA)
_EVENT = Draft202012Validator(EVENT_SCHEMA, format_checker=FormatChecker(formats=["date-time"]))
_CONTEXT = Draft202012Validator({"$defs": EVENT_SCHEMA["$defs"], "$ref": "#/$defs/EmployeeEventContext"})


class EventValidationError(ValueError):
    def __init__(self, code):
        self.code = code
        super().__init__("Employee event rejected: " + code)


def _fail(code="invalid_event"):
    raise EventValidationError(code) from None


def _bounded_json(value, depth=0, ancestors=None):
    if depth > 8:
        return False
    if type(value) not in (dict, list):
        return _is_json(value) and (type(value) is not str or len(value) <= 65536)
    ancestors = set() if ancestors is None else ancestors
    if id(value) in ancestors or len(value) > 256:
        return False
    ancestors.add(id(value))
    valid = (
        all(type(key) is str and len(key) <= 128 and _bounded_json(item, depth + 1, ancestors) for key, item in value.items())
        if type(value) is dict else all(_bounded_json(item, depth + 1, ancestors) for item in value)
    )
    ancestors.remove(id(value))
    return valid


def validate_event_context(value):
    if not _bounded_json(value) or not _CONTEXT.is_valid(value) or value["traceId"] == "0" * 32:
        _fail()
    return value


def validate_event(value, *, expected_context=None):
    if not _bounded_json(value):
        _fail()
    if type(value) is dict and "schemaVersion" in value and value["schemaVersion"] != EVENT_SCHEMA_VERSION:
        _fail("unsupported_event_version")
    if not _EVENT.is_valid(value):
        _fail()
    if len(json.dumps(value, ensure_ascii=False).encode()) > 65536:
        _fail()
    validate_event_context(value["context"])
    if value.get("spanId") == "0" * 16:
        _fail()
    if value["status"] in ("approved", "rejected", "revision-requested") and value["eventType"] != "review":
        _fail()
    refs = [(item["kind"], item["id"], item["revision"]) for item in value["refs"]]
    if len(set(refs)) != len(refs):
        _fail()
    if expected_context is not None:
        validate_event_context(expected_context)
        if value["context"] != expected_context:
            _fail("event_scope_mismatch")
    return value


def redact_event(value, *, sensitive_values=(), policy=None):
    """Keep declared metadata only; reject sensitive owner/trace bindings."""
    if (
        type(sensitive_values) not in (tuple, list) or len(sensitive_values) > 128
        or any(type(secret) is not str or not 8 <= len(secret) <= 4096 for secret in sensitive_values)
    ):
        _fail("invalid_redaction_policy")
    policy = {"id": "metadata-only", "version": "1"} if policy is None else policy
    if not _bounded_json(policy) or not Draft202012Validator({"$defs": EVENT_SCHEMA["$defs"], "$ref": "#/$defs/EventProducer"}).is_valid(policy):
        _fail("invalid_redaction_policy")
    if any(secret in text for text in policy.values() for secret in sensitive_values):
        _fail("unsafe_event")
    dropped = 0
    redacted = 0

    def clean(item, shape, path):
        nonlocal dropped, redacted
        if "$ref" in shape:
            shape = EVENT_SCHEMA["$defs"][shape["$ref"].rsplit("/", 1)[-1]]
        if shape.get("type") == "object":
            if type(item) is not dict or len(item) > 256:
                _fail()
            properties = shape["properties"]
            result = {}
            for key, child in item.items():
                if key not in properties:
                    dropped += 1
                elif path == "" and key == "redaction":
                    continue
                else:
                    result[key] = clean(child, properties[key], path + "/" + key)
            return result
        if shape.get("type") == "array":
            if type(item) is not list or len(item) > shape.get("maxItems", 64):
                _fail()
            return [clean(child, shape["items"], path + "/item") for child in item]
        if type(item) is str and any(secret in item for secret in sensitive_values):
            if path.startswith("/context/"):
                _fail("unsafe_event")
            redacted += 1
            return "redacted"
        if not _bounded_json(item) or type(item) in (dict, list):
            _fail()
        return item

    safe = clean(value, EVENT_SCHEMA, "")
    safe["redaction"] = {"policy": dict(policy), "droppedFields": dropped, "redactedValues": redacted}
    return validate_event(safe)
