"""Role-owned review context callbacks around the installed native employee runtime."""

import copy

from google.adk.models import LlmRequest
from google.genai import types
from shaleyeah_contracts import validate_contract
from shaleyeah_employee.context import ContextError
from shaleyeah_employee.models import resolve_file_credential
from shaleyeah_employee.native import EmployeeRuntime

from app.agent import create_economist_agent
from app.econobot_mcp import backend_config as configured_backend


class EconomistRuntime(EmployeeRuntime):
    async def after_tool(self, tool, args, tool_context, tool_response):
        """Retain all source identities from a successful role call through the catalog guard."""
        if not isinstance(tool_response, dict) or tool_response.get("isError"):
            return
        payload = tool_response.get("structuredContent", {})
        if not isinstance(payload, dict) or payload.get("success") is not True:
            return
        analysis = payload.get("analysis", {})
        sources = analysis.get("sourceArtifacts") if isinstance(analysis, dict) else None
        if sources is None:
            return await super().after_tool(tool, args, tool_context, tool_response)
        if not isinstance(sources, list) or len(sources) > 16:
            raise ContextError("source_limit")
        identities = []
        for source in sources:
            if not isinstance(source, dict) or not isinstance(source.get("artifact"), dict):
                raise ContextError("invalid_contract")
            identities.append((source["artifact"]["id"], source["artifact"]["revision"]))
        if len(set(identities)) != len(identities):
            raise ContextError("source_binding_mismatch")
        for source in sources:
            await self.catalog.put_source(
                source, expected=self.catalog._head(source["artifact"]["id"])
            )

    async def record_review(self, receipt):
        """Retain an exact pending review reference without persisting a human approval grant."""
        if (
            not isinstance(receipt, dict)
            or receipt.get("state") != "awaiting-review"
            or receipt.get("grantId")
        ):
            raise ContextError("invalid_review_checkpoint")
        checkpoint = await self.catalog.current_checkpoint()
        await self.catalog.checkpoint(
            work_refs=checkpoint["workRefs"],
            pending_review_refs=[{"id": receipt["reviewId"], "revision": "r1"}],
            questions=checkpoint["questions"],
            conflicts=checkpoint["conflicts"],
        )

    async def review_context(self, work):
        """Capture current permitted source and scenario selection for the exact human review."""
        validate_contract(work, {"expectedScope": self.catalog.scope})
        if work["status"] != "ready_for_review" or work["review"] != {
            "status": "unreviewed",
            "decisionRefs": [],
        }:
            raise ContextError("invalid_draft")
        checkpoint = await self.catalog.current_checkpoint()
        if checkpoint["conflicts"]:
            raise ContextError("unresolved_conflict")
        await self.catalog.put_work(work, expected=self.catalog._head(work["artifact"]["id"]))
        await self.catalog.checkpoint(
            work_refs=[work["artifact"]],
            pending_review_refs=checkpoint["pendingReviewRefs"],
            questions=checkpoint["questions"],
            conflicts=[],
        )
        request = LlmRequest(
            model=self.config.agent["model"],
            contents=[
                types.Content(
                    role="user",
                    parts=[
                        types.Part(text="Prepare exact private financial scenario review context")
                    ],
                )
            ],
        )
        packet = await self.catalog.assemble(self.model.prepare_request(request), self._count)
        if packet["status"] != "ready":
            raise ContextError("context_blocked")
        await self.catalog.record_selection(packet)
        await self.catalog.authorize_packet(packet)
        return copy.deepcopy(packet["manifest"])

    @classmethod
    async def open(
        cls,
        catalog,
        config,
        *,
        backend_config=None,
        resolve_credential=resolve_file_credential,
        adapter_factory=None,
        events=None,
    ):
        backend = backend_config or configured_backend()
        return await super().open(
            catalog,
            config,
            agent_factory=create_economist_agent,
            app_prefix="economist",
            backend_config=backend,
            credential_guard=backend.credential,
            resolve_credential=resolve_credential,
            adapter_factory=adapter_factory,
            events=events,
        )
