"""Wire compatibility only; these controls do not qualify employee job behavior."""

import asyncio
import importlib.util
import os
from pathlib import Path
from secrets import token_urlsafe

import pytest
import pytest_asyncio

from shaleyeah_mcp import MCPClientError

CALLERS = [
    ("development-planner", "development_mcp", "DEVELOPMENT", "development"),
    ("drilling-engineer", "drilling_mcp", "DRILLING", "drilling"),
    ("infrastructure-planner", "infrastructure_mcp", "INFRASTRUCTURE", "infrastructure"),
    ("investment-chair", "decision_mcp", "DECISION", "decision"),
    ("legal-analyst", "legal_mcp", "LEGAL", "legal"),
    ("market-analyst", "market_mcp", "MARKET", "market"),
    ("research-analyst", "research_mcp", "RESEARCH", "research"),
    ("risk-analyst", "risk_analysis_mcp", "RISK_ANALYSIS", "risk-analysis"),
    ("title-analyst", "title_mcp", "TITLE", "title"),
]


def caller(role, module):
    path = Path(__file__).resolve().parents[3] / "agents" / role / "app" / f"{module}.py"
    spec = importlib.util.spec_from_file_location(f"protocol_fixture_{role}", path)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return getattr(result, f"call_{module.removesuffix('_mcp')}_tool")


@pytest_asyncio.fixture
async def protected_peer(tmp_path):
    token = token_urlsafe(32)
    reference = tmp_path / "credential"
    reference.write_text(token)
    reference.chmod(0o600)
    process = await asyncio.create_subprocess_exec(
        "node", str(Path(__file__).parent / "fixtures" / "stateless_server.mjs"),
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        env={"PATH": os.environ["PATH"], "SHALE_FIXTURE_DIRECTORY": str(tmp_path), "SHALE_FIXTURE_TOKEN": token},
    )
    try:
        endpoint = (await asyncio.wait_for(process.stdout.readline(), timeout=10)).decode().strip()
        if not endpoint:
            diagnostic = (await process.stderr.read()).decode().replace(token, "[REDACTED]")
            pytest.fail(f"Independent protected peer could not start: {diagnostic}")
        assert endpoint.startswith("http://127.0.0.1:")
        yield endpoint, reference
    finally:
        if process.returncode is None:
            process.terminate()
            try:
                await asyncio.wait_for(process.wait(), timeout=3)
            except TimeoutError:
                process.kill()
                await process.wait()


@pytest.mark.asyncio
@pytest.mark.parametrize("role,module,prefix,backend", CALLERS)
async def test_each_employee_wrapper_calls_actual_protected_modern_peer(monkeypatch, protected_peer, role, module, prefix, backend):
    endpoint, reference = protected_peer
    monkeypatch.setenv(f"{prefix}_MCP_URL", endpoint)
    monkeypatch.setenv(f"{prefix}_MCP_ACCESS_TOKEN_FILE", str(reference))
    result = await caller(role, module)("echo", {"value": "fixture-only"})
    assert result["backendUrl"] == endpoint
    assert result["mcpServer"] == backend
    assert result["toolName"] == "echo"
    assert result["isError"] is False
    assert result["structuredContent"] == {"value": "fixture-only"}


@pytest.mark.asyncio
@pytest.mark.parametrize("role,module,prefix,backend", CALLERS)
async def test_each_employee_wrapper_denies_missing_private_credentials(monkeypatch, protected_peer, role, module, prefix, backend):
    endpoint, _ = protected_peer
    monkeypatch.setenv(f"{prefix}_MCP_URL", endpoint)
    monkeypatch.delenv(f"{prefix}_MCP_ACCESS_TOKEN_FILE", raising=False)
    with pytest.raises(MCPClientError) as failure:
        await caller(role, module)("echo", {"value": "denied"})
    assert failure.value.code == "authentication_required"
    assert failure.value.effect_unknown is False


@pytest.mark.asyncio
@pytest.mark.parametrize("role,module,prefix,backend", CALLERS)
async def test_each_employee_wrapper_preserves_safe_backend_authentication_failure(monkeypatch, protected_peer, tmp_path, role, module, prefix, backend):
    endpoint, _ = protected_peer
    reference = tmp_path / "incorrect-credential"
    token = token_urlsafe(32)
    reference.write_text(token)
    reference.chmod(0o600)
    monkeypatch.setenv(f"{prefix}_MCP_URL", endpoint)
    monkeypatch.setenv(f"{prefix}_MCP_ACCESS_TOKEN_FILE", str(reference))
    with pytest.raises(MCPClientError) as failure:
        await caller(role, module)("echo", {"value": "denied"})
    assert failure.value.code == "authentication_required"
    assert failure.value.effect_unknown is False
    assert token not in str(failure.value)
    assert str(reference) not in str(failure.value)
