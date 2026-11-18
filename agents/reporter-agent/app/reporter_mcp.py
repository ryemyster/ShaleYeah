"""Role tools use the installable MCP client; configured credentials are never tool arguments."""

import json
import os
from pathlib import Path
from typing import Any

from shaleyeah_mcp import FileBearerCredential, MCPClientConfig, MCPClientError, call_tool


async def missing_credential():
    raise MCPClientError("authentication_required", "auth_required")


def backend_config():
    reference = os.getenv("REPORTER_MCP_ACCESS_TOKEN_FILE")
    return MCPClientConfig(
        endpoint=os.getenv("REPORTER_MCP_URL", "http://127.0.0.1:3009/mcp"),
        credential=FileBearerCredential(Path(reference)) if reference else missing_credential,
        allow_loopback_http=True,
    )


class ReporterTools:
    def __init__(self, backend, *, expected_profile=None, events=None):
        self.backend, self.expected_profile, self.events = backend, expected_profile, events

    def reporter_backend_status(self):
        return {
            "backend": "reporter",
            "url": self.backend.endpoint,
            "independentBackend": True,
            "architectureMode": "stand-alone-with-progressive-disclosure-skills",
            "supervisionMode": "deterministic-business-state-adapter",
            "reviewBoundary": {
                "privateDrafts": "current-source-grants-required",
                "publication": "exact-qualified-human-review-required",
                "externalSend": "unsupported",
            },
        }

    async def _call(self, name, arguments):
        options = {"events": self.events} if self.events is not None else {}
        return await call_tool(self.backend, name, arguments, **options)

    async def read_reviewed_source(self, source_id: str) -> dict[str, Any]:
        """Read a currently permitted reviewed business artifact by reference; no arbitrary paths."""
        return await self._call("get_reviewed_source", {"sourceId": source_id})

    async def draft_report(
        self,
        source_ids: list[str],
        audience: str,
        purpose: str,
        template_id: str,
        disclosures: list[str],
    ) -> dict[str, Any]:
        """Assemble the permitted exact sources using the operator's audience/template/disclosures."""
        return await self._call(
            "draft_report",
            {
                "sourceIds": source_ids,
                "requirements": {
                    "audience": audience,
                    "purpose": purpose,
                    "templateId": template_id,
                    "disclosures": disclosures,
                },
            },
        )

    async def synthesize_report(self, source_ids: list[str]) -> dict[str, Any]:
        """Optional configured prose draft, requiring the exact independently owned synthesis profile."""
        if self.expected_profile is None:
            raise MCPClientError("invalid_configuration", "user_action")
        result = await self._call("get_model_profile", {})
        payload = result.get("structuredContent") or {}
        if (
            result.get("isError")
            or payload.get("success") is not True
            or payload.get("analysis") != self.expected_profile
        ):
            raise MCPClientError("model_binding_mismatch", "user_action")
        return await self._call("synthesize_report", {"sourceIds": source_ids})

    async def prepare_report_review(
        self, candidate_json: str, expected_head: str | None = None
    ) -> dict[str, Any]:
        """Pause on the backend's exact draft/context/eval revision; cannot decide the review."""
        try:
            if len(candidate_json.encode()) > 8_000_000:
                raise ValueError

            def pairs(items):
                result = {}
                for key, value in items:
                    if key in result:
                        raise ValueError
                    result[key] = value
                return result

            def constant(value):
                raise ValueError

            candidate = json.loads(candidate_json, object_pairs_hook=pairs, parse_constant=constant)
            if type(candidate) is not dict:
                raise ValueError
        except (ValueError, TypeError):
            raise MCPClientError("invalid_arguments", "user_action") from None
        return await self._call(
            "prepare_review", {"candidate": candidate, "expectedHead": expected_head}
        )

    async def report_review_status(self, review_id: str | None = None) -> dict[str, Any]:
        """Get the role-local checkpoint after edits, operator review or a restart."""
        return await self._call("get_review_status", {"reviewId": review_id} if review_id else {})

    async def release_report(
        self, review_id: str, packet_digest: str, grant_id: str
    ) -> dict[str, Any]:
        """Store the exact qualified human-approved publication packet in the configured private destination."""
        return await self._call(
            "release_report",
            {"reviewId": review_id, "packetDigest": packet_digest, "grantId": grant_id},
        )
