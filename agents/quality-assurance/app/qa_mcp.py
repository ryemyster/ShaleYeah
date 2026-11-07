"""QA-owned tool mappings; installed transport resolves credentials outside model arguments."""

import json
from typing import Any

from shaleyeah_mcp import MCPClientError, call_tool, load_mcp_config


def backend_config():
    return load_mcp_config("QA_SERVER", "http://127.0.0.1:3004/mcp")


class QATools:
    def __init__(self, backend, *, events=None, context_hooks=None):
        self.backend, self.events = backend, events

        # Native request copies must retain the host callback, not copy its SQLite catalog.
        async def context_for(work):
            return await context_hooks.review_context(work)

        async def record_review(receipt):
            await context_hooks.record_review(receipt)

        self._context_provider = context_for if context_hooks is not None else None
        self._record_review = record_review if context_hooks is not None else None

    def qa_backend_status(self):
        return {
            "backend": "qa-server",
            "url": self.backend.endpoint,
            "independentBackend": True,
            "architectureMode": "stand-alone-with-progressive-disclosure-skills",
            "supervisionMode": "deterministic-business-state-adapter",
            "reviewBoundary": {
                "observedChecks": "current-source-and-profile-authority-required",
                "criticalDisposition": "exact-authenticated-human-review-required",
                "sourceCorrection": "producing-owner-new-revision-required",
            },
        }

    async def _call(self, name, arguments):
        options = {"events": self.events} if self.events is not None else {}
        return await call_tool(self.backend, name, arguments, **options)

    async def run_quality_checks(
        self, task_id: str, task_revision: str, profile_id: str, profile_revision: str
    ) -> dict[str, Any]:
        """Run the operator-approved profile on its exact authorized task; preserve domain failures."""
        return await self._call(
            "run_quality_tests",
            {
                "taskRef": {"id": task_id, "revision": task_revision},
                "profileRef": {"id": profile_id, "revision": profile_revision},
            },
        )

    async def read_quality_report(self, result_id: str, result_revision: str) -> dict[str, Any]:
        """Read the recorded observations under current source/export rights; do not estimate a pass."""
        return await self._call(
            "generate_quality_report", {"resultRef": {"id": result_id, "revision": result_revision}}
        )

    async def triage_quality_result(self, result_id: str, result_revision: str) -> dict[str, Any]:
        """Request optional unreviewed synthesis; observed counts and verdicts stay unchanged."""
        return await self._call(
            "triage_quality_result", {"resultRef": {"id": result_id, "revision": result_revision}}
        )

    async def prepare_disposition_review(
        self, candidate_json: str, expected_head: str | None = None
    ) -> dict[str, Any]:
        """Submit an exact disposition/work/context/eval revision; this cannot decide the review."""
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
        except (ValueError, TypeError):
            raise MCPClientError("invalid_arguments", "user_action") from None
        if self._context_provider is not None:
            try:
                disposition = candidate["disposition"]
                arguments = {
                    "resultRef": disposition["observedReport"]["resultRef"],
                    "proposal": disposition["proposal"],
                    "revision": candidate["work"]["artifact"]["revision"],
                }
            except (KeyError, TypeError):
                raise MCPClientError("invalid_arguments", "user_action") from None
            fresh = await self._call("draft_disposition", arguments)
            payload = fresh.get("structuredContent", {})
            actual = payload.get("analysis", {}) if isinstance(payload, dict) else {}
            if (
                fresh.get("isError")
                or not isinstance(payload, dict)
                or payload.get("success") is not True
                or not isinstance(actual, dict)
                or any(actual.get(key) != candidate.get(key) for key in ("work", "disposition"))
            ):
                raise MCPClientError("source_fidelity_mismatch", "user_action")
            context = await self._context_provider(candidate.get("work"))
            if "context" in candidate and candidate["context"] != context:
                raise MCPClientError("context_binding_mismatch", "user_action")
            candidate["context"] = context
        result = await self._call(
            "prepare_review", {"candidate": candidate, "expectedHead": expected_head}
        )
        if self._record_review is not None and not result.get("isError"):
            payload = result.get("structuredContent", {})
            if not isinstance(payload, dict) or payload.get("success") is not True:
                raise MCPClientError("invalid_review_checkpoint", "user_action")
            await self._record_review(payload.get("analysis"))
        return result

    async def draft_disposition(
        self,
        result_id: str,
        result_revision: str,
        action: str,
        reason: str,
        repair_owner: str,
        expires_at: str,
        work_revision: str = "r1",
    ) -> dict[str, Any]:
        """Derive exact draft work from backend observations; do not invent hashes or approve defects."""
        return await self._call(
            "draft_disposition",
            {
                "resultRef": {"id": result_id, "revision": result_revision},
                "proposal": {
                    "action": action,
                    "reason": reason,
                    "repairOwner": repair_owner,
                    "expiresAt": expires_at,
                },
                "revision": work_revision,
            },
        )

    async def disposition_review_status(self, review_id: str | None = None) -> dict[str, Any]:
        """Read the current scoped checkpoint after human edits, rejection, approval or restart."""
        return await self._call("get_review_status", {"reviewId": review_id} if review_id else {})

    async def record_disposition(
        self, review_id: str, packet_digest: str, grant_id: str
    ) -> dict[str, Any]:
        """Commit only the exact authenticated human-approved private disposition, once."""
        return await self._call(
            "record_disposition",
            {"reviewId": review_id, "packetDigest": packet_digest, "grantId": grant_id},
        )
