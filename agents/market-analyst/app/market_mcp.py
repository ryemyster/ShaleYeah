"""Source-bound Market tools using the separately installed MCP client."""

import json
from typing import Any

from shaleyeah_mcp import MCPClientError, call_tool, load_mcp_config


def backend_config():
    return load_mcp_config("MARKET", "http://localhost:3007/mcp")


def _json(text):
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
        if type(value) is not dict:
            raise ValueError
        json.dumps(value, allow_nan=False)
        return value
    except (ValueError, TypeError, RecursionError):
        raise MCPClientError("invalid_arguments", "user_action") from None


class MarketAnalystTools:
    def __init__(self, backend, *, events=None, context_hooks=None):
        self.backend, self.events = backend, events

        async def context_for(work):
            return await context_hooks.review_context(work)

        async def record_review(receipt):
            await context_hooks.record_review(receipt)

        self._context_provider = context_for if context_hooks is not None else None
        self._record_review = record_review if context_hooks is not None else None

    def market_analyst_backend_status(self):
        return {
            "backend": "market",
            "url": self.backend.endpoint,
            "independentBackend": True,
            "architectureMode": "stand-alone-with-progressive-disclosure-skills",
            "supervisionMode": "deterministic-business-state-adapter",
            "reviewBoundary": {
                "inputs": "current-source-and-task-authority-required",
                "scenarioPacket": "exact-enrolled-human-review-required",
                "trading": "unsupported",
                "contracts": "unsupported",
                "bids": "unsupported",
                "capitalCommitment": "unsupported",
            },
        }

    async def _call(self, name, arguments):
        options = {"events": self.events} if self.events is not None else {}
        result = await call_tool(self.backend, name, arguments, **options)
        payload = result.get("structuredContent")
        if not result.get("isError") and type(payload) is dict and payload.get("success") is True:
            return {key: value for key, value in result.items() if key != "content"}
        return result

    async def analyze_market_conditions(
        self,
        region: str,
        commodity: str = "both",
        timeframe: str = "1year",
        factors: list[str] | None = None,
        match_threshold: float | None = None,
    ) -> dict[str, Any]:
        """Query dated public/host market observations and unreviewed interpretation; this creates no reviewed scenario packet."""
        arguments = {"commodity": commodity, "region": region, "timeframe": timeframe}
        if factors is not None:
            arguments["factors"] = factors
        if match_threshold is not None:
            arguments["matchThreshold"] = match_threshold
        return await self._call("analyze_market_conditions", arguments)

    async def competitive_market_analysis(
        self,
        competitors: list[str],
        market: str,
        metrics: list[str] | None = None,
        match_threshold: float | None = None,
    ) -> dict[str, Any]:
        """Query permitted competitor observations and explicit assumptions; names and model output cannot supply facts or authority."""
        arguments = {"competitors": competitors, "market": market}
        if metrics is not None:
            arguments["metrics"] = metrics
        if match_threshold is not None:
            arguments["matchThreshold"] = match_threshold
        return await self._call("competitive_analysis", arguments)

    async def read_market_inputs(self, task_id: str, task_revision: str) -> dict[str, Any]:
        """Discover authorized mandate, source revisions, series metadata and commercial scenario inventory."""
        return await self._call(
            "read_market_inputs", {"taskRef": {"id": task_id, "revision": task_revision}}
        )

    async def read_market_source(
        self, source_id: str, source_revision: str, offset: int = 0, max_chars: int = 16000
    ) -> dict[str, Any]:
        """Read a bounded exact JSON source page. Paging counts Unicode code points."""
        return await self._call(
            "read_market_source",
            {
                "sourceRef": {"id": source_id, "revision": source_revision},
                "offset": offset,
                "maxChars": max_chars,
            },
        )

    async def get_context_source_metadata(
        self, source_id: str, source_revision: str, operation: str = "read"
    ) -> dict[str, Any]:
        """Revalidate current source/asset/task/principal read/export rights without loading source text."""
        return await self._call(
            "get_context_source_metadata",
            {"sourceRef": {"id": source_id, "revision": source_revision}, "operation": operation},
        )

    async def calculate_market_scenarios(self, task_id: str, task_revision: str) -> dict[str, Any]:
        """Calculate actual period-aligned observations and operator scenarios without recording work or granting authority."""
        return await self._call(
            "calculate_market_scenarios", {"taskRef": {"id": task_id, "revision": task_revision}}
        )

    async def draft_market_scenario(
        self, task_id: str, task_revision: str, proposal_json: str, work_revision: str = "r1"
    ) -> dict[str, Any]:
        """Validate your proposal JSON {version,title,summary,evidenceSeriesIds,scenarioIds,limitations}; source arithmetic is backend-owned. Return canonical unreviewed work/market."""
        return await self._call(
            "draft_market_scenario",
            {
                "taskRef": {"id": task_id, "revision": task_revision},
                "proposal": _json(proposal_json),
                "revision": work_revision,
            },
        )

    async def prepare_market_review(
        self, candidate_json: str, expected_head: str | None = None
    ) -> dict[str, Any]:
        """Bind exact work/market/evaluations JSON to current host-owned context and separate commercial human review."""
        candidate = _json(candidate_json)
        if self._context_provider is not None:
            try:
                work, market = candidate["work"], candidate["market"]
                arguments = {
                    "taskRef": {"id": work["scope"]["taskId"], "revision": work["taskRevision"]},
                    "proposal": market["proposal"],
                    "revision": work["artifact"]["revision"],
                }
            except (KeyError, TypeError):
                raise MCPClientError("invalid_arguments", "user_action") from None
            fresh = await self._call("draft_market_scenario", arguments)
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
                    for key in ("work", "market")
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
            "prepare_market_review", {"candidate": candidate, "expectedHead": expected_head}
        )
        if self._record_review is not None and not result.get("isError"):
            payload = result.get("structuredContent", {})
            if not isinstance(payload, dict) or payload.get("success") is not True:
                raise MCPClientError("invalid_review_checkpoint", "user_action")
            await self._record_review(payload.get("analysis"))
        return result

    async def market_review_status(self, review_id: str | None = None) -> dict[str, Any]:
        """Read scoped review state after restart, changed revision, rejection or approval."""
        return await self._call(
            "market_review_status", {"reviewId": review_id} if review_id else {}
        )

    async def record_market_scenarios(
        self, review_id: str, packet_digest: str, grant_id: str
    ) -> dict[str, Any]:
        """Record an exact currently qualified human-approved private packet; no trade, contract, bid or capital authority."""
        return await self._call(
            "record_market_scenarios",
            {"reviewId": review_id, "packetDigest": packet_digest, "grantId": grant_id},
        )
