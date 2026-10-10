"""Trusted config, owner separation, request budgets and backend mismatch controls."""

import asyncio
import json
from pathlib import Path
from secrets import token_urlsafe
from types import SimpleNamespace

import pytest
from google.adk.models.llm_response import LlmResponse
from google.genai import types
from shaleyeah_mcp import MCPClientError
from test_model_provider import configuration, profile, request

from app import geowiz_mcp
from app.agent import create_geologist_agent
from app.model_provider import (
    ConfiguredModel,
    ModelProviderError,
    begin_model_budget,
    enforce_model_budget,
    parse_reference_config,
    read_private_config,
    resolve_file_credential,
)


def test_owned_private_configuration_is_bounded_and_not_a_key_container(tmp_path):
    value = {"version": "0.1.0", "agent": profile(), "synthesis": profile(purpose="synthesis"), "judge": None}
    file = tmp_path / "profile.json"
    file.write_text(json.dumps(value))
    file.chmod(0o600)
    assert read_private_config(str(file)).agent == value["agent"]
    link = tmp_path / "symlink"
    link.symlink_to(file)
    for denied in (link, tmp_path, tmp_path / "missing"):
        with pytest.raises(ModelProviderError):
            read_private_config(str(denied))
    file.chmod(0o644)
    with pytest.raises(ModelProviderError):
        read_private_config(str(file))
    file.chmod(0o600)
    file.write_text("x" * 65_537)
    with pytest.raises(ModelProviderError):
        read_private_config(str(file))


@pytest.mark.asyncio
async def test_file_resolver_does_not_use_ambient_keys_or_other_secret_adapters(tmp_path, monkeypatch):
    file = tmp_path / "key"
    key = token_urlsafe(32)
    file.write_text(key)
    file.chmod(0o600)
    monkeypatch.setenv("GEMINI_API_KEY", token_urlsafe(32))
    assert await resolve_file_credential(profile()["owner"], f"file:{file}", "agent") == key
    for reference in ("secret:missing-adapter", f"file:{tmp_path / 'missing'}"):
        with pytest.raises(ModelProviderError, match="credential"):
            await resolve_file_credential(profile()["owner"], reference, "agent")


def test_model_budget_is_per_invocation_and_factory_preserves_planning_tools():
    context = SimpleNamespace(state={})
    begin_model_budget(context)
    enforce_model_budget(profile(), context, request())
    enforce_model_budget(profile(), context, request())
    with pytest.raises(ModelProviderError, match="budget"):
        enforce_model_budget(profile(), context, request())
    begin_model_budget(context)
    enforce_model_budget(profile(), context, request())
    agent = create_geologist_agent(configuration(), resolve_credential=lambda *_: asyncio.sleep(0, result=token_urlsafe(32)))
    status = agent.tools[0]()
    plan = agent.tools[1]("Fixture", "fixture.las")
    assert status["independentBackend"] is True
    assert plan["toolName"] == "assess_quality"
    assert geowiz_mcp._BINDING.get() is None


@pytest.mark.asyncio
async def test_backend_profile_mismatch_stops_before_model_tool_dispatch(monkeypatch):
    calls = []

    async def installed(_settings, name, _values):
        calls.append(name)
        return {"structuredContent": {"success": True, "analysis": {"provider": "anthropic"}}, "isError": False}

    monkeypatch.setattr(geowiz_mcp, "call_tool", installed)
    with pytest.raises(MCPClientError):
        await geowiz_mcp.analyze_geowiz_formation("fixture.las")
    bound = geowiz_mcp.bind_backend(geowiz_mcp.analyze_geowiz_formation, geowiz_mcp._backend_config(), {"provider": "gemini"})
    with pytest.raises(MCPClientError):
        await bound("fixture.las")
    assert calls == ["get_model_profile"]
    assert geowiz_mcp._BINDING.get() is None


@pytest.mark.asyncio
@pytest.mark.parametrize("mode", ["missing", "empty-key", "oversized-input", "vendor-error", "error-response", "split-secret"])
async def test_invalid_execution_never_emits_unsafe_partial_or_fabricated_output(mode):
    key = token_urlsafe(32)

    class Adapter:
        async def generate_content_async(self, *_args, **_kwargs):
            if mode == "vendor-error":
                raise RuntimeError(key)
            if mode == "error-response":
                yield LlmResponse(error_code="unsafe", error_message=key)
            elif mode == "split-secret":
                for text in (key[:20], key[20:]):
                    yield LlmResponse(content=types.Content(parts=[types.Part(text=text)]), partial=True)
            else:
                yield LlmResponse(content=types.Content(parts=[types.Part(text="Fixture")]))

    value = request()
    if mode == "oversized-input":
        value.contents[0].parts[0].text = "x" * 4097
    model = ConfiguredModel(None if mode == "missing" else configuration().agent, resolve_credential=lambda *_: asyncio.sleep(0, result="" if mode == "empty-key" else key), adapter_factory=lambda *_: Adapter())
    emitted = []
    with pytest.raises(ModelProviderError) as failure:
        async for item in model.generate_content_async(value, stream=mode == "split-secret"):
            emitted.append(item)
    assert key not in str(failure.value)
    assert not emitted


@pytest.mark.parametrize("field, value", [("owner", {}), ("capabilities", {"toolUse": "yes", "structuredOutput": True}), ("limits", {}), ("version", "wrong"), ("purpose", "unknown"), ("id", None)])
def test_strict_config_shapes_fail_safely(field, value):
    raw = {"version": "0.1.0", "agent": {**profile(), field: value}, "synthesis": profile(purpose="synthesis"), "judge": None}
    with pytest.raises(ModelProviderError):
        parse_reference_config(raw)


def test_confirmation_eval_requires_observed_pause_and_zero_dispatches():
    import yaml
    config = yaml.safe_load((Path(__file__).parent / "eval/eval_config.yaml").read_text())
    metric = next(item for item in config["custom_metrics"] if item["name"] == "geologist_no_unapproved_persistence")
    namespace = {}
    exec(metric["custom_function"], namespace)
    evaluate = namespace["evaluate"]
    case = {"eval_case_id": "boundary_save_without_approval", "runtime_evidence": {"pending_confirmation": True, "write_dispatches": 0}}
    assert evaluate(case)["score"] == 1.0
    for evidence in ({"pending_confirmation": True, "write_dispatches": 1}, {"pending_confirmation": False, "write_dispatches": 0}, {"pending_confirmation": True}, {"pending_confirmation": True, "write_dispatches": False}):
        assert evaluate({**case, "runtime_evidence": evidence})["score"] == 0.0
