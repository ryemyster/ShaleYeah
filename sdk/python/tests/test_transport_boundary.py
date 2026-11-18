import asyncio
from contextlib import asynccontextmanager
from secrets import token_urlsafe
from types import SimpleNamespace

import httpx2 as httpx
import mcp
import mcp.client.streamable_http
import pytest

from shaleyeah_mcp import FileBearerCredential, MCPClientConfig, MCPClientError, call_tool

SCHEMA = {"type": "object", "properties": {"value": {"type": "string"}}, "required": ["value"]}


async def credential():
    return "synthetic-dedicated-mcp-credential"


def config(**options):
    return MCPClientConfig(
        endpoint="http://127.0.0.1:3001/mcp",
        credential=credential,
        allow_loopback_http=True,
        total_timeout=0.5,
        request_timeout=0.1,
        **options,
    )


def backend(monkeypatch, *, setup_errors=(), call_error=None, call_delay=0, version="2026-07-28", result_error=False):
    state = {"connections": 0, "dispatches": 0, "closes": 0, "clients": [], "metadata": []}

    class Session:
        def __init__(self, transport, **_kwargs):
            self.transport = transport
            self.session = self
            self.protocol_version = version

        async def __aenter__(self):
            await self.transport.__aenter__()
            return self

        async def __aexit__(self, *error):
            await self.transport.__aexit__(*error)

        async def list_tools(self, **_):
            return SimpleNamespace(
                tools=[
                    SimpleNamespace(
                        name="echo",
                        input_schema=SCHEMA,
                        output_schema=SCHEMA,
                    )
                ],
                next_cursor=None,
            )

        async def call_tool(self, _name, arguments, **_):
            state["dispatches"] += 1
            state["metadata"].append(_.get("meta"))
            await asyncio.sleep(call_delay)
            if call_error:
                raise call_error
            return SimpleNamespace(content=[], structured_content=arguments, is_error=result_error)

    @asynccontextmanager
    async def transport(_url, *, http_client, **_):
        state["connections"] += 1
        state["clients"].append(http_client)
        try:
            if state["connections"] <= len(setup_errors):
                raise setup_errors[state["connections"] - 1]
            yield None, None, lambda: None
        finally:
            state["closes"] += 1

    monkeypatch.setattr(mcp, "Client", Session)
    monkeypatch.setattr(mcp.client.streamable_http, "streamable_http_client", transport)
    return state


@pytest.mark.parametrize(
    "endpoint",
    [
        "http://remote.example/mcp",
        "https://user:secret@example.test/mcp",
        "https://example.test/mcp?access_token=secret",
        "https://example.test/mcp#secret",
        "file:///private/secret",
        "https:///mcp",
        "https://example.test:bad/mcp",
    ],
)
def test_invalid_destinations_are_rejected_before_any_credential_resolution(endpoint):
    with pytest.raises(MCPClientError) as error:
        MCPClientConfig(endpoint=endpoint, credential=credential)
    assert error.value.code == "invalid_endpoint"
    assert "secret" not in str(error.value)


@pytest.mark.parametrize(
    "options",
    [
        {"total_timeout": 0},
        {"request_timeout": float("inf")},
        {"preflight_attempts": 4},
        {"preflight_attempts": 0},
        {"retry_delay": -1},
        {"max_response_bytes": 0},
        {"max_response_bytes": True},
        {"max_response_bytes": 16_777_217},
        {"protocol_versions": ()},
        {"allow_loopback_http": "false"},
    ],
)
def test_unbounded_or_invalid_configuration_is_rejected(options):
    with pytest.raises(MCPClientError):
        MCPClientConfig(endpoint="https://example.test/mcp", credential=credential, **options)


@pytest.mark.asyncio
async def test_transient_setup_retry_is_bounded_and_closes_each_attempt(monkeypatch):
    state = backend(monkeypatch, setup_errors=[httpx.ConnectError("unsafe source secret")])
    result = await call_tool(config(preflight_attempts=2, retry_delay=0), "echo", {"value": "kept"})
    assert result["structuredContent"] == {"value": "kept"}
    assert state["connections"] == state["closes"] == 2
    assert state["dispatches"] == 1
    assert all(not client.follow_redirects and not client._trust_env for client in state["clients"])
    assert all(client.is_closed for client in state["clients"])


@pytest.mark.asyncio
async def test_exhausted_preflight_budget_is_a_safe_typed_failure(monkeypatch):
    state = backend(monkeypatch, setup_errors=[httpx.ConnectError("source secret")] * 3)
    with pytest.raises(MCPClientError) as error:
        await call_tool(config(preflight_attempts=2, retry_delay=0), "echo", {"value": "x"})
    assert error.value.category == "retryable"
    assert error.value.effect_unknown is False
    assert state["connections"] == state["closes"] == 2
    assert state["dispatches"] == 0
    assert "secret" not in repr(error.value)


@pytest.mark.asyncio
@pytest.mark.parametrize("status", [401, 403, 307])
async def test_auth_and_redirect_denials_never_retry_or_reflect_errors(monkeypatch, status):
    request = httpx.Request("POST", "https://endpoint.example/mcp")
    failure = httpx.HTTPStatusError(
        "reflected credential secret",
        request=request,
        response=httpx.Response(
            status, request=request, headers={"location": "https://attacker.example"}
        ),
    )
    state = backend(monkeypatch, setup_errors=[failure])
    with pytest.raises(MCPClientError) as error:
        await call_tool(config(preflight_attempts=3), "echo", {"value": "x"})
    assert error.value.code in ("authentication_required", "forbidden", "redirect_denied")
    assert state["connections"] == state["closes"] == 1
    assert state["dispatches"] == 0
    assert "secret" not in str(error.value)
    assert "attacker" not in repr(error.value)


@pytest.mark.asyncio
async def test_unsupported_protocol_is_not_treated_as_success(monkeypatch):
    state = backend(monkeypatch, version="future-unsupported-profile")
    with pytest.raises(MCPClientError) as error:
        await call_tool(config(), "echo", {"value": "x"})
    assert error.value.code == "unsupported_protocol"
    assert state["dispatches"] == 0
    assert state["closes"] == 1


@pytest.mark.asyncio
async def test_connection_loss_after_dispatch_never_replays_the_tool(monkeypatch):
    state = backend(monkeypatch, call_error=httpx.ConnectError("secret after possible effect"))
    with pytest.raises(MCPClientError) as error:
        await call_tool(config(preflight_attempts=3), "echo", {"value": "x"})
    assert error.value.effect_unknown is True
    assert state["connections"] == state["dispatches"] == state["closes"] == 1
    assert "secret" not in str(error.value)


@pytest.mark.asyncio
async def test_deadline_during_dispatch_closes_context_and_marks_uncertain_effect(monkeypatch):
    state = backend(monkeypatch, call_delay=5)
    settings = MCPClientConfig(
        endpoint="http://127.0.0.1:3001/mcp",
        credential=credential,
        allow_loopback_http=True,
        total_timeout=0.08,
        request_timeout=0.05,
    )
    with pytest.raises(MCPClientError) as error:
        await call_tool(settings, "echo", {"value": "x"})
    assert error.value.code == "timeout"
    assert error.value.effect_unknown is True
    assert state["connections"] == state["dispatches"] == state["closes"] == 1


@pytest.mark.asyncio
async def test_cancellation_propagates_and_a_later_call_connects_fresh(monkeypatch):
    state = backend(monkeypatch, call_delay=5)
    task = asyncio.create_task(call_tool(config(), "echo", {"value": "cancelled"}))
    while not state["dispatches"]:
        await asyncio.sleep(0.001)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert state["closes"] == 1
    fresh = backend(monkeypatch)
    result = await call_tool(config(), "echo", {"value": "new"})
    assert result["structuredContent"] == {"value": "new"}
    assert fresh["connections"] == fresh["closes"] == fresh["dispatches"] == 1


@pytest.mark.asyncio
async def test_private_reference_is_reloaded_between_calls_and_not_exposed(monkeypatch, tmp_path):
    state = backend(monkeypatch)
    reference = tmp_path / "token"
    first, second = token_urlsafe(32), token_urlsafe(32)
    reference.write_text(first)
    reference.chmod(0o600)
    provider = FileBearerCredential(reference)
    settings = config()
    settings = MCPClientConfig(
        endpoint=settings.endpoint, credential=provider, allow_loopback_http=True
    )
    await call_tool(settings, "echo", {"value": "one"})
    reference.write_text(second)
    await call_tool(settings, "echo", {"value": "two"})
    assert state["clients"][0].headers["authorization"] == f"Bearer {first}"
    assert state["clients"][1].headers["authorization"] == f"Bearer {second}"
    assert first not in repr(settings) and second not in repr(provider)
    assert str(reference) not in repr(provider)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "kind", ["missing", "shared", "symlink", "oversize", "empty", "whitespace"]
)
async def test_invalid_private_files_fail_before_connection(monkeypatch, tmp_path, kind):
    state = backend(monkeypatch)
    reference = tmp_path / "token"
    if kind != "missing":
        reference.write_text(
            "x" * 4097
            if kind == "oversize"
            else ""
            if kind == "empty"
            else "invalid token"
            if kind == "whitespace"
            else token_urlsafe(32)
        )
        reference.chmod(0o644 if kind == "shared" else 0o600)
    if kind == "symlink":
        link = tmp_path / "link"
        link.symlink_to(reference)
        reference = link
    settings = MCPClientConfig(
        endpoint="http://127.0.0.1:3001/mcp",
        credential=FileBearerCredential(reference),
        allow_loopback_http=True,
    )
    with pytest.raises(MCPClientError) as error:
        await call_tool(settings, "echo", {"value": "x"})
    assert error.value.category == "auth_required"
    assert state["connections"] == 0
    assert str(reference) not in str(error.value)


@pytest.mark.asyncio
async def test_exception_group_cannot_hide_auth_failure_or_expose_credentials(monkeypatch):
    request = httpx.Request("POST", "https://endpoint.example/mcp")
    failure = httpx.HTTPStatusError(
        "secret", request=request, response=httpx.Response(401, request=request)
    )
    state = backend(monkeypatch, setup_errors=[ExceptionGroup("secret", [failure])])
    with pytest.raises(MCPClientError) as error:
        await call_tool(config(preflight_attempts=3), "echo", {"value": "x"})
    assert error.value.category == "auth_required"
    assert state["connections"] == state["closes"] == 1
    assert "secret" not in str(error.value)


@pytest.mark.asyncio
@pytest.mark.parametrize("status,location", [
    (307, "https://attacker.example/mcp"),
    (307, "https://trusted.example/mcp-next"),
    (401, "https://attacker.example/mcp"),
    (403, "https://attacker.example/mcp"),
])
async def test_real_sdk_http_denials_do_not_follow_redirects_or_expose_credentials(
    monkeypatch, status, location
):
    original_client = httpx.AsyncClient
    requests = []
    token = token_urlsafe(32)

    async def supplied_credential():
        return token

    async def handler(request):
        requests.append(request)
        return httpx.Response(
            status,
            headers={"location": location},
            json={"error": "untrusted server text"},
        )

    def configured_client(**kwargs):
        return original_client(transport=httpx.MockTransport(handler), **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", configured_client)
    settings = MCPClientConfig(
        endpoint="https://trusted.example/mcp",
        credential=supplied_credential,
        preflight_attempts=3,
        total_timeout=1,
    )
    with pytest.raises(MCPClientError) as error:
        await call_tool(settings, "echo", {"value": "x"})
    assert error.value.code in ("redirect_denied", "authentication_required", "forbidden")
    assert len(requests) == 1
    assert requests[0].url.host == "trusted.example"
    assert requests[0].headers["authorization"] == f"Bearer {token}"
    assert token not in str(error.value)
    assert "untrusted server" not in str(error.value)


@pytest.mark.asyncio
async def test_real_modern_input_required_is_blocked_after_one_dispatch_without_automatic_replay(monkeypatch):
    original_client = httpx.AsyncClient
    dispatched = []

    async def handler(request):
        import json

        message = json.loads(request.content)
        if message["method"] == "tools/list":
            payload = {
                "resultType": "complete", "ttlMs": 0, "cacheScope": "private",
                "tools": [{"name": "echo", "inputSchema": SCHEMA}],
            }
        else:
            assert message["method"] == "tools/call"
            dispatched.append(message)
            payload = {"resultType": "input_required", "inputRequests": {}, "requestState": "untrusted-fixture-state"}
        return httpx.Response(200, json={"jsonrpc": "2.0", "id": message["id"], "result": payload})

    def configured_client(**kwargs):
        return original_client(transport=httpx.MockTransport(handler), **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", configured_client)
    with pytest.raises(MCPClientError) as failure:
        await call_tool(MCPClientConfig(
            endpoint="https://trusted.example/mcp", credential=credential, preflight_attempts=3,
        ), "echo", {"value": "kept"})
    assert failure.value.code == "input_required"
    assert failure.value.category == "user_action"
    assert failure.value.effect_unknown is True
    assert len(dispatched) == 1
    assert "untrusted-fixture-state" not in str(failure.value)


@pytest.mark.asyncio
@pytest.mark.parametrize("chunked", [False, True])
@pytest.mark.parametrize("value_size", [128, 2048])
async def test_real_modern_json_result_is_bounded_without_replaying_the_dispatched_call(monkeypatch, chunked, value_size):
    import json

    original_client = httpx.AsyncClient
    dispatched = []

    async def handler(request):
        message = json.loads(request.content)
        if message["method"] == "tools/list":
            payload = {
                "resultType": "complete", "ttlMs": 0, "cacheScope": "private",
                "tools": [{"name": "echo", "inputSchema": SCHEMA}],
            }
        else:
            assert message["method"] == "tools/call"
            dispatched.append(message)
            payload = {
                "resultType": "complete", "content": [], "isError": False,
                "structuredContent": {"value": "x" * value_size},
            }
        body = json.dumps({"jsonrpc": "2.0", "id": message["id"], "result": payload}).encode()
        if chunked:
            class Stream(httpx.AsyncByteStream):
                async def __aiter__(self):
                    for index in range(0, len(body), 4096):
                        yield body[index:index + 4096]
            return httpx.Response(200, headers={"content-type": "application/json"}, stream=Stream())
        return httpx.Response(200, headers={"content-type": "application/json"}, content=body)

    def configured_client(**kwargs):
        return original_client(transport=httpx.MockTransport(handler), **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", configured_client)
    settings = MCPClientConfig(
            endpoint="https://trusted.example/mcp", credential=credential, preflight_attempts=3,
            max_response_bytes=1024,
    )
    if value_size < 1024:
        result = await call_tool(settings, "echo", {"value": "kept"})
        assert result["structuredContent"] == {"value": "x" * value_size}
    else:
        with pytest.raises(MCPClientError) as failure:
            await call_tool(settings, "echo", {"value": "kept"})
        assert failure.value.code == "result_limit"
        assert failure.value.effect_unknown is True
    assert len(dispatched) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("headers,code", [
    ({"content-encoding": "gzip"}, "unsupported_encoding"),
    ({"content-length": "invalid"}, "invalid_result"),
    ({"content-length": "-1"}, "invalid_result"),
])
async def test_response_framing_is_rejected_before_parsing_or_dispatch(monkeypatch, headers, code):
    original_client = httpx.AsyncClient
    requests = []

    async def handler(request):
        requests.append(request)
        class Stream(httpx.AsyncByteStream):
            async def __aiter__(self):
                yield b"untrusted-body"
        return httpx.Response(200, headers=headers, stream=Stream())

    def configured_client(**kwargs):
        return original_client(transport=httpx.MockTransport(handler), **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", configured_client)
    with pytest.raises(MCPClientError) as failure:
        await call_tool(MCPClientConfig(endpoint="https://trusted.example/mcp", credential=credential), "echo", {"value": "kept"})
    assert failure.value.code == code
    assert failure.value.effect_unknown is False
    assert len(requests) == 1
    assert requests[0].headers["accept-encoding"] == "identity"


@pytest.mark.asyncio
async def test_real_sdk_cancellation_closes_streams_and_does_not_replay(monkeypatch):
    original_client = httpx.AsyncClient
    dispatched = asyncio.Event()
    clients, tool_calls = [], []

    async def handler(request):
        if request.method == "DELETE":
            return httpx.Response(200)
        if request.method == "GET":
            return httpx.Response(405)
        import json

        message = json.loads(request.content)
        method = message["method"]
        if method.startswith("notifications/"):
            return httpx.Response(202)
        if method == "server/discover":
            payload = {
                "supportedVersions": ["2026-07-28"],
                "capabilities": {"tools": {}},
                "ttlMs": 0,
                "cacheScope": "private",
            }
        elif method == "tools/list":
            payload = {
                "tools": [{"name": "echo", "inputSchema": SCHEMA}],
                "ttlMs": 0,
                "cacheScope": "private",
            }
        else:
            assert method == "tools/call"
            tool_calls.append(message)
            dispatched.set()
            await asyncio.sleep(5)
            payload = {"content": [], "structuredContent": {"value": "late"}, "isError": False}
        payload["resultType"] = "complete"
        return httpx.Response(
            200,
            headers={"mcp-protocol-version": "2026-07-28"},
            json={"jsonrpc": "2.0", "id": message["id"], "result": payload},
        )

    def configured_client(**kwargs):
        client = original_client(transport=httpx.MockTransport(handler), **kwargs)
        clients.append(client)
        return client

    monkeypatch.setattr(httpx, "AsyncClient", configured_client)
    settings = MCPClientConfig(
        endpoint="https://trusted.example/mcp",
        credential=credential,
        preflight_attempts=3,
        total_timeout=2,
    )
    task = asyncio.create_task(call_tool(settings, "echo", {"value": "x"}))
    await asyncio.wait_for(dispatched.wait(), timeout=1)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert len(tool_calls) == 1
    assert all(client.is_closed for client in clients)
