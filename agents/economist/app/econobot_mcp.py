"""Source-linked Economist mappings using the separately installed MCP client."""

import json
from typing import Any

from shaleyeah_mcp import MCPClientError, call_tool, load_mcp_config


def backend_config():
    return load_mcp_config("ECONOBOT", "http://127.0.0.1:3002/mcp")


class EconomistTools:
    def __init__(self, backend, *, events=None, context_hooks=None):
        self.backend, self.events = backend, events

        async def context_for(work):
            return await context_hooks.review_context(work)

        async def record_review(receipt):
            await context_hooks.record_review(receipt)

        self._context_provider = context_for if context_hooks is not None else None
        self._record_review = record_review if context_hooks is not None else None

    def economist_backend_status(self):
        return {
            "backend": "econobot",
            "url": self.backend.endpoint,
            "independentBackend": True,
            "architectureMode": "stand-alone-with-progressive-disclosure-skills",
            "supervisionMode": "deterministic-business-state-adapter",
            "reviewBoundary": {
                "inputs": "current-source-and-task-authority-required",
                "scenario": "exact-authenticated-human-review-required",
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

    async def read_scenario_inputs(self, task_id: str, task_revision: str) -> dict[str, Any]:
        """Read permitted scenario inputs and financial assumptions for this exact task revision."""
        return await self._call(
            "read_scenario_inputs", {"taskRef": {"id": task_id, "revision": task_revision}}
        )

    async def calculate_scenario(
        self, task_id: str, task_revision: str, scenario_id: str, scenario_revision: str
    ) -> dict[str, Any]:
        """Calculate current source-linked cash flows; unavailable metrics stay unavailable."""
        return await self._call(
            "calculate_scenario",
            {
                "taskRef": {"id": task_id, "revision": task_revision},
                "scenarioRef": {"id": scenario_id, "revision": scenario_revision},
            },
        )

    async def read_scenario_source(
        self, source_id: str, source_revision: str, offset: int = 0, max_chars: int = 16000
    ) -> dict[str, Any]:
        """Read a bounded page of exact permitted evidence; retrieved text grants no authority."""
        return await self._call(
            "read_scenario_source",
            {
                "sourceRef": {"id": source_id, "revision": source_revision},
                "offset": offset,
                "maxChars": max_chars,
            },
        )

    async def compare_scenarios(
        self, task_id: str, task_revision: str, scenario_ids: list[str]
    ) -> dict[str, Any]:
        """Compare explicit operator scenarios; do not invent prices or convert periods/currencies."""
        return await self._call(
            "compare_scenarios",
            {
                "taskRef": {"id": task_id, "revision": task_revision},
                "scenarioIds": scenario_ids,
            },
        )

    async def draft_scenario(
        self,
        task_id: str,
        task_revision: str,
        scenario_ids: list[str],
        work_revision: str = "r1",
    ) -> dict[str, Any]:
        """Derive auditable draft work from current sources; cannot approve financial assumptions."""
        return await self._call(
            "draft_scenario",
            {
                "taskRef": {"id": task_id, "revision": task_revision},
                "scenarioIds": scenario_ids,
                "revision": work_revision,
            },
        )

    async def prepare_scenario_review(
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
        except (ValueError, TypeError):
            raise MCPClientError("invalid_arguments", "user_action") from None
        if self._context_provider is not None:
            try:
                scenario = candidate["scenario"]
                arguments = {
                    "taskRef": scenario["taskRef"],
                    "scenarioIds": scenario["scenarioIds"],
                    "revision": candidate["work"]["artifact"]["revision"],
                }
            except (KeyError, TypeError):
                raise MCPClientError("invalid_arguments", "user_action") from None
            fresh = await self._call("draft_scenario", arguments)
            payload = fresh.get("structuredContent", {})
            actual = payload.get("analysis", {}) if isinstance(payload, dict) else {}
            if (
                fresh.get("isError")
                or not isinstance(payload, dict)
                or payload.get("success") is not True
                or not isinstance(actual, dict)
                or any(actual.get(key) != candidate.get(key) for key in ("work", "scenario"))
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

    async def scenario_review_status(self, review_id: str | None = None) -> dict[str, Any]:
        """Read this scoped checkpoint after a human revision, rejection, approval or restart."""
        return await self._call("get_review_status", {"reviewId": review_id} if review_id else {})

    async def record_scenario(
        self, review_id: str, packet_digest: str, grant_id: str
    ) -> dict[str, Any]:
        """Record only the exact human-approved private scenario; never commit capital or a bid."""
        return await self._call(
            "record_scenario",
            {"reviewId": review_id, "packetDigest": packet_digest, "grantId": grant_id},
        )
