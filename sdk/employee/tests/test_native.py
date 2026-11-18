"""An independent role factory uses native state without another employee brain."""

import json
from secrets import token_urlsafe

import httpx
import pytest
from google.adk.agents import Agent
from shaleyeah_mcp import MCPClientConfig
from test_models import configuration
from test_restore import opened, seeded

from shaleyeah_employee.models import (
    ConfiguredModel,
    begin_model_budget,
    native_adapter,
    parse_reference_config,
)
from shaleyeah_employee.native import EmployeeRuntime


@pytest.mark.asyncio
async def test_native_role_factory_restores_session_without_remote_tool_credential(tmp_path):
    catalog, authority, _ = await seeded(tmp_path / "context")
    secret, token = token_urlsafe(32), token_urlsafe(32)
    requests = []
    resolutions = []
    factory_calls = []

    async def resolve(owner, reference, purpose):
        resolutions.append(purpose)
        assert purpose == "agent", "The remote synthesis/judge key is not in the employee"
        return secret

    async def credential():
        return token

    async def respond(request):
        assert request.headers["x-goog-api-key"] == secret
        payload = json.loads(request.content)
        requests.append(payload)
        if "countTokens" in str(request.url):
            response = {"totalTokens": 400}
        else:
            response = {
                "candidates": [
                    {
                        "content": {"role": "model", "parts": [{"text": "Fixture draft"}]},
                        "finishReason": "STOP",
                    }
                ]
            }
        return httpx.Response(200, json=response)

    def role_factory(
        config, *, backend_config, resolve_credential, adapter_factory, events, context_hooks
    ):
        factory_calls.append(backend_config.endpoint)
        return Agent(
            name="reporter",
            model=ConfiguredModel(
                config.agent,
                resolve_credential=resolve_credential,
                adapter_factory=adapter_factory,
                request_guard=context_hooks.before_dispatch,
            ),
            instruction="Keep source observations and human review distinct",
            before_agent_callback=begin_model_budget,
            before_model_callback=context_hooks.before_model,
            after_tool_callback=context_hooks.after_tool,
            include_contents="none",
        )

    backend = MCPClientConfig(endpoint="https://fixture.invalid/mcp", credential=credential)
    options = {
        "agent_factory": role_factory,
        "app_prefix": "reporter",
        "backend_config": backend,
        "credential_guard": credential,
        "resolve_credential": resolve,
        "adapter_factory": lambda profile, key: native_adapter(
            profile, key, transport=httpx.MockTransport(respond)
        ),
    }
    models = parse_reference_config(configuration())
    runtime = await EmployeeRuntime.open(catalog, models, **options)
    assert runtime.app_name.startswith("reporter_")
    result = await runtime.run("First private draft")
    assert result["status"] == "ready", result.get("code")
    first = await runtime.sessions.get_session(
        app_name=runtime.app_name, user_id=runtime.user_id, session_id=runtime.session_id
    )
    assert len(first.events) >= 2
    await runtime.close()

    catalog = await opened(tmp_path / "context", authority)
    runtime = await EmployeeRuntime.open(catalog, models, **options)
    try:
        restored = await runtime.sessions.get_session(
            app_name=runtime.app_name, user_id=runtime.user_id, session_id=runtime.session_id
        )
        assert len(restored.events) == len(first.events)
        result = await runtime.run("Continue after restart")
        assert result["status"] == "ready"
        assert "First private draft" not in json.dumps(requests[-1])
        assert set(resolutions) == {"agent"}
        assert factory_calls == [backend.endpoint, backend.endpoint]
        assert secret not in str(result["context"])
    finally:
        await runtime.close()


@pytest.mark.asyncio
@pytest.mark.parametrize("missing", ["context", "history", "dispatch"])
async def test_incomplete_role_factory_fails_before_model_or_credential_access(tmp_path, missing):
    catalog, _, _ = await seeded(tmp_path / "context")

    async def forbidden(*_):
        raise AssertionError("An invalid factory must not contact a model or read a credential")

    def unsafe(config, *, context_hooks, **kwargs):
        return Agent(
            name="reporter",
            include_contents="default" if missing == "history" else "none",
            model=ConfiguredModel(
                config.agent,
                resolve_credential=forbidden,
                request_guard=None if missing == "dispatch" else context_hooks.before_dispatch,
            ),
            before_model_callback=None if missing == "context" else context_hooks.before_model,
            after_tool_callback=context_hooks.after_tool,
        )

    from shaleyeah_employee.context import ContextError

    try:
        with pytest.raises(ContextError, match="invalid_context_factory"):
            await EmployeeRuntime.open(
                catalog,
                parse_reference_config(configuration()),
                agent_factory=unsafe,
                app_prefix="reporter",
                backend_config=MCPClientConfig(
                    endpoint="https://fixture.invalid/mcp", credential=forbidden
                ),
                credential_guard=forbidden,
                resolve_credential=forbidden,
            )
    finally:
        await catalog.close()
