import json
from contextlib import asynccontextmanager
from types import SimpleNamespace

import mcp
import mcp.client.streamable_http
import pytest

from shaleyeah_mcp import MCPClientConfig, MCPClientError, call_tool


async def credential():
    return "synthetic-credential-not-a-real-access-token"


async def call_geowiz_tool(name, arguments):
    return await call_tool(
        MCPClientConfig(
            endpoint="http://127.0.0.1:3001/mcp",
            credential=credential,
            allow_loopback_http=True,
        ),
        name,
        arguments,
    )


INPUT = {
    "type": "object",
    "properties": {"value": {"type": "string"}},
    "required": ["value"],
    "additionalProperties": False,
}
OUTPUT = {
    "type": "object",
    "properties": {"value": {"type": "string"}},
    "required": ["value"],
    "additionalProperties": False,
}


def fake_backend(
    monkeypatch,
    *,
    structured=None,
    text=None,
    is_error=False,
    output_schema=OUTPUT,
    input_schema=INPUT,
):
    calls = []

    class Session:
        def __init__(self, *_):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            return None

        async def initialize(self):
            calls.append("initialize")
            return SimpleNamespace(protocolVersion="2025-11-25")

        async def list_tools(self, **_):
            calls.append("list_tools")
            return SimpleNamespace(
                tools=[
                    SimpleNamespace(
                        name="echo", inputSchema=input_schema, outputSchema=output_schema
                    )
                ],
                nextCursor=None,
            )

        async def call_tool(self, name, arguments):
            calls.append((name, arguments))
            return SimpleNamespace(
                structuredContent=structured,
                isError=is_error,
                content=[] if text is None else [{"type": "text", "text": text}],
            )

    @asynccontextmanager
    async def transport(_url, **_kwargs):
        yield (None, None, None)

    monkeypatch.setattr(mcp, "ClientSession", Session)
    monkeypatch.setattr(mcp.client.streamable_http, "streamable_http_client", transport)
    return calls


@pytest.mark.asyncio
async def test_structured_only_success_is_retained_and_discovered(monkeypatch):
    calls = fake_backend(monkeypatch, structured={"value": "kept"})
    result = await call_geowiz_tool("echo", {"value": "x"})
    assert result["structuredContent"] == {"value": "kept"}
    assert result["isError"] is False
    assert calls == ["initialize", "list_tools", ("echo", {"value": "x"})]


@pytest.mark.asyncio
async def test_matching_structured_and_compatibility_text_are_retained(monkeypatch):
    payload = {"value": "kept"}
    fake_backend(monkeypatch, structured=payload, text=json.dumps(payload))
    result = await call_geowiz_tool("echo", {"value": "x"})
    assert result["structuredContent"] == payload
    assert json.loads(result["content"][0]["text"]) == payload


@pytest.mark.asyncio
async def test_invalid_input_is_rejected_before_execution(monkeypatch):
    calls = fake_backend(monkeypatch, structured={"value": "kept"})
    with pytest.raises(RuntimeError, match=r"input|arguments"):
        await call_geowiz_tool("echo", {"value": 7})
    assert not any(isinstance(call, tuple) for call in calls)


@pytest.mark.asyncio
async def test_malformed_advertised_input_schema_is_rejected_before_execution(monkeypatch):
    calls = fake_backend(
        monkeypatch, structured={"value": "kept"}, input_schema={"type": "not-a-json-schema-type"}
    )
    with pytest.raises(RuntimeError, match="input arguments"):
        await call_geowiz_tool("echo", {"value": "x"})
    assert not any(isinstance(call, tuple) for call in calls)


@pytest.mark.asyncio
async def test_invalid_structured_success_is_rejected(monkeypatch):
    fake_backend(monkeypatch, structured={"value": 7})
    with pytest.raises(RuntimeError, match=r"output|result|structured"):
        await call_geowiz_tool("echo", {"value": "x"})


@pytest.mark.asyncio
async def test_schema_required_structured_omission_is_rejected(monkeypatch):
    fake_backend(monkeypatch, text='{"value":"text-only"}')
    with pytest.raises(RuntimeError, match="structured"):
        await call_geowiz_tool("echo", {"value": "x"})


@pytest.mark.asyncio
async def test_conflicting_text_and_structured_success_is_rejected(monkeypatch):
    fake_backend(monkeypatch, structured={"value": "one"}, text='{"value":"two"}')
    with pytest.raises(RuntimeError, match=r"conflict|match"):
        await call_geowiz_tool("echo", {"value": "x"})


@pytest.mark.asyncio
async def test_error_result_does_not_need_to_match_success_schema(monkeypatch):
    failure = {"success": False, "error": {"error_type": "user_action", "message": "missing input"}}
    fake_backend(monkeypatch, structured=failure, text=json.dumps(failure), is_error=True)
    result = await call_geowiz_tool("echo", {"value": "x"})
    assert result["isError"] is True
    assert result["structuredContent"] == failure


@pytest.mark.asyncio
async def test_legacy_text_failure_cannot_become_success(monkeypatch):
    fake_backend(
        monkeypatch,
        text='{"success":true,"data":{"success":false,"error":"missing input"}}',
        output_schema=None,
    )
    result = await call_geowiz_tool("echo", {"value": "x"})
    assert result["isError"] is True


@pytest.mark.asyncio
async def test_legacy_analysis_error_marker_cannot_become_success(monkeypatch):
    fake_backend(
        monkeypatch,
        text='{"success":true,"analysis":{"error_type":"permanent","error":"XOR input"}}',
        output_schema=None,
    )
    result = await call_geowiz_tool("echo", {"value": "x"})
    assert result["isError"] is True


@pytest.mark.asyncio
async def test_partial_output_stays_partial(monkeypatch):
    partial = {"status": "partial", "findings": ["draft"]}
    schema = {
        "type": "object",
        "properties": {
            "status": {"const": "partial"},
            "findings": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["status", "findings"],
    }
    fake_backend(monkeypatch, structured=partial, output_schema=schema)
    result = await call_geowiz_tool("echo", {"value": "x"})
    assert result["structuredContent"] == partial
    assert result["isError"] is False
    assert "completed" not in result


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "pages, message",
    [
        ([([], None)], "not advertised"),
        ([(["echo", "echo"], None)], "ambiguous"),
        ([(["echo"], "next"), (["echo"], None)], "ambiguous"),
        ([([], "again"), ([], "again")], "cursor repeated"),
        ([([], str(i)) for i in range(32)], "32 pages"),
    ],
)
async def test_discovery_fails_closed_for_unknown_ambiguous_and_unbounded_tools(
    monkeypatch, pages, message
):
    called = []

    class Session:
        def __init__(self, *_):
            self.page = 0

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            pass

        async def initialize(self):
            return SimpleNamespace(protocolVersion="2025-11-25")

        async def list_tools(self, **_):
            names, cursor = pages[self.page]
            self.page += 1
            return SimpleNamespace(
                tools=[
                    SimpleNamespace(name=name, inputSchema=INPUT, outputSchema=OUTPUT)
                    for name in names
                ],
                nextCursor=cursor,
            )

        async def call_tool(self, *_):
            called.append(True)
            return SimpleNamespace(content=[], structuredContent={"value": "kept"}, isError=False)

    fake_backend(monkeypatch, structured={"value": "kept"})
    monkeypatch.setattr(mcp, "ClientSession", Session)
    with pytest.raises(RuntimeError, match=message):
        await call_geowiz_tool("echo", {"value": "x"})
    assert not called


@pytest.mark.asyncio
async def test_nonobject_structured_result_is_rejected(monkeypatch):
    fake_backend(monkeypatch, structured=["invalid"])
    with pytest.raises(MCPClientError) as error:
        await call_geowiz_tool("echo", {"value": "x"})
    assert error.value.code == "invalid_result"


@pytest.mark.asyncio
async def test_native_nonjson_tool_failure_is_retained(monkeypatch):
    fake_backend(monkeypatch, text="Input validation failed: fix the supplied date", is_error=True)
    result = await call_geowiz_tool("echo", {"value": "x"})
    assert result["isError"] is True
    assert result["structuredContent"] is None
    assert result["content"][0]["text"] == "Input validation failed: fix the supplied date"


@pytest.mark.asyncio
async def test_legacy_json_success_without_output_schema_is_explicitly_supported(monkeypatch):
    fake_backend(
        monkeypatch, text='{"success":true,"analysis":{"findings":["draft"]}}', output_schema=None
    )
    result = await call_geowiz_tool("echo", {"value": "x"})
    assert result["isError"] is False
    assert result["structuredContent"] is None
    assert json.loads(result["content"][0]["text"])["analysis"]["findings"] == ["draft"]


@pytest.mark.asyncio
async def test_excessive_legacy_nesting_is_rejected_instead_of_hiding_failure(monkeypatch):
    payload = {"success": False, "error": "failed"}
    for _ in range(5):
        payload = {"success": True, "data": payload}
    fake_backend(monkeypatch, text=json.dumps(payload), output_schema=None)
    with pytest.raises(RuntimeError, match="nesting"):
        await call_geowiz_tool("echo", {"value": "x"})
