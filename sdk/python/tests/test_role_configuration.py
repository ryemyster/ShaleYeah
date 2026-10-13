import pytest

import shaleyeah_mcp
from shaleyeah_mcp import MCPClientError


def test_role_configuration_uses_bounded_modern_defaults_without_reading_a_secret(monkeypatch):
    for suffix in ("URL", "ACCESS_TOKEN_FILE", "TIMEOUT_SECONDS", "REQUEST_TIMEOUT_SECONDS"):
        monkeypatch.delenv(f"FIXTURE_MCP_{suffix}", raising=False)
    config = shaleyeah_mcp.load_mcp_config("FIXTURE", "http://localhost:3005/mcp")
    assert config.endpoint == "http://localhost:3005/mcp"
    assert config.protocol_versions == ("2026-07-28",)
    assert config.total_timeout == 30
    assert config.request_timeout == 10


@pytest.mark.parametrize("setting,value", [
    ("URL", "https://user:secret@untrusted.example/mcp"),
    ("URL", "http://untrusted.example/mcp"),
    ("TIMEOUT_SECONDS", "not-a-number"),
    ("TIMEOUT_SECONDS", "121"),
    ("REQUEST_TIMEOUT_SECONDS", "nan"),
])
def test_role_configuration_rejects_unsafe_endpoint_or_budget_without_exposing_values(monkeypatch, setting, value):
    monkeypatch.setenv(f"FIXTURE_MCP_{setting}", value)
    with pytest.raises(MCPClientError) as failure:
        shaleyeah_mcp.load_mcp_config("FIXTURE", "http://localhost:3005/mcp")
    assert failure.value.code in ("invalid_configuration", "invalid_endpoint")
    assert value not in str(failure.value)


@pytest.mark.parametrize("prefix", ["", "fixture", "X-MCP", "A" * 65, None])
def test_role_configuration_rejects_invalid_environment_namespace(prefix):
    with pytest.raises(MCPClientError) as failure:
        shaleyeah_mcp.load_mcp_config(prefix, "http://localhost:3005/mcp")
    assert failure.value.code == "invalid_configuration"
