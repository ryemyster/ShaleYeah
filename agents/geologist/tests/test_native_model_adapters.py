"""Execute the maintained native ADK adapters against offline HTTP transports."""

import asyncio
import json
import logging
from secrets import token_urlsafe

import httpx
import httpx2
import pytest
from google.genai import types
from test_model_provider import configuration, request

from app.model_provider import ConfiguredModel, ModelProviderError, native_adapter


@pytest.mark.asyncio
@pytest.mark.parametrize("provider", ["gemini", "anthropic"])
async def test_native_tool_calls_preserve_vendor_model_key_limits_and_metadata(provider):
    key = token_urlsafe(32)
    calls = []
    package = httpx if provider == "gemini" else httpx2

    async def respond(value):
        assert value.headers["x-goog-api-key" if provider == "gemini" else "x-api-key"] == key
        body = json.loads(value.content)
        calls.append((str(value.url), body))
        if provider == "gemini":
            payload = {"candidates": [{"content": {"role": "model", "parts": [{"functionCall": {"name": "assess_geowiz_quality", "args": {"file_path": "fixture.las"}}}]}, "finishReason": "STOP"}], "modelVersion": "fixture-native-001"}
        else:
            payload = {"id": "fixture", "type": "message", "role": "assistant", "model": "fixture-native-001", "content": [{"type": "tool_use", "id": "fixture-call", "name": "assess_geowiz_quality", "input": {"file_path": "fixture.las"}}], "stop_reason": "tool_use", "usage": {"input_tokens": 12, "output_tokens": 16}}
        return package.Response(200, json=payload)

    settings = configuration(provider).agent
    settings["limits"]["timeoutMs"] = 30_000
    model = ConfiguredModel(settings,
        resolve_credential=lambda *_: asyncio.sleep(0, result=key),
        adapter_factory=lambda settings, secret: native_adapter(settings, secret, transport=package.MockTransport(respond)))
    value = request()
    value.config.tools = [types.Tool(function_declarations=[types.FunctionDeclaration(name="assess_geowiz_quality", description="Fixture", parameters=types.Schema(type="OBJECT", properties={"file_path": types.Schema(type="STRING")}, required=["file_path"]))])]
    result = [item async for item in model.generate_content_async(value)]
    assert len(calls) == 1
    assert result[0].content.parts[0].function_call.name == "assess_geowiz_quality"
    assert result[0].custom_metadata["modelBinding"]["provider"] == provider
    assert result[0].custom_metadata["modelBinding"]["reportedModelRevision"] == "fixture-native-001"
    assert key not in result[0].model_dump_json()
    if provider == "gemini":
        assert "gemini-fixture-001:generateContent" in calls[0][0]
        assert calls[0][1]["generationConfig"]["maxOutputTokens"] == 256
    else:
        assert calls[0][1]["model"] == "claude-fixture-001"
        assert calls[0][1]["max_tokens"] == 256
    assert calls[0][1]["tools"]


@pytest.mark.asyncio
async def test_owned_native_client_timeout_is_safe_and_does_not_replay():
    closed = []

    class Adapter:
        async def generate_content_async(self, *_args, **_kwargs):
            await asyncio.sleep(10)
            yield

        async def aclose(self):
            closed.append(True)

    settings = configuration().agent
    settings["limits"]["timeoutMs"] = 10
    model = ConfiguredModel(settings, resolve_credential=lambda *_: asyncio.sleep(0, result=token_urlsafe(32)), adapter_factory=lambda *_: Adapter())
    with pytest.raises(ModelProviderError, match="timeout"):
        _ = [item async for item in model.generate_content_async(request())]
    assert closed == [True]


@pytest.mark.asyncio
async def test_native_reflection_cannot_escape_through_debug_logs(caplog):
    key = token_urlsafe(32)

    async def respond(_request):
        return httpx.Response(200, json={"candidates": [{"content": {"role": "model", "parts": [{"text": key}]}, "finishReason": "STOP"}]})

    settings = configuration().agent
    settings["limits"]["timeoutMs"] = 30_000
    model = ConfiguredModel(settings, resolve_credential=lambda *_: asyncio.sleep(0, result=key), adapter_factory=lambda value, secret: native_adapter(value, secret, transport=httpx.MockTransport(respond)))
    with caplog.at_level(logging.DEBUG), pytest.raises(ModelProviderError, match="reflection"):
        _ = [item async for item in model.generate_content_async(request())]
    assert key not in caplog.text
