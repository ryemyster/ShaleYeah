"""Private, explicit native ADK model bindings. No environment-key fallback."""

from __future__ import annotations

import asyncio
import copy
import json
import logging
import os
import re
import stat
from collections.abc import AsyncGenerator, Callable
from contextlib import aclosing
from contextvars import ContextVar
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import httpx
from google.adk.models.base_llm import BaseLlm
from google.adk.models.llm_request import LlmRequest
from google.adk.models.llm_response import LlmResponse
from pydantic import PrivateAttr
from shaleyeah_mcp import FileBearerCredential

_ORIGINS = {"gemini": "https://generativelanguage.googleapis.com", "anthropic": "https://api.anthropic.com"}
_LIMITS = {"timeoutMs": 120_000, "maxAttempts": 3, "maxOutputTokens": 16_384, "maxRequests": 100, "maxInputChars": 262_144}
_IDENTIFIER = re.compile(r"^[A-Za-z0-9_.:/-]{1,128}$")
_SECRETS: ContextVar[tuple[str, ...]] = ContextVar("geologist_model_log_secrets", default=())


def _install_log_guard():
    """Native adapters log before yielding; scrub at record creation in this async scope."""
    previous = logging.getLogRecordFactory()
    if getattr(previous, "_geologist_scoped_guard", False):
        return

    def guarded(*args, **kwargs):
        record = previous(*args, **kwargs)
        secrets = _SECRETS.get()
        if secrets:
            message = "Model adapter debug detail suppressed" if record.levelno <= logging.DEBUG else record.getMessage()
            for secret in secrets:
                message = message.replace(secret, "[REDACTED]")
                if record.stack_info:
                    record.stack_info = record.stack_info.replace(secret, "[REDACTED]")
            record.msg, record.args = message, ()
            if record.exc_info:
                safe = ModelProviderError("Model operation failed; vendor detail suppressed")
                record.exc_info, record.exc_text = (ModelProviderError, safe, None), None
        return record

    guarded._geologist_scoped_guard = True
    logging.setLogRecordFactory(guarded)


class ModelProviderError(RuntimeError):
    """Safe errors exclude raw vendor causes and trusted secret references."""


def _exact(value: Any, keys: set[str]) -> None:
    if not isinstance(value, dict) or set(value) != keys:
        raise ModelProviderError("Invalid model provider configuration")


def parse_model_profile(value: Any) -> dict[str, Any]:
    try:
        _exact(value, {"version", "id", "revision", "purpose", "owner", "provider", "model", "modelRevision", "endpoint", "credentialRef", "capabilities", "limits"})
        if value["version"] != "0.1.0" or value["purpose"] not in {"agent", "synthesis", "judge"}:
            raise ValueError()
        for key in ("id", "revision", "model", "modelRevision"):
            if not isinstance(value[key], str) or not _IDENTIFIER.fullmatch(value[key]):
                raise ValueError()
        if "latest" in value["model"].lower() or value["endpoint"] != _ORIGINS[value["provider"]]:
            raise ValueError()
        _exact(value["owner"], {"customerId", "employeeId"})
        if any(not isinstance(item, str) or not _IDENTIFIER.fullmatch(item) for item in value["owner"].values()):
            raise ValueError()
        reference = value["credentialRef"]
        if not isinstance(reference, str) or len(reference) > 512 or not re.fullmatch(r"(?:secret|file):[^\s]+", reference):
            raise ValueError()
        _exact(value["capabilities"], {"toolUse", "structuredOutput"})
        if any(type(item) is not bool for item in value["capabilities"].values()):
            raise ValueError()
        _exact(value["limits"], set(_LIMITS))
        if any(type(value["limits"][key]) is not int or not 1 <= value["limits"][key] <= maximum for key, maximum in _LIMITS.items()):
            raise ValueError()
        return copy.deepcopy(value)
    except Exception:
        raise ModelProviderError("Invalid model provider configuration") from None


@dataclass(frozen=True)
class ReferenceConfig:
    agent: dict[str, Any] = field(repr=False)
    synthesis: dict[str, Any] = field(repr=False)
    judge: dict[str, Any] | None = field(repr=False)


def parse_reference_config(value: Any) -> ReferenceConfig:
    _exact(value, {"version", "agent", "synthesis", "judge"})
    if value["version"] != "0.1.0":
        raise ModelProviderError("Invalid model provider configuration")
    agent = parse_model_profile(value["agent"])
    synthesis = parse_model_profile(value["synthesis"])
    judge = parse_model_profile(value["judge"]) if value["judge"] is not None else None
    if agent["purpose"] != "agent" or synthesis["purpose"] != "synthesis" or agent["owner"] != synthesis["owner"] or agent["provider"] != synthesis["provider"]:
        raise ModelProviderError("Invalid production provider configuration")
    if not agent["capabilities"]["toolUse"] or not synthesis["capabilities"]["structuredOutput"]:
        raise ModelProviderError("Unsupported model capability")
    if judge and (judge["purpose"] != "judge" or judge["owner"] != agent["owner"] or judge["credentialRef"] in {agent["credentialRef"], synthesis["credentialRef"]}):
        raise ModelProviderError("Invalid independent judge configuration")
    return ReferenceConfig(agent, synthesis, judge)


def read_private_config(path: str) -> ReferenceConfig:
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
        try:
            info = os.fstat(fd)
            if not stat.S_ISREG(info.st_mode) or info.st_mode & 0o077 or info.st_uid != os.getuid():
                raise ValueError()
            with os.fdopen(fd, "rb", closefd=False) as source:
                data = source.read(65_537)
            if len(data) > 65_536:
                raise ValueError()
            return parse_reference_config(json.loads(data))
        finally:
            os.close(fd)
    except Exception:
        raise ModelProviderError("Invalid private model configuration") from None


async def resolve_file_credential(owner: dict[str, str], reference: str, purpose: str) -> str:
    # Owner and purpose are validated by the trusted profile; adapters for secret managers implement this same interface.
    if not owner or purpose not in {"agent", "synthesis", "judge"} or not reference.startswith("file:/"):
        raise ModelProviderError("Model credential unavailable")
    try:
        return await FileBearerCredential(Path(reference[5:]))()
    except Exception:
        raise ModelProviderError("Model credential unavailable") from None


def public_profile(profile: dict[str, Any]) -> dict[str, Any]:
    return {key: copy.deepcopy(value) for key, value in profile.items() if key != "credentialRef"}


class _NativeAdapter:
    def __init__(self, model: BaseLlm, close: Callable, observed: dict[str, str]):
        self.model = model
        self.close = close
        self.observed = observed

    async def generate_content_async(self, *args, **kwargs):
        async with aclosing(self.model.generate_content_async(*args, **kwargs)) as responses:
            async for response in responses:
                response.model_version = response.model_version or self.observed.get("model")
                yield response

    async def aclose(self):
        await self.close()


def native_adapter(profile: dict[str, Any], key: str, *, transport=None):
    """Use pinned native ADK adapters with owned, nonredirecting/no-proxy HTTP clients."""
    limits = profile["limits"]
    observed = {}

    async def observe(response):
        if "application/json" in response.headers.get("content-type", ""):
            await response.aread()
            try:
                body = response.json()
                value = body.get("modelVersion") or body.get("model")
                if isinstance(value, str):
                    observed["model"] = value
            except (ValueError, AttributeError):
                pass
    if profile["provider"] == "gemini":
        from google import genai
        from google.adk.models.google_llm import Gemini
        from google.genai import types

        client = genai.Client(api_key=key, vertexai=False, enterprise=False, http_options=types.HttpOptions(
            base_url=profile["endpoint"], api_version="v1beta", timeout=limits["timeoutMs"],
            retry_options=types.HttpRetryOptions(attempts=limits["maxAttempts"]),
            httpx_async_client=httpx.AsyncClient(trust_env=False, follow_redirects=False, transport=transport, event_hooks={"response": [observe]}),
        ))

        class BoundGemini(Gemini):
            _client: Any = PrivateAttr()

            @property
            def api_client(self):
                return self._client

        model = BoundGemini(model=profile["model"])
        model._client = client
        return _NativeAdapter(model, client.aio.aclose, observed)
    import httpx2
    from anthropic import AsyncAnthropic
    from google.adk.models.anthropic_llm import AnthropicLlm

    client = AsyncAnthropic(api_key=key, base_url=profile["endpoint"], timeout=limits["timeoutMs"] / 1000,
        max_retries=limits["maxAttempts"] - 1,
        http_client=httpx2.AsyncClient(trust_env=False, follow_redirects=False, transport=transport, event_hooks={"response": [observe]}))

    class BoundAnthropic(AnthropicLlm):
        _client: Any = PrivateAttr()

        @property
        def _anthropic_client(self):
            return self._client

    model = BoundAnthropic(model=profile["model"], max_tokens=limits["maxOutputTokens"])
    model._client = client
    return _NativeAdapter(model, client.close, observed)


class ConfiguredModel(BaseLlm):
    _profile: dict[str, Any] | None = PrivateAttr(default=None)
    _resolve: Any = PrivateAttr()
    _factory: Any = PrivateAttr()

    def __init__(self, profile=None, *, resolve_credential=resolve_file_credential, adapter_factory=native_adapter):
        parsed = parse_model_profile(profile) if profile is not None else None
        super().__init__(model=parsed["model"] if parsed else "unconfigured")
        self._profile, self._resolve, self._factory = parsed, resolve_credential, adapter_factory

    async def generate_content_async(self, llm_request: LlmRequest, stream=False) -> AsyncGenerator[LlmResponse]:
        if self._profile is None:
            raise ModelProviderError("Missing model provider configuration")
        profile, limits = self._profile, self._profile["limits"]
        capabilities = profile["capabilities"]
        if (llm_request.config.tools and not capabilities["toolUse"]) or ((llm_request.config.response_schema is not None or llm_request.config.response_json_schema is not None) and (not capabilities["structuredOutput"] or profile["provider"] == "anthropic")):
            raise ModelProviderError("Unsupported model capability")
        request = llm_request.model_copy(deep=True)
        request.model = profile["model"]
        request.config.max_output_tokens = limits["maxOutputTokens"]
        # Transport, caching and provider-specific overrides cannot replace this trusted binding.
        request.config.http_options = None
        request.config.cached_content = None
        request.cache_config = None
        request.cache_metadata = None
        serialized = request.model_dump_json(exclude_none=True)
        if len(serialized) > limits["maxInputChars"]:
            raise ModelProviderError("Model input budget exhausted")
        adapter = None
        log_token = None
        try:
            async with asyncio.timeout(limits["timeoutMs"] / 1000):
                try:
                    key = await self._resolve(copy.deepcopy(profile["owner"]), profile["credentialRef"], profile["purpose"])
                except Exception:
                    raise ModelProviderError("Model credential unavailable") from None
                if not isinstance(key, str) or not 8 <= len(key) <= 4096 or any(character.isspace() for character in key):
                    raise ModelProviderError("Model credential unavailable")
                if key in serialized or profile["credentialRef"] in serialized:
                    raise ModelProviderError("Secret in model input")
                _install_log_guard()
                log_token = _SECRETS.set((key, profile["credentialRef"]))
                adapter = self._factory(copy.deepcopy(profile), key)
                pending = []
                total = 0
                async with aclosing(adapter.generate_content_async(request, stream=stream)) as responses:
                    async for response in responses:
                        content = response.model_dump_json(exclude_none=True)
                        total += len(content)
                        if key in content or profile["credentialRef"] in content or total > limits["maxOutputTokens"] * 64:
                            raise ModelProviderError("Invalid model output or secret reflection")
                        if response.error_code or response.error_message:
                            raise ModelProviderError("Model provider unavailable")
                        response.custom_metadata = {"modelBinding": {**public_profile(profile), "adapterRevision": "google-adk@2.4.0", "clientRevision": "google-genai@2.11.0" if profile["provider"] == "gemini" else "anthropic@1.13.0", "reportedModelRevision": response.model_version}}
                        pending.append(response)
                text = "".join(part.text or "" for response in pending if response.content for part in response.content.parts)
                if key in text or profile["credentialRef"] in text:
                    raise ModelProviderError("Invalid model output or secret reflection")
                for response in pending:
                    yield response
        except TimeoutError:
            raise ModelProviderError("Model request timeout") from None
        except ModelProviderError:
            raise
        except Exception:
            raise ModelProviderError("Model provider unavailable") from None
        finally:
            try:
                if adapter and hasattr(adapter, "aclose"):
                    await adapter.aclose()
            except Exception:
                raise ModelProviderError("Model provider cleanup failed") from None
            finally:
                if log_token is not None:
                    _SECRETS.reset(log_token)


def begin_model_budget(callback_context):
    callback_context.state["temp:model_requests"] = 0


def enforce_model_budget(profile, callback_context, llm_request):
    del llm_request
    current = callback_context.state.get("temp:model_requests", 0) + 1
    if current > profile["limits"]["maxRequests"]:
        raise ModelProviderError("Model request budget exhausted")
    callback_context.state["temp:model_requests"] = current
