import copy

from google.adk.models import LlmRequest
from google.genai import types
from shaleyeah_contracts import validate_contract
from shaleyeah_employee.context import ContextError
from shaleyeah_employee.models import resolve_file_credential
from shaleyeah_employee.native import EmployeeRuntime

from app.agent import create_qa_agent
from app.qa_mcp import backend_config as configured_backend


class QARuntime(EmployeeRuntime):
    async def record_review(self, receipt):
        """Retain the backend's exact pending review identity without storing an approval grant."""
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
        """Capture current host-owned evidence/work selection for the exact proposed disposition."""
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
                    parts=[types.Part(text="Prepare exact private QA disposition context")],
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
            agent_factory=create_qa_agent,
            app_prefix="qa",
            backend_config=backend,
            credential_guard=backend.credential,
            resolve_credential=resolve_credential,
            adapter_factory=adapter_factory,
            events=events,
        )
