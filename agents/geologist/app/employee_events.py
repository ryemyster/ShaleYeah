"""Host-bound metadata hooks and native ADK callbacks; these hooks do not authorize actions."""

import hashlib
import json
import time
import uuid
from dataclasses import dataclass
from importlib.metadata import version

import rfc8785
from shaleyeah_contracts import validate_contract, validate_source_contract
from shaleyeah_contracts.events import EventValidationError
from shaleyeah_evaluations.runner import validate_report


def _hash(value):
    return hashlib.sha256(rfc8785.dumps(value)).hexdigest()


@dataclass(frozen=True)
class VerifiedReview:
    """Attestation supplied by the host's authenticated review boundary, not model/JSON input."""
    principal_id: str
    decision_hash: str
    policy_id: str
    policy_version: str


class GeologistEvents:
    def __init__(self, emitter, model_profile=None):
        self.emitter = emitter
        self._models = {}
        self._pending_review = set()
        self._model_profile = model_profile
        if model_profile and any(
            emitter.context["scope"][field] != model_profile["owner"][field]
            for field in ("customerId", "employeeId")
        ):
            raise EventValidationError("event_scope_mismatch")

    def _versions(self, reported=None):
        versions = {"runtime": {"id": "google-adk", "version": version("google-adk")}}
        if self._model_profile:
            profile = self._model_profile
            model = {"provider": profile["provider"], "id": profile["model"], "revision": profile["modelRevision"]}
            if reported:
                model["reportedRevision"] = reported
            versions["model"] = model
        return versions

    def _record(self, value, kind, product=None):
        try:
            expected = self.emitter.context
            options = {"expectedScope": expected["scope"], "expectedTaskRevision": expected["taskRevision"]}
            if product is not None:
                options["expectedProductRef"] = product
            validate_contract(value, options)
            if value["kind"] != kind:
                raise ValueError()
            return json.loads(rfc8785.dumps(value))
        except Exception:
            raise EventValidationError("invalid_employee_record") from None

    @staticmethod
    def _ref(value, kind):
        target = value["artifact"] if kind == "work-product" else value
        return {"kind": kind, "id": target["id"], "revision": target["revision"], "sha256": _hash(value)}

    @staticmethod
    def _source_refs(evidence):
        return [{"kind": "source", "id": item["id"], "revision": item["revision"], "sha256": item["hash"]["value"]} for item in evidence]

    async def record_task(self, task, *, parent_event_id=None):
        task = self._record(task, "task-assignment")
        statuses = {"assigned": "started", "running": "started", "awaiting_review": "review-required", "completed": "succeeded", "failed": "failed", "blocked": "blocked", "cancelled": "blocked"}
        return await self.emitter.emit("task", statuses[task["status"]], refs=[self._ref(task, "task")], **({"parentEventId": parent_event_id} if parent_event_id else {}))

    async def record_context(self, manifest, *, parent_event_id=None):
        manifest = self._record(manifest, "context-manifest")
        return await self.emitter.emit("context", "blocked" if manifest["blockers"] else "succeeded",
            refs=[self._ref(manifest, "context"), *self._source_refs(manifest["selectedEvidence"])],
            **({"parentEventId": parent_event_id} if parent_event_id else {}))

    async def record_work(self, product, *, parent_event_id=None):
        product = self._record(product, "work-product")
        # A declared final/approved artifact is still a claim until the separate verified review hook records it.
        status = "failed" if product["status"] == "failed" else "blocked" if product["blockers"] else "review-required"
        return await self.emitter.emit("work-product", status,
            refs=[self._ref(product, "work-product"), *self._source_refs(product["evidence"])],
            **({"modelConfidence": product["confidence"]} if "confidence" in product else {}),
            **({"parentEventId": parent_event_id} if parent_event_id else {}))

    async def record_review_request(self, request, *, parent_event_id=None):
        request = self._record(request, "review-request")
        return await self.emitter.emit("review", "review-required", refs=[self._ref(request, "review")],
            **({"parentEventId": parent_event_id} if parent_event_id else {}))

    async def record_review(self, request, decision, *, verified, measurements=None, parent_event_id=None):
        request = self._record(request, "review-request")
        decision = self._record(decision, "review-decision", request["productRef"])
        if (
            not isinstance(verified, VerifiedReview) or verified.decision_hash != _hash(decision)
            or verified.principal_id != decision["reviewer"]["principalId"]
            or {"id": verified.policy_id, "version": verified.policy_version} != request["reviewerPolicy"]
            or decision["reviewer"]["authorityPolicy"] != request["reviewerPolicy"]
            or decision["requestRef"] != {"id": request["id"], "revision": request["revision"]}
            or (measurements is not None and (type(measurements) is not dict or not set(measurements) <= {"humanReviewSeconds", "corrections", "reworkCount"}))
        ):
            raise EventValidationError("review_not_authenticated")
        status = {"approve": "approved", "reject": "rejected", "request_changes": "revision-requested"}[decision["decision"]]
        return await self.emitter.emit("review", status, refs=[self._ref(request, "review"), self._ref(decision, "review")],
            **({"measurements": measurements} if measurements is not None else {}),
            **({"parentEventId": parent_event_id} if parent_event_id else {}))

    async def record_evaluation(self, report, *, product=None, parent_event_id=None):
        try:
            validate_report(report)
            expected = self.emitter.context
            if report["scope"] != expected["scope"] or report["taskRevision"] != expected["taskRevision"] or report["candidate"]["qualification"] != expected["qualification"]:
                raise ValueError()
            report = json.loads(rfc8785.dumps(report))
        except Exception:
            raise EventValidationError("invalid_evaluation_record") from None
        digest = _hash(report)
        refs = [{"kind": "evaluation", "id": "eval-" + digest[:32], "revision": report["schemaVersion"], "sha256": digest},
            {"kind": "profile", "id": report["profileRef"]["id"], "revision": report["profileRef"]["version"], "sha256": report["configHash"]}]
        if product is not None:
            product = self._record(product, "work-product")
            if any(product["artifact"][field] != report["productRef"][field] for field in ("id", "revision")):
                raise EventValidationError("invalid_evaluation_record")
            refs.append(self._ref(product, "work-product"))
        status = {"passed": "succeeded", "failed": "failed", "blocked": "blocked", "review-required": "review-required", "infra-error": "infra-error"}[report["status"]]
        measures = {key: value for key, value in report["measurements"].items() if key in {"corrections", "reworkCount", "taskCompleted", "escalationQuality", "toolFailures"}}
        if "reviewSeconds" in report["measurements"]:
            measures["humanReviewSeconds"] = report["measurements"]["reviewSeconds"]
        return await self.emitter.emit("evaluation", status, refs=refs, versions={key: report["candidate"][key] for key in ("model", "runtime", "harness")},
            modelConfidence=report["modelConfidence"], **({"measurements": measures} if measures else {}),
            **({"parentEventId": parent_event_id} if parent_event_id else {}))

    async def before_agent(self, callback_context):
        await self.emitter.emit("agent", "started", versions=self._versions())

    async def after_agent(self, callback_context):
        pending = callback_context.invocation_id in self._pending_review
        self._pending_review.discard(callback_context.invocation_id)
        blocked = callback_context.state.get("temp:context_blocked", False)
        await self.emitter.emit("agent", "blocked" if blocked else "review-required" if pending else "succeeded", versions=self._versions())

    async def before_model(self, callback_context, llm_request):
        span = uuid.uuid4().hex[:16]
        receipt = await self.emitter.emit("model", "started", spanId=span, versions=self._versions())
        self._models[callback_context.invocation_id] = (time.monotonic(), span, receipt["eventId"])

    async def after_model(self, callback_context, llm_response):
        if llm_response.custom_metadata and llm_response.custom_metadata.get("contextBlocked"):
            return
        if getattr(llm_response, "partial", False):
            return
        pending = self._models.pop(callback_context.invocation_id, None)
        details = {"versions": self._versions(llm_response.model_version)}
        if pending:
            details.update(spanId=pending[1], parentEventId=pending[2], measurements={"modelLatencyMs": (time.monotonic() - pending[0]) * 1000})
        await self.emitter.emit("model", "failed" if llm_response.error_code else "succeeded", **details)

    async def model_error(self, callback_context, llm_request, error):
        pending = self._models.pop(callback_context.invocation_id, None)
        details = {"versions": self._versions(), "errorCode": "model_failed"}
        if pending:
            details.update(spanId=pending[1], parentEventId=pending[2], measurements={"modelLatencyMs": (time.monotonic() - pending[0]) * 1000})
        await self.emitter.emit("model", "failed", **details)

    async def after_tool(self, tool, args, tool_context, tool_response):
        if tool_context.actions.requested_tool_confirmations:
            self._pending_review.add(tool_context.invocation_id)
            await self.emitter.emit("review", "review-required", toolName=tool.name, errorCode="confirmation_required")
        elif type(tool_response) is dict:
            payload = tool_response.get("structuredContent")
            analysis = payload.get("analysis") if type(payload) is dict else None
            source = analysis.get("sourceArtifact") if type(analysis) is dict else None
            if source:
                try:
                    validate_source_contract(source, {"expectedScope": self.emitter.context["scope"], "expectedTaskRevision": self.emitter.context["taskRevision"]})
                    reference = self._source_refs([source["evidence"]])
                except Exception:
                    raise EventValidationError("invalid_source_record") from None
                await self.emitter.emit("source", "succeeded", refs=reference)

    async def tool_error(self, tool, args, tool_context, error):
        await self.emitter.emit("tool", "failed", toolName=tool.name, errorCode="agent_tool_failed")
