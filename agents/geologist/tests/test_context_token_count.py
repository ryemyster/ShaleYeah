"""Count/generation wire parity uses real pinned adapters and offline transports."""

import asyncio
import json
from secrets import token_urlsafe

import httpx
import httpx2
import pytest
from google.genai import types
from test_model_provider import configuration, request

from app.model_provider import ConfiguredModel, ModelProviderError, native_adapter


@pytest.mark.asyncio
@pytest.mark.parametrize("provider", ["gemini", "anthropic"])
async def test_counter_contains_exact_generation_prompt_system_and_tools(provider):
    key = token_urlsafe(32)
    package = httpx if provider == "gemini" else httpx2
    calls = []

    async def respond(value):
        assert value.headers["x-goog-api-key" if provider == "gemini" else "x-api-key"] == key
        body = json.loads(value.content)
        calls.append((str(value.url), body))
        if "countTokens" in str(value.url) or "count_tokens" in str(value.url):
            result = {"totalTokens": 123} if provider == "gemini" else {"input_tokens": 123}
        elif provider == "gemini":
            result = {
                "candidates": [
                    {
                        "content": {"role": "model", "parts": [{"text": "Fixture"}]},
                        "finishReason": "STOP",
                    }
                ]
            }
        else:
            result = {
                "id": "fixture",
                "type": "message",
                "role": "assistant",
                "model": "claude-fixture-001",
                "content": [{"type": "text", "text": "Fixture"}],
                "stop_reason": "end_turn",
                "usage": {"input_tokens": 123, "output_tokens": 1},
            }
        return package.Response(200, json=result)

    settings = configuration(provider).agent
    settings["limits"]["timeoutMs"] = 30_000
    model = ConfiguredModel(
        settings,
        resolve_credential=lambda *_: asyncio.sleep(0, result=key),
        adapter_factory=lambda profile, secret: native_adapter(
            profile, secret, transport=package.MockTransport(respond)
        ),
    )
    value = request()
    value.config.system_instruction = "Keep units and uncertainty"
    value.config.tools = [
        types.Tool(
            function_declarations=[
                types.FunctionDeclaration(
                    name="review",
                    description="A complete tool header",
                    parameters=types.Schema(
                        type="OBJECT", properties={"depth": types.Schema(type="NUMBER")}
                    ),
                )
            ]
        )
    ]
    receipt = await model.count_tokens(value)
    assert receipt["tokens"] == 123
    assert receipt["qualification"] == "provider-count"
    assert receipt["model"] == settings["model"]
    assert receipt["counter"]["version"]
    assert key not in json.dumps(receipt)
    _ = [item async for item in model.generate_content_async(value)]
    assert len(calls) == 2
    counted, generated = calls[0][1], calls[1][1]
    if provider == "gemini":
        assert "contents" not in counted
        counted = counted["generateContentRequest"]
        assert counted.pop("model") == "models/" + settings["model"]
        assert counted == generated
    else:
        for name in ["model", "messages", "system", "tools"]:
            assert counted[name] == generated[name]
        assert "max_tokens" not in counted


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", ["negative", "boolean", "outage", "reflection"])
async def test_bad_counter_receipts_fail_safely_and_close_owned_client(kind, caplog):
    key = token_urlsafe(32)
    closed = []

    class Adapter:
        async def count_tokens(self, _request):
            if kind == "outage":
                raise RuntimeError(key)
            return {"tokens": {"negative": -1, "boolean": True, "reflection": key}[kind]}

        async def aclose(self):
            closed.append(True)

    model = ConfiguredModel(
        configuration().agent,
        resolve_credential=lambda *_: asyncio.sleep(0, result=key),
        adapter_factory=lambda *_: Adapter(),
    )
    with pytest.raises(ModelProviderError):
        await model.count_tokens(request())
    assert closed == [True]
    assert key not in caplog.text
