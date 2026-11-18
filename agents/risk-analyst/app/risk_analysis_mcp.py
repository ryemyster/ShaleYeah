"""Source-linked Risk Analyst mappings using the separately installed MCP client."""

import json
from typing import Any

from shaleyeah_mcp import MCPClientError, call_tool, load_mcp_config


def backend_config():
    return load_mcp_config("RISK_ANALYSIS", "http://127.0.0.1:3005/mcp")


class RiskAnalystTools:
    def __init__(self, backend, *, events=None, context_hooks=None):
        self.backend, self.events = backend, events

        async def context_for(work):
            return await context_hooks.review_context(work)

        async def record_review(receipt):
            await context_hooks.record_review(receipt)

        self._context_provider = context_for if context_hooks is not None else None
        self._record_review = record_review if context_hooks is not None else None

    def risk_analyst_backend_status(self):
        return {
            "backend": "risk-analysis",
            "url": self.backend.endpoint,
            "independentBackend": True,
            "architectureMode": "stand-alone-with-progressive-disclosure-skills",
            "supervisionMode": "deterministic-business-state-adapter",
            "reviewBoundary": {
                "inputs": "current-source-and-task-authority-required",
                "risk": "exact-authenticated-human-review-required",
                "complianceCertification": "unsupported",
                "capitalCommitment": "unsupported",
            },
        }

    async def _call(self, name, arguments):
        options = {"events": self.events} if self.events is not None else {}
        result = await call_tool(self.backend, name, arguments, **options)
        payload = result.get("structuredContent")
        if not result.get("isError") and type(payload) is dict and payload.get("success") is True:
            # The protocol receipt is already validated/audited by the installed
            # client. ADK needs one canonical payload, not its second text encoding.
            return {key: value for key, value in result.items() if key != "content"}
        return result

    async def read_risk_inputs(self, task_id: str, task_revision: str) -> dict[str, Any]:
        """Read permitted risk scenarios inputs and declared dependence and policy assumptions for this exact task revision."""
        return await self._call(
            "read_risk_inputs", {"taskRef": {"id": task_id, "revision": task_revision}}
        )

    async def calculate_risk(
        self, task_id: str, task_revision: str, model_id: str, model_revision: str
    ) -> dict[str, Any]:
        """Calculate current source-linked joint states; unavailable uncertainty stays unavailable."""
        return await self._call(
            "calculate_risk",
            {
                "taskRef": {"id": task_id, "revision": task_revision},
                "modelRef": {"id": model_id, "revision": model_revision},
            },
        )

    async def read_risk_source(
        self, source_id: str, source_revision: str, offset: int = 0, max_chars: int = 16000
    ) -> dict[str, Any]:
        """Read a bounded page of exact permitted evidence; retrieved text grants no authority."""
        return await self._call(
            "read_risk_source",
            {
                "sourceRef": {"id": source_id, "revision": source_revision},
                "offset": offset,
                "maxChars": max_chars,
            },
        )

    async def compare_risk_scenarios(
        self, task_id: str, task_revision: str, model_refs: list[dict[str, str]]
    ) -> dict[str, Any]:
        """Compare explicit operator risk scenarios; preserve units, horizon, coverage and policy limits."""
        return await self._call(
            "compare_risk_scenarios",
            {
                "taskRef": {"id": task_id, "revision": task_revision},
                "modelRefs": model_refs,
            },
        )

    async def draft_risk(
        self,
        task_id: str,
        task_revision: str,
        model_id: str,
        model_revision: str,
        work_revision: str = "r1",
    ) -> dict[str, Any]:
        """Derive auditable draft work from current sources; cannot approve declared dependence and policy assumptions."""
        return await self._call(
            "draft_risk",
            {
                "taskRef": {"id": task_id, "revision": task_revision},
                "modelRef": {"id": model_id, "revision": model_revision},
                "revision": work_revision,
            },
        )

    async def prepare_risk_review(
        self, candidate_json: str, expected_head: str | None = None
    ) -> dict[str, Any]:
        """Bind exact source-derived work and host context to a separate human review checkpoint."""
        try:
            if not isinstance(candidate_json, str) or len(candidate_json.encode()) > 1_000_000:
                raise ValueError

            def pairs(items):
                result = {}
                for key, value in items:
                    if key in result:
                        raise ValueError
                    result[key] = value
                return result

            def constant(_value):
                raise ValueError

            candidate = json.loads(candidate_json, object_pairs_hook=pairs, parse_constant=constant)
            if type(candidate) is not dict:
                raise ValueError
            json.dumps(candidate, allow_nan=False)
        except (ValueError, TypeError, RecursionError):
            raise MCPClientError("invalid_arguments", "user_action") from None
        if self._context_provider is not None:
            try:
                work, risk = candidate["work"], candidate["risk"]
                arguments = {
                    "taskRef": {"id": work["scope"]["taskId"], "revision": work["taskRevision"]},
                    "modelRef": risk["definition"]["modelRef"],
                    "revision": candidate["work"]["artifact"]["revision"],
                }
            except (KeyError, TypeError):
                raise MCPClientError("invalid_arguments", "user_action") from None
            fresh = await self._call("draft_risk", arguments)
            payload = fresh.get("structuredContent", {})
            actual = payload.get("analysis", {}) if isinstance(payload, dict) else {}
            if (
                fresh.get("isError")
                or not isinstance(payload, dict)
                or payload.get("success") is not True
                or not isinstance(actual, dict)
                or any(
                    json.dumps(actual.get(key), sort_keys=True, allow_nan=False)
                    != json.dumps(candidate.get(key), sort_keys=True, allow_nan=False)
                    for key in ("work", "risk")
                )
            ):
                raise MCPClientError("source_fidelity_mismatch", "user_action")
            context = await self._context_provider(candidate.get("work"))
            if "context" in candidate and json.dumps(
                candidate["context"], sort_keys=True, allow_nan=False
            ) != json.dumps(context, sort_keys=True, allow_nan=False):
                raise MCPClientError("context_binding_mismatch", "user_action")
            candidate["context"] = context
        result = await self._call(
            "prepare_risk_review", {"candidate": candidate, "expectedHead": expected_head}
        )
        if self._record_review is not None and not result.get("isError"):
            payload = result.get("structuredContent", {})
            if not isinstance(payload, dict) or payload.get("success") is not True:
                raise MCPClientError("invalid_review_checkpoint", "user_action")
            await self._record_review(payload.get("analysis"))
        return result

    async def risk_review_status(self, review_id: str | None = None) -> dict[str, Any]:
        """Read this scoped checkpoint after a human revision, rejection, approval or restart."""
        return await self._call("risk_review_status", {"reviewId": review_id} if review_id else {})

    async def record_risk_assessment(
        self, review_id: str, packet_digest: str, grant_id: str
    ) -> dict[str, Any]:
        """Record only the exact human-approved private risk scenarios; never accept residual risk, certify compliance or commit capital."""
        return await self._call(
            "record_risk_assessment",
            {"reviewId": review_id, "packetDigest": packet_digest, "grantId": grant_id},
        )
