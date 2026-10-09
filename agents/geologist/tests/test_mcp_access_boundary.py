"""Credential and destination controls for the real Geologist role adapter."""

from contextlib import asynccontextmanager
from secrets import token_urlsafe
from types import SimpleNamespace

import mcp
import mcp.client.streamable_http
import pytest

from app import geowiz_mcp


def fake_transport(monkeypatch):
    opened = []

    class Session:
        def __init__(self, *_args, **_kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            pass

        async def initialize(self):
            return SimpleNamespace(protocolVersion="2025-11-25")

        async def list_tools(self, **_):
            return SimpleNamespace(
                tools=[
                    SimpleNamespace(
                        name="assess_quality",
                        inputSchema={"type": "object"},
                        outputSchema=None,
                    )
                ],
                nextCursor=None,
            )

        async def call_tool(self, *_args, **_kwargs):
            return SimpleNamespace(
                content=[], structuredContent={"fixture": "transport-control"}, isError=False
            )

    @asynccontextmanager
    async def transport(url, **kwargs):
        client = kwargs.get("http_client")
        headers = dict(client.headers) if client is not None else kwargs.get("headers", {})
        opened.append((url, headers))
        yield None, None, lambda: None

    monkeypatch.setattr(mcp, "ClientSession", Session)
    monkeypatch.setattr(mcp.client.streamable_http, "streamablehttp_client", transport)
    monkeypatch.setattr(mcp.client.streamable_http, "streamable_http_client", transport)
    monkeypatch.delenv("GEOWIZ_MCP_ACCESS_TOKEN_FILE", raising=False)
    monkeypatch.delenv("GEOWIZ_MCP_URL", raising=False)
    return opened


def test_default_geowiz_destination_is_the_protected_mcp_route(monkeypatch):
    monkeypatch.delenv("GEOWIZ_MCP_URL", raising=False)
    assert geowiz_mcp.geowiz_backend_url() == "http://127.0.0.1:3001/mcp"


def test_status_and_planning_cannot_return_url_credentials(monkeypatch):
    monkeypatch.setenv("GEOWIZ_MCP_URL", "https://operator:secret@example.test/mcp")
    with pytest.raises(RuntimeError, match="endpoint"):
        geowiz_mcp.geowiz_backend_url()


@pytest.mark.asyncio
async def test_role_resolves_a_dedicated_private_credential_outside_tool_arguments(
    monkeypatch, tmp_path
):
    opened = fake_transport(monkeypatch)
    token = token_urlsafe(32)
    reference = tmp_path / "mcp-token"
    reference.write_text(token)
    reference.chmod(0o600)
    monkeypatch.setenv("GEOWIZ_MCP_ACCESS_TOKEN_FILE", str(reference))
    result = await geowiz_mcp.assess_geowiz_quality("fixture.las")
    assert opened[0][1].get("authorization") == f"Bearer {token}"
    assert result["structuredContent"] == {"fixture": "transport-control"}
    assert result["isError"] is False
    assert token not in repr(result)


@pytest.mark.asyncio
async def test_missing_credential_stops_before_any_connection(monkeypatch):
    opened = fake_transport(monkeypatch)
    with pytest.raises(RuntimeError, match=r"credential|authentication"):
        await geowiz_mcp.assess_geowiz_quality("fixture.las")
    assert opened == []


@pytest.mark.asyncio
async def test_provider_key_never_substitutes_for_mcp_authority(monkeypatch):
    opened = fake_transport(monkeypatch)
    monkeypatch.setenv("ANTHROPIC_API_KEY", token_urlsafe(32))
    with pytest.raises(RuntimeError, match=r"credential|authentication"):
        await geowiz_mcp.assess_geowiz_quality("fixture.las")
    assert opened == []


@pytest.mark.asyncio
async def test_remote_plain_http_does_not_receive_the_private_credential(monkeypatch, tmp_path):
    opened = fake_transport(monkeypatch)
    reference = tmp_path / "mcp-token"
    reference.write_text(token_urlsafe(32))
    reference.chmod(0o600)
    monkeypatch.setenv("GEOWIZ_MCP_ACCESS_TOKEN_FILE", str(reference))
    monkeypatch.setenv("GEOWIZ_MCP_URL", "http://external.example/mcp")
    with pytest.raises(RuntimeError, match=r"endpoint|HTTPS"):
        await geowiz_mcp.assess_geowiz_quality("fixture.las")
    assert opened == []
