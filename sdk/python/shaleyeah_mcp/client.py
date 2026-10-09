import math
import os
import stat
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

import anyio
import httpx

from .errors import MCPClientError
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
    protocol_versions: tuple[str, ...] = ("2025-11-25",)

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
            or isinstance(self.preflight_attempts, bool)
            or not isinstance(self.preflight_attempts, int)
            or not 1 <= self.preflight_attempts <= 3
            or not callable(self.credential)
            or not isinstance(self.protocol_versions, tuple)
            or not self.protocol_versions
            or any(
                version not in ("2024-11-05", "2025-03-26", "2025-06-18", "2025-11-25")
                for version in self.protocol_versions
            )
        ):
            raise MCPClientError("invalid_configuration", "user_action")


def _leaves(error: Exception) -> list[Exception]:
    if isinstance(error, ExceptionGroup):
        return [leaf for nested in error.exceptions for leaf in _leaves(nested)]
    return [error]


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
    config: MCPClientConfig, tool_name: str, arguments: dict[str, Any]
) -> dict[str, Any]:
    """One configured call/session. Only transient pre-dispatch setup may retry."""

    from mcp import ClientSession
    from mcp.client.streamable_http import streamable_http_client

    if (
        not isinstance(tool_name, str)
        or not tool_name
        or len(tool_name) > 128
        or not isinstance(arguments, dict)
    ):
        raise MCPClientError("invalid_input", "user_action")
    dispatched = False
    try:
        with anyio.fail_after(config.total_timeout):
            for attempt in range(config.preflight_attempts):
                try:
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
                    async with httpx.AsyncClient(
                        headers={"Authorization": f"Bearer {token}"},
                        timeout=config.request_timeout,
                        follow_redirects=False,
                        trust_env=False,
                    ) as client:
                        async with streamable_http_client(config.endpoint, http_client=client) as (
                            reader,
                            writer,
                            _,
                        ):
                            async with ClientSession(reader, writer) as session:
                                initialized = await session.initialize()
                                if initialized.protocolVersion not in config.protocol_versions:
                                    raise MCPClientError("unsupported_protocol")
                                tool = await discover_tool(session, tool_name)
                                validate_schema(arguments, tool.inputSchema, "input")
                                dispatched = True
                                result = await session.call_tool(tool_name, arguments)
                                return read_result(result, getattr(tool, "outputSchema", None))
                except Exception as error:
                    failure = _failure(error, dispatched)
                    if (
                        dispatched
                        or failure.category != "retryable"
                        or attempt + 1 >= config.preflight_attempts
                    ):
                        raise failure from None
                    await anyio.sleep(config.retry_delay)
    except TimeoutError:
        raise MCPClientError("timeout", "retryable", effect_unknown=dispatched) from None
    raise MCPClientError("protocol_error")
