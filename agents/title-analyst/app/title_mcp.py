"""Source-cited Title tools using the separately installed MCP client."""

import json
from typing import Any

from shaleyeah_mcp import MCPClientError, call_tool, load_mcp_config


def backend_config():
    return load_mcp_config("TITLE", "http://127.0.0.1:3010/mcp")


def _json(text, expected):
    try:
        if type(text) is not str or len(text.encode()) > 1_000_000:
            raise ValueError

        def pairs(items):
            value = {}
            for key, item in items:
                if key in value:
                    raise ValueError
                value[key] = item
            return value

        def constant(_):
            raise ValueError

        value = json.loads(text, object_pairs_hook=pairs, parse_constant=constant)
        if type(value) is not expected:
            raise ValueError
        json.dumps(value, allow_nan=False)
        return value
    except (ValueError, TypeError, RecursionError):
        raise MCPClientError("invalid_arguments", "user_action") from None


class TitleAnalystTools:
    def __init__(self, backend, *, events=None, context_hooks=None):
        self.backend, self.events = backend, events

        async def context_for(work):
            return await context_hooks.review_context(work)

        async def record_review(receipt):
            await context_hooks.record_review(receipt)

        self._context_provider = context_for if context_hooks is not None else None
        self._record_review = record_review if context_hooks is not None else None

    def title_analyst_backend_status(self):
        return {
            "backend": "title",
            "url": self.backend.endpoint,
            "independentBackend": True,
            "architectureMode": "stand-alone-with-progressive-disclosure-skills",
            "supervisionMode": "deterministic-business-state-adapter",
            "reviewBoundary": {
                "inputs": "current-source-and-task-authority-required",
                "packet": "exact-enrolled-human-review-required",
                "titleClearance": "unsupported",
                "legalOpinion": "unsupported",
                "externalTransfer": "unsupported",
                "leaseAcceptance": "unsupported",
                "filing": "unsupported",
                "capitalCommitment": "unsupported",
            },
        }

    async def _call(self, name, arguments):
        options = {"events": self.events} if self.events is not None else {}
        result = await call_tool(self.backend, name, arguments, **options)
        payload = result.get("structuredContent")
        if not result.get("isError") and type(payload) is dict and payload.get("success") is True:
            # The installed client already validates/audits the wire receipt.
            return {key: value for key, value in result.items() if key != "content"}
        return result

    async def read_title_inputs(self, task_id: str, task_revision: str) -> dict[str, Any]:
        """Discover permitted questions, instrument revisions, interest/depth scope and review policy for the exact task."""
        return await self._call(
            "read_title_inputs", {"taskRef": {"id": task_id, "revision": task_revision}}
        )

    async def read_title_source(
        self, source_id: str, source_revision: str, offset: int = 0, max_chars: int = 16000
    ) -> dict[str, Any]:
        """Read a bounded exact JSON export. Paging counts Unicode code points, not citation bytes."""
        return await self._call(
            "read_title_source",
            {
                "sourceRef": {"id": source_id, "revision": source_revision},
                "offset": offset,
                "maxChars": max_chars,
            },
        )

    async def read_title_instrument(
        self,
        task_id: str,
        task_revision: str,
        instrument_id: str,
        instrument_revision: str,
        section_id: str,
        offset: int = 0,
        max_chars: int = 16000,
    ) -> dict[str, Any]:
        """Read exact instrument section text with recording, tract and jurisdiction identity. Paging counts Unicode code points."""
        return await self._call(
            "read_title_instrument",
            {
                "taskRef": {"id": task_id, "revision": task_revision},
                "instrumentRef": {"id": instrument_id, "revision": instrument_revision},
                "sectionId": section_id,
                "offset": offset,
                "maxChars": max_chars,
            },
        )

    async def cite_title_instrument(
        self,
        task_id: str,
        task_revision: str,
        instrument_id: str,
        instrument_revision: str,
        section_id: str,
        quote: str,
        occurrence: int | None = None,
    ) -> dict[str, Any]:
        """Select an exact quote. The backend calculates UTF-8 offsets and SHA-256; copy its citation. Repeated matches require a zero-based occurrence."""
        arguments = {
            "taskRef": {"id": task_id, "revision": task_revision},
            "instrumentRef": {"id": instrument_id, "revision": instrument_revision},
            "sectionId": section_id,
            "quote": quote,
        }
        if occurrence is not None:
            arguments["occurrence"] = occurrence
        return await self._call("cite_title_instrument", arguments)

    async def get_context_source_metadata(
        self, source_id: str, source_revision: str, operation: str = "read"
    ) -> dict[str, Any]:
        """Revalidate current source/asset/task/principal read or export rights; return metadata without text."""
        return await self._call(
            "get_context_source_metadata",
            {"sourceRef": {"id": source_id, "revision": source_revision}, "operation": operation},
        )

    async def examine_ownership(self, task_id: str, task_revision: str) -> dict[str, Any]:
        """Reconcile supplied title and depth-scoped operating holdings under explicit share bases."""
        return await self._call(
            "examine_ownership", {"taskRef": {"id": task_id, "revision": task_revision}}
        )

    async def trace_chain_of_title(self, task_id: str, task_revision: str) -> dict[str, Any]:
        """Trace the supplied instrument inventory; retain missing and conflicting records."""
        return await self._call(
            "trace_chain_of_title", {"taskRef": {"id": task_id, "revision": task_revision}}
        )

    async def check_burdens(self, task_id: str, task_revision: str) -> dict[str, Any]:
        """Calculate exact supplied royalty/ORRI burdens with WI-versus-whole bases; missing is not zero."""
        return await self._call(
            "check_burdens", {"taskRef": {"id": task_id, "revision": task_revision}}
        )

    async def analyze_lease(self, task_id: str, task_revision: str) -> dict[str, Any]:
        """Read supplied term dates and holding status without inferring legal lease validity."""
        return await self._call(
            "analyze_lease", {"taskRef": {"id": task_id, "revision": task_revision}}
        )

    async def draft_title_packet(
        self, task_id: str, task_revision: str, proposal_json: str, work_revision: str = "r1"
    ) -> dict[str, Any]:
        """Validate your proposed packet JSON {version,title,observations}. Each observation has observationRef,questionId,kind,statement,citations from quote lookup. Return canonical unreviewed work/title; no title clearance."""
        return await self._call(
            "draft_title_packet",
            {
                "taskRef": {"id": task_id, "revision": task_revision},
                "proposal": _json(proposal_json, dict),
                "revision": work_revision,
            },
        )

    async def prepare_title_review(
        self, candidate_json: str, expected_head: str | None = None
    ) -> dict[str, Any]:
        """Bind exact work/title/evaluations JSON to current host-owned context and a separate human review checkpoint."""
        candidate = _json(candidate_json, dict)
        if self._context_provider is not None:
            try:
                work, packet = candidate["work"], candidate["title"]
                arguments = {
                    "taskRef": {"id": work["scope"]["taskId"], "revision": work["taskRevision"]},
                    "proposal": {key: packet[key] for key in ("version", "title", "observations")},
                    "revision": work["artifact"]["revision"],
                }
            except (KeyError, TypeError):
                raise MCPClientError("invalid_arguments", "user_action") from None
            fresh = await self._call("draft_title_packet", arguments)
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
                    for key in ("work", "title")
                )
            ):
                raise MCPClientError("source_fidelity_mismatch", "user_action")
            context = await self._context_provider(work)
            if "context" in candidate and json.dumps(
                candidate["context"], sort_keys=True, allow_nan=False
            ) != json.dumps(context, sort_keys=True, allow_nan=False):
                raise MCPClientError("context_binding_mismatch", "user_action")
            candidate["context"] = context
        result = await self._call(
            "prepare_title_review", {"candidate": candidate, "expectedHead": expected_head}
        )
        if self._record_review is not None and not result.get("isError"):
            payload = result.get("structuredContent", {})
            if not isinstance(payload, dict) or payload.get("success") is not True:
                raise MCPClientError("invalid_review_checkpoint", "user_action")
            await self._record_review(payload.get("analysis"))
        return result

    async def title_review_status(self, review_id: str | None = None) -> dict[str, Any]:
        """Read current scoped review state after restart, revision, rejection or approval."""
        return await self._call("title_review_status", {"reviewId": review_id} if review_id else {})

    async def record_title_packet(
        self, review_id: str, packet_digest: str, grant_id: str
    ) -> dict[str, Any]:
        """Record the exact human-approved private title packet; no clearance, legal opinion, curative, filing, transfer, lease or capital authority."""
        return await self._call(
            "record_title_packet",
            {"reviewId": review_id, "packetDigest": packet_digest, "grantId": grant_id},
        )
