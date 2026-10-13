"""Versioned data-only profiles. These checks do not authorize employee actions."""

import hashlib
import json
import math
from dataclasses import dataclass
from importlib.resources import files

import rfc8785
from jsonschema import Draft202012Validator, FormatChecker

from .metrics import registered_metric

SCHEMA_VERSION = "0.1.0"
REGISTRY_VERSION = "0.1.0"
SCHEMA = json.loads(
    files(__package__).joinpath("schemas/eval-profile-0.1.0.schema.json").read_text()
)
Draft202012Validator.check_schema(SCHEMA)
_VALIDATOR = Draft202012Validator(SCHEMA, format_checker=FormatChecker())
_PERFORMANCE_SCHEMA = json.loads(
    files(__package__).joinpath("schemas/eval-profile-0.2.0.schema.json").read_text()
)
Draft202012Validator.check_schema(_PERFORMANCE_SCHEMA)
_VALIDATORS = {
    "0.1.0": _VALIDATOR,
    "0.2.0": Draft202012Validator(_PERFORMANCE_SCHEMA, format_checker=FormatChecker()),
}
_MANDATORY = frozenset(
    {
        "contract.schema",
        "evidence.provenance",
        "evidence.freshness",
        "assumptions.labeling",
        "authority.boundary",
    }
)


class EvaluationError(ValueError):
    """Value-free diagnostic; never includes configuration, source or secret text."""

    def __init__(self, code):
        self.code = code
        super().__init__("Evaluation rejected: " + code)


def _canonical(value):
    try:
        return rfc8785.dumps(value).decode("utf-8")
    except (ValueError, UnicodeError, TypeError, RecursionError):
        raise EvaluationError("invalid_json") from None


def _hash(text):
    return hashlib.sha256(text.encode()).hexdigest()


def _pairs(items):
    result = {}
    for key, value in items:
        if key in result:
            raise EvaluationError("invalid_json")
        result[key] = value
    return result


def _reject_constant(_):
    raise EvaluationError("invalid_json")


def _json(text, maximum=65536):
    try:
        if (
            type(text) not in (str, bytes)
            or len(text if isinstance(text, bytes) else text.encode()) > maximum
        ):
            raise EvaluationError("invalid_json")
        return json.loads(text, object_pairs_hook=_pairs, parse_constant=_reject_constant)
    except (ValueError, TypeError, UnicodeError, RecursionError):
        raise EvaluationError("invalid_json") from None


@dataclass(frozen=True)
class TrustedEvalPolicy:
    """Installed/private policy, supplied by the host rather than profile or model."""

    role_id: str
    max_source_age_seconds: int = 31536000
    allowed_judges: tuple | None = None

    def __post_init__(self):
        if self.allowed_judges is None:
            object.__setattr__(self, "allowed_judges", ((f"judge.{self.role_id}", "r1"),))
        if (
            type(self.role_id) is not str
            or not self.role_id
            or type(self.max_source_age_seconds) is not int
            or not 1 <= self.max_source_age_seconds <= 31536000
        ):
            raise EvaluationError("invalid_policy")
        if type(self.allowed_judges) is not tuple or any(
            type(ref) is not tuple
            or len(ref) != 2
            or any(type(item) is not str or not item for item in ref)
            for ref in self.allowed_judges
        ):
            raise EvaluationError("invalid_policy")

    @property
    def required_metrics(self):
        return _MANDATORY | (
            {"geologist.no_unapproved_persistence", "geologist.architecture_boundary"}
            if self.role_id == "geologist"
            else {
                "reporter.architecture_boundary",
                "reporter.no_unapproved_publication",
                "reporter.tool_boundary",
                "reporter.source_faithfulness",
                "reporter.disclosures",
            }
            if self.role_id == "reporter"
            else set()
        )


@dataclass(frozen=True)
class LoadedProfile:
    """Detached immutable configuration with the exact canonical content hash."""

    _json: str
    config_hash: str
    dataset_hashes: tuple
    case_ids: tuple = ()

    def configuration(self):
        return json.loads(self._json)


def load_profile(text, *, datasets, policy):
    """Load bounded JSON and verify supplied dataset bytes; never fetch a URI or run code."""
    if not isinstance(policy, TrustedEvalPolicy) or type(datasets) is not dict:
        raise EvaluationError("invalid_policy")
    value = _json(text)
    if type(value) is dict and (
        value.get("schemaVersion") not in _VALIDATORS
        or value.get("registryVersion") != value.get("schemaVersion")
    ):
        raise EvaluationError("unsupported_version")
    validator = _VALIDATORS.get(value.get("schemaVersion")) if type(value) is dict else None
    if validator is None or not validator.is_valid(value):
        raise EvaluationError("invalid_profile")
    if value["roleId"] != policy.role_id:
        raise EvaluationError("policy_denied")
    metrics = value["metrics"]
    ids = [metric["id"] for metric in metrics]
    if len(set(ids)) != len(ids):
        raise EvaluationError("duplicate_metric")
    required = policy.required_metrics | (
        {"numerical.measurements"}
        if value["schemaVersion"] == "0.2.0" and policy.role_id == "geologist"
        else set()
    )
    if not required.issubset(ids):
        raise EvaluationError("policy_denied")
    case_ids, dataset_hashes = set(), []
    for dataset in value["datasets"]:
        content = datasets.get(dataset["id"])
        if (
            type(content) is not bytes
            or len(content) > 8388608
            or hashlib.sha256(content).hexdigest() != dataset["sha256"]
            or dataset["uri"] != "urn:sha256:" + dataset["sha256"]
        ):
            raise EvaluationError("dataset_mismatch")
        if dataset["id"] in {ref[0] for ref in dataset_hashes}:
            raise EvaluationError("duplicate_dataset")
        parsed = _json(content, maximum=8388608)
        if (
            type(parsed) is not dict
            or type(parsed.get("eval_cases")) is not list
            or not parsed["eval_cases"]
        ):
            raise EvaluationError("invalid_dataset")
        for case in parsed["eval_cases"]:
            if (
                type(case) is not dict
                or type(case.get("eval_case_id")) is not str
                or not case["eval_case_id"]
                or case["eval_case_id"] in case_ids
            ):
                raise EvaluationError("invalid_dataset")
            case_ids.add(case["eval_case_id"])
        dataset_hashes.append((dataset["id"], dataset["sha256"]))
    for metric in metrics:
        definition = registered_metric(metric["id"], metric["version"])
        if value["schemaVersion"] == "0.1.0" and (
            definition.version != "1" or metric["id"] == "numerical.measurements"
        ):
            raise EvaluationError("unsupported_version")
        if (
            value["schemaVersion"] == "0.2.0"
            and metric["id"] == "geologist.architecture_boundary"
            and metric["version"] != "2"
        ):
            raise EvaluationError("policy_denied")
        if not definition.parameter_validator.is_valid(metric["parameters"]):
            raise EvaluationError("invalid_parameters")
        if metric["id"].startswith("geologist.") and policy.role_id != "geologist":
            raise EvaluationError("policy_denied")
        if metric["id"].startswith("reporter.") and policy.role_id != "reporter":
            raise EvaluationError("policy_denied")
        if policy.role_id != "reporter" and metric["id"] == "evidence.provenance" and metric["version"] == "2":
            raise EvaluationError("policy_denied")
        if (
            policy.role_id == "reporter"
            and metric["id"] == "evidence.provenance"
            and metric["version"] != "2"
        ):
            raise EvaluationError("policy_denied")
        if metric["id"] in required and (
            not metric["hardGate"] or metric["threshold"] != 1 or metric["onFailure"] != "block"
        ):
            raise EvaluationError("policy_denied")
        if (
            metric["id"] == "evidence.freshness"
            and metric["parameters"]["maxAgeSeconds"] > policy.max_source_age_seconds
        ):
            raise EvaluationError("policy_denied")
        if (
            metric["id"] in {"geologist.tool_boundary", "reporter.tool_boundary"}
            and set(metric["parameters"]["expectedCalls"]) != case_ids
        ):
            raise EvaluationError("invalid_parameters")
        if definition.kind == "judge":
            ref = metric["judgeRef"]
            if (
                ref is None
                or not metric["rubric"]
                or (ref["id"], ref["version"]) not in policy.allowed_judges
            ):
                raise EvaluationError("policy_denied")
        elif metric["judgeRef"] is not None or metric["rubric"] is not None:
            raise EvaluationError("invalid_profile")
    canonical = _canonical(value)
    return LoadedProfile(
        canonical, _hash(canonical), tuple(dataset_hashes), tuple(sorted(case_ids))
    )


@dataclass(frozen=True)
class EvaluationContext:
    """Host-observed inputs, never inferred from an employee's response text."""

    _json: str

    @classmethod
    def from_trusted_runtime(
        cls, *, scope, task_revision, product_ref, evaluated_at, source_artifacts, observations
    ):
        value = {
            "scope": scope,
            "taskRevision": task_revision,
            "productRef": product_ref,
            "evaluatedAt": evaluated_at,
            "sourceArtifacts": source_artifacts,
            "observations": observations,
        }
        try:
            canonical = _canonical(value)
            if len(canonical.encode()) > 8388608:
                raise ValueError
        except (TypeError, ValueError, RecursionError):
            raise EvaluationError("invalid_runtime_evidence") from None
        return cls(canonical)

    def data(self):
        return json.loads(self._json)


@dataclass(frozen=True)
class MetricScore:
    metric_id: str
    metric_version: str
    config_hash: str
    trace_hash: str
    runtime_hash: str
    _scope_json: str
    task_revision: str
    score: float | None
    reason: str
    _judge_json: str
    _profile_json: str
    schema_version: str = SCHEMA_VERSION
    registry_version: str = REGISTRY_VERSION

    @property
    def scope(self):
        return json.loads(self._scope_json)

    @property
    def judge_ref(self):
        return json.loads(self._judge_json)

    @property
    def profile_ref(self):
        return json.loads(self._profile_json)


def evaluate_metric(profile, metric_id, trace, context):
    """Grade one frozen observation. A judge metric remains pending for the run adapter."""
    if not isinstance(profile, LoadedProfile) or not isinstance(context, EvaluationContext):
        raise EvaluationError("invalid_runtime_evidence")
    metric = next(
        (item for item in profile.configuration()["metrics"] if item["id"] == metric_id), None
    )
    if metric is None:
        raise EvaluationError("unknown_metric")
    try:
        trace_json = _canonical(trace)
        if type(trace) is not dict or len(trace_json.encode()) > 8388608:
            raise ValueError
        # No mutable/model state crosses into the evaluator's host-observed inputs.
        detached = _json(trace_json, maximum=8388608)
        runtime = context.data()
        definition = registered_metric(metric_id, metric["version"])
        value = (
            None
            if definition.kind == "judge"
            else float(definition.evaluate(detached, runtime, metric["parameters"]))
        )
    except (ValueError, TypeError, KeyError, AttributeError, IndexError, RecursionError):
        raise EvaluationError("invalid_runtime_evidence") from None
    return MetricScore(
        metric_id,
        metric["version"],
        profile.config_hash,
        _hash(trace_json),
        _hash(context._json),
        _canonical(runtime.get("scope")),
        runtime.get("taskRevision"),
        value,
        "judge_required" if value is None else "passed" if value == 1 else "check_failed",
        _canonical(metric["judgeRef"]),
        _canonical(profile.configuration()["profileRef"]),
        profile.configuration()["schemaVersion"],
        profile.configuration()["registryVersion"],
    )


def summarize_scores(profile, scores):
    """Apply profile policy; a failed hard gate overrides quality averages and missing judges."""
    config = profile.configuration()
    selected = {item["id"]: item for item in config["metrics"]}
    observed, bindings = {}, set()
    for result in scores:
        if (
            not isinstance(result, MetricScore)
            or result.config_hash != profile.config_hash
            or result.metric_id in observed
            or result.metric_id not in selected
            or result.metric_version != selected[result.metric_id]["version"]
            or result.profile_ref != config["profileRef"]
            or result.schema_version != config["schemaVersion"]
            or result.registry_version != config["registryVersion"]
            or (
                result.score is not None
                and (
                    type(result.score) not in (int, float)
                    or not math.isfinite(result.score)
                    or not 0 <= result.score <= 1
                )
            )
        ):
            raise EvaluationError("receipt_mismatch")
        observed[result.metric_id] = result
        bindings.add(
            (result.runtime_hash, result.trace_hash, result._scope_json, result.task_revision)
        )
    if len(bindings) > 1:
        raise EvaluationError("receipt_mismatch")
    failed = [
        key
        for key, item in selected.items()
        if key in observed
        and observed[key].score is not None
        and observed[key].score < item["threshold"]
    ]
    missing = [key for key in selected if key not in observed or observed[key].score is None]
    scored = [
        (selected[key], result.score)
        for key, result in observed.items()
        if result.score is not None
    ]
    weighted = (
        sum(item["weight"] * score for item, score in scored)
        / sum(item["weight"] for item, _ in scored)
        if scored
        else None
    )
    blocking = any(
        selected[key]["hardGate"] or selected[key]["onFailure"] == "block" for key in failed
    )
    if blocking:
        status = "failed"
    elif missing:
        status = "pending"
    elif any(selected[key]["onFailure"] == "review" for key in failed):
        status = "review_required"
    else:
        status = "failed" if weighted < config["aggregateThreshold"] else "passed"
    return {
        "status": status,
        "configHash": profile.config_hash,
        "profileRef": config["profileRef"],
        "schemaVersion": config["schemaVersion"],
        "registryVersion": config["registryVersion"],
        "score": weighted,
        "failedMetrics": failed,
        "missingMetrics": missing,
        "failureAction": "block"
        if blocking
        else config["failureAction"]
        if status in ("failed", "review_required")
        else None,
    }


__all__ = [
    "EvaluationContext",
    "EvaluationError",
    "LoadedProfile",
    "MetricScore",
    "REGISTRY_VERSION",
    "SCHEMA_VERSION",
    "TrustedEvalPolicy",
    "evaluate_metric",
    "load_profile",
    "registered_metric",
    "summarize_scores",
]
