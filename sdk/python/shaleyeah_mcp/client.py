import math
import os
import stat
import time
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

import anyio
import httpx2 as httpx
from shaleyeah_contracts.events import EventValidationError

from .errors import MCPClientError
from .events import EventEmitter, EventExportError
from .results import discover_tool, read_result, validate_schema

CredentialProvider = Callable[[], Awaitable[str]]


@dataclass(frozen=True)
class FileBearerCredential:
    """Owned private regular-file reference; protect its parent directories too."""

    reference: Path = field(repr=False)

    async def __call__(self) -> str:
        try:
            return await anyio.to_thread.run_sync(self._read, abandon_on_cancel=True)
        except Exception:
            raise MCPClientError("authentication_required", "auth_required") from None

    def _read(self) -> str:
        if not hasattr(os, "O_NOFOLLOW"):
            raise ValueError("Private file support unavailable")
        fd = os.open(self.reference, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
        try:
            info = os.fstat(fd)
            if (
                not stat.S_ISREG(info.st_mode)
                or info.st_mode & 0o077
                or (hasattr(os, "getuid") and info.st_uid != os.getuid())
            ):
                raise ValueError("Private file policy denied")
            data = b""
            while len(data) <= 4096:
                chunk = os.read(fd, 4097 - len(data))
                if not chunk:
                    break
                data += chunk
            if len(data) > 4096:
                raise ValueError("Credential exceeds limit")
            return data.decode("utf-8").strip()
        finally:
            os.close(fd)


@dataclass(frozen=True)
class MCPClientConfig:
    endpoint: str
    credential: CredentialProvider = field(repr=False)
    allow_loopback_http: bool = False
    total_timeout: float = 30
    request_timeout: float = 10
    preflight_attempts: int = 2
    retry_delay: float = 0.1
    max_response_bytes: int = 1_048_576
    protocol_versions: tuple[str, ...] = ("2026-07-28",)

    def __post_init__(self):
        try:
            if not isinstance(self.endpoint, str) or len(self.endpoint) > 2048:
                raise ValueError()
            parsed = urlsplit(self.endpoint)
            if (
                not parsed.hostname
                or parsed.username is not None
                or parsed.password is not None
                or parsed.query
                or parsed.fragment
                or "?" in self.endpoint
                or "#" in self.endpoint
                or any(ord(char) <= 32 or ord(char) >= 127 for char in self.endpoint)
                or (parsed.port is not None and not 0 < parsed.port <= 65535)
                or (
                    parsed.scheme != "https"
                    and not (
                        self.allow_loopback_http
                        and parsed.scheme == "http"
                        and parsed.hostname in ("127.0.0.1", "::1", "localhost")
                    )
                )
            ):
                raise ValueError()
        except (ValueError, TypeError):
            raise MCPClientError("invalid_endpoint", "user_action") from None
        limits = (self.total_timeout, self.request_timeout, self.retry_delay)
        if (
            not isinstance(self.allow_loopback_http, bool)
            or any(
                isinstance(value, bool)
                or not isinstance(value, (int, float))
                or not math.isfinite(value)
                for value in limits
            )
            or not 0 < self.total_timeout <= 120
            or not 0 < self.request_timeout <= 120
            or not 0 <= self.retry_delay <= 10
            or isinstance(self.max_response_bytes, bool)
            or not isinstance(self.max_response_bytes, int)
            or not 1 <= self.max_response_bytes <= 16_777_216
            or isinstance(self.preflight_attempts, bool)
            or not isinstance(self.preflight_attempts, int)
            or not 1 <= self.preflight_attempts <= 3
            or not callable(self.credential)
            or not isinstance(self.protocol_versions, tuple)
            or not self.protocol_versions
            or self.protocol_versions != ("2026-07-28",)
        ):
            raise MCPClientError("invalid_configuration", "user_action")


def _leaves(error: Exception) -> list[Exception]:
    if isinstance(error, ExceptionGroup):
        return [leaf for nested in error.exceptions for leaf in _leaves(nested)]
    return [error]


class _BoundedResponseStream(httpx.AsyncByteStream):
    def __init__(self, stream: httpx.AsyncByteStream, maximum: int):
        self.stream = stream
        self.maximum = maximum

    async def __aiter__(self):
        received = 0
        async for chunk in self.stream:
            received += len(chunk)
            if received > self.maximum:
                raise MCPClientError("result_limit", "user_action")
            yield chunk

    async def aclose(self):
        await self.stream.aclose()


def _failure(error: Exception, dispatched: bool) -> MCPClientError:
    leaves = _leaves(error)
    for leaf in leaves:
        if isinstance(leaf, MCPClientError):
            return MCPClientError(
                leaf.code, leaf.category, effect_unknown=dispatched or leaf.effect_unknown
            )
    statuses = [
        leaf.response.status_code for leaf in leaves if isinstance(leaf, httpx.HTTPStatusError)
    ]
    if 401 in statuses:
        return MCPClientError("authentication_required", "auth_required", effect_unknown=dispatched)
    if 403 in statuses:
        return MCPClientError("forbidden", "user_action", effect_unknown=dispatched)
    if any(300 <= status < 400 for status in statuses):
        return MCPClientError("redirect_denied", effect_unknown=dispatched)
    if any(isinstance(leaf, (httpx.TimeoutException, TimeoutError)) for leaf in leaves):
        return MCPClientError("timeout", "retryable", effect_unknown=dispatched)
    if any(
        isinstance(leaf, (httpx.NetworkError, httpx.RemoteProtocolError)) for leaf in leaves
    ) or any(status == 429 or status >= 500 for status in statuses):
        return MCPClientError("connection_failed", "retryable", effect_unknown=dispatched)
    return MCPClientError(
        "invalid_result" if dispatched else "protocol_error", effect_unknown=dispatched
    )


async def call_tool(
    config: MCPClientConfig, tool_name: str, arguments: dict[str, Any], *, events: EventEmitter | None = None
) -> dict[str, Any]:
    """One pinned modern call. Only transient pre-dispatch setup may retry."""

    from mcp import Client
    from mcp.client.streamable_http import streamable_http_client

    if (
        not isinstance(tool_name, str)
        or not tool_name
        or len(tool_name) > 128
        or not isinstance(arguments, dict)
        or (events is not None and not isinstance(events, EventEmitter))
    ):
        raise MCPClientError("invalid_input", "user_action")
    dispatched = False

    async def record(status, **details):
        if events is None:
            return None
        try:
            return await events.emit("tool", status, toolName=tool_name, **details)
        except (EventExportError, EventValidationError):
            raise MCPClientError("audit_unavailable", "user_action", effect_unknown=dispatched) from None

    try:
        with anyio.fail_after(config.total_timeout):
            for attempt in range(config.preflight_attempts):
                started = time.monotonic()
                span_id = uuid.uuid4().hex[:16]
                try:
                    receipt = await record("started", attempt=attempt + 1, spanId=span_id)
                    try:
                        token = await config.credential()
                        if (
                            not isinstance(token, str)
                            or not 1 <= len(token) <= 4096
                            or any(ord(char) <= 32 or ord(char) >= 127 for char in token)
                        ):
                            raise ValueError()
                    except Exception:
                        raise MCPClientError("authentication_required", "auth_required") from None
                    async def enforce_response(response: httpx.Response) -> None:
                        # The MCP transport can follow same-origin redirects independently of the HTTP flag.
                        if 300 <= response.status_code < 400:
                            raise MCPClientError("redirect_denied")
                        if response.status_code == 401:
                            raise MCPClientError("authentication_required", "auth_required")
                        if response.status_code == 403:
                            raise MCPClientError("forbidden", "user_action")
                        if response.status_code == 429 or response.status_code >= 500:
                            raise MCPClientError("connection_failed", "retryable")
                        if response.status_code >= 400:
                            raise MCPClientError("protocol_error")
                        if response.headers.get("content-encoding", "identity").lower() != "identity":
                            raise MCPClientError("unsupported_encoding", "user_action")
                        length = response.headers.get("content-length")
                        if length is not None:
                            try:
                                if int(length) < 0:
                                    raise ValueError()
                                if int(length) > config.max_response_bytes:
                                    raise MCPClientError("result_limit", "user_action")
                            except ValueError:
                                raise MCPClientError("invalid_result") from None
                        if response.is_stream_consumed:
                            if len(response.content) > config.max_response_bytes:
                                raise MCPClientError("result_limit", "user_action")
                        else:
                            response.stream = _BoundedResponseStream(response.stream, config.max_response_bytes)

                    async with httpx.AsyncClient(
                        headers={"Authorization": f"Bearer {token}", "Accept-Encoding": "identity"},
                        timeout=config.request_timeout,
                        follow_redirects=False,
                        trust_env=False,
                        event_hooks={"response": [enforce_response]},
                    ) as client:
                        transport = streamable_http_client(
                            config.endpoint, http_client=client, terminate_on_close=False,
                            max_sse_event_size=config.max_response_bytes,
                        )
                        async with Client(
                            transport, mode="2026-07-28", cache=None,
                            read_timeout_seconds=config.request_timeout,
                        ) as peer:
                            if peer.protocol_version not in config.protocol_versions:
                                raise MCPClientError("unsupported_protocol")
                            tool = await discover_tool(peer, tool_name)
                            validate_schema(arguments, tool.input_schema, "input")
                            dispatched = True
                            # Host-bound correlation is separate from model-visible arguments and authority.
                            metadata = (
                                {"meta": {"org.shaleyeah/correlation": {
                                    "context": events.context, "parentEventId": receipt["eventId"], "spanId": span_id,
                                }}} if events is not None else {}
                            )
                            # The high-level helper can automatically replay MRTR/header mismatches.
                            # A single manual session call preserves our no-replay action boundary.
                            result = await peer.session.call_tool(
                                tool_name, arguments, allow_input_required=True, **metadata,
                            )
                            output = read_result(result, getattr(tool, "output_schema", None))
                            await record(
                                "failed" if output["isError"] else "succeeded",
                                attempt=attempt + 1, spanId=span_id,
                                measurements={"toolLatencyMs": (time.monotonic() - started) * 1000},
                                **({"errorCode": "tool_failed"} if output["isError"] else {}),
                            )
                            return output
                except Exception as error:
                    failure = _failure(error, dispatched)
                    if failure.code == "audit_unavailable":
                        raise failure from None
                    terminal = (
                        dispatched
                        or failure.category != "retryable"
                        or attempt + 1 >= config.preflight_attempts
                    )
                    await record(
                        ("blocked" if failure.category in ("auth_required", "user_action") else "failed") if terminal else "retried",
                        attempt=attempt + 1, spanId=span_id, errorCode=failure.code, effectUnknown=failure.effect_unknown,
                        measurements={"toolLatencyMs": (time.monotonic() - started) * 1000},
                    )
                    if terminal:
                        raise failure from None
                    await anyio.sleep(config.retry_delay)
    except TimeoutError:
        # Cancellation exits the transport scope first; then record the unfinished action without replaying it.
        await record(
            "failed", attempt=attempt + 1, spanId=span_id, errorCode="timeout", effectUnknown=dispatched,
            measurements={"toolLatencyMs": (time.monotonic() - started) * 1000},
        )
        raise MCPClientError("timeout", "retryable", effect_unknown=dispatched) from None
    raise MCPClientError("protocol_error")
