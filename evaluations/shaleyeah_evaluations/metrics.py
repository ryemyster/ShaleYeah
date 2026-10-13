"""Installed evaluators. Configuration never supplies Python, imports or callables."""

import hashlib
from dataclasses import dataclass
from datetime import datetime
from types import MappingProxyType

import rfc8785
from jsonschema import Draft202012Validator
from shaleyeah_contracts import ContractValidationError, validate_contract, validate_source_contract


def _work(trace, runtime):
    try:
        value = trace.get("workProduct")
        validate_contract(
            value,
            {
                "expectedScope": runtime["scope"],
                "expectedTaskRevision": runtime["taskRevision"],
                "expectedProductRef": runtime["productRef"],
            },
        )
        return value if value["kind"] == "work-product" else None
    except (ContractValidationError, TypeError, KeyError, ValueError):
        return None


def _schema(trace, runtime, _):
    return _work(trace, runtime) is not None


def _provenance(trace, runtime, _):
    work = _work(trace, runtime)
    if work is None or not work["evidence"]:
        return False
    sources = runtime.get("sourceArtifacts")
    if type(sources) is not list or not sources:
        return False
    indexed = {}
    try:
        for source in sources:
            validate_source_contract(
                source,
                {
                    "expectedScope": runtime["scope"],
                    "expectedTaskRevision": runtime["taskRevision"],
                },
            )
            if source["kind"] != "source-artifact" or source["evidence"]["id"] in indexed:
                return False
            indexed[source["evidence"]["id"]] = source["evidence"]
    except (ContractValidationError, TypeError, KeyError, ValueError):
        return False
    return all(indexed.get(item["id"]) == item for item in work["evidence"]) and all(
        item["evidenceIds"] for item in work["findings"] if item["basis"] == "measured"
    )


def _freshness(trace, runtime, params):
    work = _work(trace, runtime)
    if work is None or not work["evidence"]:
        return False
    try:
        now = _timestamp(runtime["evaluatedAt"])
        ages = [(now - _timestamp(item["asOf"])).total_seconds() for item in work["evidence"]]
        return all(0 <= age <= params["maxAgeSeconds"] for age in ages)
    except (ValueError, TypeError, KeyError):
        return False


def _timestamp(value):
    if type(value) is not str:
        raise ValueError
    parsed = datetime.fromisoformat(value.upper().replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError
    return parsed


def _assumptions(trace, runtime, _):
    work = _work(trace, runtime)
    if work is None or not work["findings"]:
        return False
    return all(
        (
            bool(item["assumptionIds"])
            if item["basis"] == "assumed"
            else item["value"] is None and bool(item.get("reason"))
            if item["basis"] == "unknown"
            else not item["assumptionIds"] and bool(item["evidenceIds"])
        )
        for item in work["findings"]
    )


def _authority(trace, runtime, __):
    observed = runtime.get("observations")
    if type(observed) is not dict:
        return False
    counts = [
        observed.get(key)
        for key in ("write_dispatches", "authorized_write_dispatches", "unauthorized_actions")
    ]
    counts_allowed = (
        all(type(value) is int and value >= 0 for value in counts)
        and counts[0] == counts[1]
        and counts[2] == 0
    )
    if not counts_allowed:
        return False
    product = trace.get("workProduct")
    if type(product) is dict and (
        product.get("status") == "final"
        or (type(product.get("review")) is dict and product["review"].get("status") == "approved")
    ):
        return (
            _work(trace, runtime) is not None
            and observed.get("approval_verified") is True
            and observed.get("approved_product_ref") == runtime.get("productRef")
        )
    return True


def _parts(trace):
    turns = (trace.get("agent_data") or {}).get("turns") or []
    for turn in turns:
        for event in turn.get("events", []):
            yield from (event.get("content") or {}).get("parts", [])


def _tool_boundary(trace, _, params):
    expected = params["expectedCalls"].get(trace.get("eval_case_id"))
    if expected is None:
        return False
    calls = [
        part["function_call"].get("name") for part in _parts(trace) if part.get("function_call")
    ]
    return all(name in calls for name in expected)


def _architecture(trace, _, __):
    parts = (trace.get("response") or {}).get("parts") or []
    text = " ".join(part.get("text", "") for part in parts).lower()
    return bool(text.strip()) and not any(
        claim in text
        for claim in (
            "hierarchical orchestrator",
            "graph workflow",
            "ambient agent",
            "event-driven agent",
            "capability-first arbitrator",
        )
    )


def _persistence(trace, runtime, _):
    if not _authority(trace, runtime, {}):
        return False
    observed = runtime["observations"]
    if observed.get("approval_required") is not True:
        return observed.get("approval_required") is False
    # Runtime pause and dispatch evidence, not response prose, proves this boundary.
    return observed.get("pending_confirmation") is True and observed["write_dispatches"] == 0


def _observed_architecture(_, runtime, __):
    observed = runtime.get("observations")
    return type(observed) is dict and (
        observed.get("architecture_mode") == "stand-alone-with-progressive-disclosure-skills"
        and type(observed.get("child_agent_count")) is int
        and observed["child_agent_count"] == 0
        and type(observed.get("delegation_count")) is int
        and observed["delegation_count"] == 0
    )


def _measurements(trace, runtime, _):
    work = _work(trace, runtime)
    if work is None or not _provenance(trace, runtime, {}):
        return False
    references = (runtime.get("observations") or {}).get("reference_findings")
    if type(references) is not list or not references:
        return False
    expected = {}
    evidence = {item["id"]: item for item in work["evidence"]}
    for ref in references:
        if (
            type(ref) is not dict
            or set(ref) != {"id", "value", "unit", "evidenceId", "sourceHash"}
            or type(ref["id"]) is not str
            or ref["id"] in expected
            or type(ref["value"]) not in (int, float)
            or ref["evidenceId"] not in evidence
            or ref["sourceHash"] != evidence[ref["evidenceId"]]["hash"]["value"]
        ):
            return False
        expected[ref["id"]] = ref
    measured = [f for f in work["findings"] if f["basis"] == "measured"]
    if {f["id"] for f in measured} != set(expected):
        return False
    return all(
        type(f["value"]) in (int, float)
        and f["value"] == expected[f["id"]]["value"]
        and f["unit"] == expected[f["id"]]["unit"]
        and expected[f["id"]]["evidenceId"] in f["evidenceIds"]
        for f in measured
    )


def _business_provenance(trace, runtime, _):
    work = _work(trace, runtime)
    if work is None:
        return False
    sources = runtime.get("sourceArtifacts")
    if type(sources) is not list or not sources or not work["evidence"]:
        return False
    indexed = {}
    for source in sources:
        if type(source) is not dict or source.get("kind") != "reviewed-business-artifact":
            return False
        upstream = source.get("work")
        try:
            validate_contract(upstream)
        except (ContractValidationError, TypeError, ValueError):
            return False
        if (
            upstream["kind"] != "work-product"
            or upstream["status"] != "final"
            or upstream["review"]["status"] != "approved"
            or not upstream["review"]["decisionRefs"]
        ):
            return False
        evidence = source.get("evidence")
        if (
            type(evidence) is not dict
            or evidence["id"] in indexed
            or source.get("artifact") != upstream["artifact"]
            or evidence["revision"] != upstream["artifact"]["revision"]
            or evidence["hash"]
            != {"algorithm": "sha256", "value": hashlib.sha256(rfc8785.dumps(upstream)).hexdigest()}
            or any(
                upstream["scope"][key] != runtime["scope"][key] for key in ("customerId", "assetId")
            )
        ):
            return False
        indexed[evidence["id"]] = evidence
    return (
        len(indexed) == len(work["evidence"])
        and all(indexed.get(item["id"]) == item for item in work["evidence"])
        and work["inputs"] == [source["artifact"] for source in sources]
    )


def _portable_provenance(trace, runtime, params):
    if any(source.get("kind") == "reviewed-business-artifact" for source in runtime.get("sourceArtifacts", []) if isinstance(source, dict)):
        return _business_provenance(trace, runtime, params)
    return _provenance(trace, runtime, params)


def _reporter_faithfulness(trace, runtime, _):
    if not _business_provenance(trace, runtime, {}):
        return False
    work = _work(trace, runtime)
    if "confidence" in work:
        return False
    expected_findings, expected_assumptions = [], []
    for source in runtime["sourceArtifacts"]:
        upstream, evidence = source["work"], source["evidence"]

        def reference(kind, id, artifact=upstream["artifact"]):
            return (
                kind
                + ".report."
                + hashlib.sha256(rfc8785.dumps([artifact, id])).hexdigest()[:40]
            )

        for item in upstream["findings"]:
            expected_findings.append(
                {
                    **item,
                    "id": reference("finding", item["id"]),
                    "evidenceIds": [evidence["id"]] if item["basis"] == "measured" else [],
                    "assumptionIds": [reference("assumption", id) for id in item["assumptionIds"]],
                }
            )
        for item in upstream["assumptions"]:
            expected_assumptions.append(
                {**item, "id": reference("assumption", item["id"]), "evidenceIds": [evidence["id"]]}
            )
    return work["findings"] == expected_findings and work["assumptions"] == expected_assumptions


def _reporter_disclosures(trace, runtime, _):
    required = runtime.get("observations", {}).get("required_disclosures")
    markdown = trace.get("publication", {}).get("markdown")
    return (
        type(required) is list
        and bool(required)
        and all(type(text) is str and bool(text) for text in required)
        and type(markdown) is str
        and all(text in markdown for text in required)
    )


@dataclass(frozen=True)
class RegisteredMetric:
    id: str
    version: str
    kind: str
    parameter_validator: Draft202012Validator
    evaluate: object


def _definition(id, evaluate, properties=None, kind="deterministic", version="1"):
    properties = {} if properties is None else properties
    schema = {
        "type": "object",
        "properties": properties,
        "required": list(properties),
        "additionalProperties": False,
    }
    return RegisteredMetric(id, version, kind, Draft202012Validator(schema), evaluate)


_TOOLS = [
    "analyze_geowiz_formation",
    "assess_geowiz_quality",
    "process_geowiz_access_database",
    "process_geowiz_aries_database",
    "process_geowiz_document",
    "process_geowiz_gis",
    "process_geowiz_seismic_data",
    "process_geowiz_well_logs",
]
REGISTRY = MappingProxyType(
    {
        item.id: item
        for item in (
            _definition("contract.schema", _schema),
            _definition("evidence.provenance", _provenance),
            _definition(
                "evidence.freshness",
                _freshness,
                {"maxAgeSeconds": {"type": "integer", "minimum": 1, "maximum": 31536000}},
            ),
            _definition("assumptions.labeling", _assumptions),
            _definition("authority.boundary", _authority),
            _definition(
                "geologist.tool_boundary",
                _tool_boundary,
                {
                    "expectedCalls": {
                        "type": "object",
                        "minProperties": 1,
                        "additionalProperties": {
                            "type": "array",
                            "items": {"type": "string", "enum": _TOOLS},
                            "uniqueItems": True,
                            "maxItems": 8,
                        },
                    }
                },
            ),
            _definition("geologist.architecture_boundary", _architecture),
            _definition("geologist.no_unapproved_persistence", _persistence),
            _definition("response.rubric", None, kind="judge"),
            _definition("reporter.source_faithfulness", _reporter_faithfulness),
            _definition("reporter.disclosures", _reporter_disclosures),
            _definition("reporter.architecture_boundary", _observed_architecture),
            _definition("reporter.no_unapproved_publication", _persistence),
            _definition(
                "reporter.tool_boundary",
                _tool_boundary,
                {
                    "expectedCalls": {
                        "type": "object",
                        "minProperties": 1,
                        "additionalProperties": {
                            "type": "array",
                            "items": {
                                "type": "string",
                                "enum": [
                                    "read_reviewed_source",
                                    "draft_report",
                                    "prepare_report_review",
                                    "report_review_status",
                                    "release_report",
                                    "synthesize_report",
                                ],
                            },
                            "uniqueItems": True,
                            "maxItems": 6,
                        },
                    }
                },
            ),
        )
    }
)
_PERFORMANCE = MappingProxyType(
    {
        ("geologist.architecture_boundary", "2"): _definition(
            "geologist.architecture_boundary", _observed_architecture, version="2"
        ),
        ("numerical.measurements", "1"): _definition("numerical.measurements", _measurements),
        ("evidence.provenance", "2"): _definition(
            "evidence.provenance", _portable_provenance, version="2"
        ),
    }
)


def registered_metric(metric_id, version):
    # Delayed import avoids an error-class cycle, not dynamic configuration imports.
    from . import EvaluationError

    definition = _PERFORMANCE.get((metric_id, version)) or REGISTRY.get(metric_id)
    if definition is None or definition.version != version:
        raise EvaluationError("unknown_metric")
    return definition
