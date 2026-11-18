from shaleyeah_employee.models import resolve_file_credential
from shaleyeah_employee.native import EmployeeRuntime

from app.agent import create_reporter_agent
from app.reporter_mcp import backend_config as configured_backend


class ReporterRuntime(EmployeeRuntime):
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
            agent_factory=create_reporter_agent,
            app_prefix="reporter",
            backend_config=backend,
            credential_guard=backend.credential,
            resolve_credential=resolve_credential,
            adapter_factory=adapter_factory,
            events=events,
        )
