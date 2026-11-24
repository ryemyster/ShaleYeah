"""Geologist factory for the shared native employee runtime."""

from shaleyeah_employee.native import EmployeeRuntime, ScopedSessions

from app.agent import create_geologist_agent
from app.geowiz_mcp import _backend_config, _missing_credential
from app.model_provider import resolve_file_credential


class GeologistRuntime(EmployeeRuntime):
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
        backend = backend_config or _backend_config()
        return await super().open(
            catalog,
            config,
            agent_factory=create_geologist_agent,
            app_prefix="geologist",
            backend_config=backend,
            credential_guard=None
            if backend.credential is _missing_credential
            else backend.credential,
            resolve_credential=resolve_credential,
            adapter_factory=adapter_factory,
            events=events,
        )


__all__ = ["GeologistRuntime", "ScopedSessions"]
