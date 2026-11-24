"""Deterministic profile/adapter contracts, not assertions of real model quality."""

import asyncio
from secrets import token_urlsafe

import pytest
from google.adk.models.llm_request import LlmRequest
from google.adk.models.llm_response import LlmResponse
from google.genai import types

from app.model_provider import ConfiguredModel, ModelProviderError, parse_reference_config


def profile(provider="gemini", purpose="agent"):
    return {
        "version": "0.1.0", "id": f"geologist-{purpose}", "revision": "fixture-r1",
        "purpose": purpose, "owner": {"customerId": "fixture", "employeeId": "geologist"},
        "provider": provider,
        "model": "gemini-fixture-001" if provider == "gemini" else "claude-fixture-001",
        "modelRevision": "fixture-001",
        "endpoint": "https://generativelanguage.googleapis.com" if provider == "gemini" else "https://api.anthropic.com",
        "credentialRef": f"secret:fixture/geologist/{purpose}",
        "capabilities": {"toolUse": True, "structuredOutput": provider == "gemini" or purpose == "synthesis"},
        "limits": {"timeoutMs": 1000, "maxAttempts": 1, "maxOutputTokens": 256, "maxRequests": 2, "maxInputChars": 4096},
    }


def configuration(provider="gemini"):
    return parse_reference_config({
        "version": "0.1.0", "agent": profile(provider),
        "synthesis": profile(provider, "synthesis"), "judge": profile("gemini", "judge"),
    })


def request():
    return LlmRequest(contents=[types.Content(role="user", parts=[types.Part(text="Fixture input")])])


@pytest.mark.parametrize("provider", ["gemini", "anthropic"])
@pytest.mark.asyncio
async def test_selected_native_adapter_uses_private_key_and_explicit_model(provider):
    key = token_urlsafe(32)
    calls = []

    async def credential(owner, reference, purpose):
        assert owner == {"customerId": "fixture", "employeeId": "geologist"}
        assert reference.endswith("/agent") and purpose == "agent"
        return key

    class Adapter:
        async def generate_content_async(self, llm_request, stream=False):
            assert llm_request.model == profile(provider)["model"]
            assert llm_request.config.max_output_tokens == 256
            yield LlmResponse(content=types.Content(role="model", parts=[types.Part(text="Controlled fixture")]))

    def adapter_factory(settings, secret):
        calls.append((settings["provider"], secret))
        return Adapter()

    model = ConfiguredModel(configuration(provider).agent, resolve_credential=credential, adapter_factory=adapter_factory)
    results = [item async for item in model.generate_content_async(request())]
    assert len(results) == 1
    assert calls == [(provider, key)]
    assert key not in repr(model) and key not in model.model_dump_json()
    assert "secret:" not in model.model_dump_json()


@pytest.mark.parametrize("changes", [
    {"model": "gemini-flash-latest"}, {"provider": "unsupported"},
    {"endpoint": "http://remote.example"}, {"endpoint": "https://user:secret@example.test"},
    {"credentialRef": "inline-provider-key"}, {"apiKey": "untrusted-inline-value"},
    {"limits": {**profile()["limits"], "maxAttempts": 9}},
])
def test_invalid_profile_fails_without_exposing_configuration(changes):
    with pytest.raises(ModelProviderError):
        parse_reference_config({"version": "0.1.0", "agent": {**profile(), **changes}, "synthesis": profile(purpose="synthesis"), "judge": None})


def test_production_provider_mismatch_and_shared_judge_key_reference_are_rejected():
    with pytest.raises(ModelProviderError, match=r"configuration|provider"):
        parse_reference_config({"version": "0.1.0", "agent": profile(), "synthesis": profile("anthropic", "synthesis"), "judge": None})
    judge = {**profile(purpose="judge"), "credentialRef": profile()["credentialRef"]}
    with pytest.raises(ModelProviderError, match=r"configuration|judge"):
        parse_reference_config({"version": "0.1.0", "agent": profile(), "synthesis": profile(purpose="synthesis"), "judge": judge})


@pytest.mark.asyncio
@pytest.mark.parametrize("provider, reflected, missing, structured", [("gemini", False, True, False), ("gemini", True, False, False), ("anthropic", False, False, True)])
async def test_missing_key_reflection_and_unsupported_structured_output_fail_closed(provider, reflected, missing, structured):
    key = token_urlsafe(32)
    calls = []

    async def credential(*_):
        if missing:
            raise RuntimeError(f"unsafe remote error {key}")
        return key

    class Adapter:
        async def generate_content_async(self, llm_request, stream=False):
            calls.append(llm_request)
            yield LlmResponse(content=types.Content(role="model", parts=[types.Part(text=key if reflected else "fixture")]))

    model = ConfiguredModel(configuration(provider).agent, resolve_credential=credential, adapter_factory=lambda *_: Adapter())
    value = request()
    if structured:
        value.config.response_schema = {"type": "object"}
    with pytest.raises(ModelProviderError) as error:
        _ = [item async for item in model.generate_content_async(value)]
    assert key not in str(error.value)
    if missing or structured:
        assert not calls


@pytest.mark.asyncio
async def test_cancellation_closes_adapter_without_replaying_or_substitution():
    started = asyncio.Event()
    closed = []

    class Adapter:
        async def generate_content_async(self, llm_request, stream=False):
            started.set()
            try:
                await asyncio.sleep(10)
                yield LlmResponse()
            finally:
                closed.append(True)

    model = ConfiguredModel(configuration().agent, resolve_credential=lambda *_: asyncio.sleep(0, result=token_urlsafe(32)), adapter_factory=lambda *_: Adapter())

    async def invoke():
        return [item async for item in model.generate_content_async(request())]

    task = asyncio.create_task(invoke())
    await asyncio.wait_for(started.wait(), timeout=1)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert closed == [True]
