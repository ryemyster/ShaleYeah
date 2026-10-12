"""Bounded business-state adapter around ADK; the backend owns review and execution."""
from __future__ import annotations

from typing import Any

from shaleyeah_mcp import MCPClientConfig, MCPClientError, call_tool


class ReviewSupervisor:
    """Resume exactly one protected local save from its durable backend checkpoint.

    A trusted host constructs this with its employee MCP credential. Human decisions
    use Geowiz's separately authenticated operator API, never this agent interface.
    No native confirmation boolean, model prose or client-supplied scope grants access.
    """

    def __init__(self, backend: MCPClientConfig, *, client=call_tool):
        self.backend = backend
        self.client = client

    async def _call(self, name: str, arguments: dict[str, Any]):
        result = await self.client(self.backend, name, arguments)
        payload = result.get("structuredContent") or {}
        if result.get("isError") or payload.get("success") is not True or type(payload.get("analysis")) is not dict:
            raise MCPClientError("review_blocked", "user_action")
        return payload["analysis"]

    async def prepare(self, candidate: dict[str, Any], *, expected_head: str | None):
        """Submit exact draft/context/eval/action snapshots; backend verifies the evidence."""
        receipt = await self._call("prepare_review", {"candidate": candidate, "expectedHead": expected_head})
        if receipt.get("state") != "awaiting-review" or receipt.get("grantId"):
            raise MCPClientError("invalid_review_checkpoint", "user_action")
        return receipt

    async def checkpoint(self, review_id: str | None = None):
        """Read the current scoped checkpoint, including revised/rejected outcomes."""
        receipt = await self._call("get_review_status", {"reviewId": review_id} if review_id else {})
        if (review_id is not None and receipt.get("reviewId") != review_id) or receipt.get("state") not in (
            "awaiting-review", "changes-requested", "approved", "completed", "rejected",
        ):
            raise MCPClientError("invalid_review_checkpoint", "user_action")
        return receipt

    async def resume(self, review_id: str):
        """Revalidate at Geowiz and execute only the bound reviewed operation once."""
        receipt = await self.checkpoint(review_id)
        if receipt["state"] != "approved":
            return receipt
        if type(receipt.get("grantId")) is not str or type(receipt.get("packetDigest")) is not str:
            raise MCPClientError("invalid_review_checkpoint", "user_action")
        result = await self._call("save_finding", {key: receipt[key] for key in ("reviewId", "packetDigest", "grantId")})
        if result.get("stored") is not True:
            raise MCPClientError("review_blocked", "user_action")
        return {**receipt, "state": "completed", "outcome": result}
