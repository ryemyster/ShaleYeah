import asyncio
import os
from pathlib import Path
from secrets import token_urlsafe

import pytest

from shaleyeah_mcp import MCPClientConfig, call_tool


@pytest.mark.asyncio
async def test_python_client_calls_actual_modern_typescript_server(tmp_path):
    """No shared Python mock or transport session can manufacture interoperability."""
    token = token_urlsafe(32)
    process = await asyncio.create_subprocess_exec(
        "node",
        str(Path(__file__).parent / "fixtures" / "stateless_server.mjs"),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env={
            "PATH": os.environ["PATH"],
            "SHALE_FIXTURE_DIRECTORY": str(tmp_path),
            "SHALE_FIXTURE_TOKEN": token,
        },
    )
    try:
        endpoint = (await asyncio.wait_for(process.stdout.readline(), timeout=10)).decode().strip()
        if not endpoint:
            diagnostic = (await process.stderr.read()).decode().replace(token, "[REDACTED]")
            pytest.fail(f"Independent fixture could not start: {diagnostic}")
        assert endpoint.startswith("http://127.0.0.1:")

        async def credential():
            return token

        config = MCPClientConfig(
            endpoint=endpoint,
            credential=credential,
            allow_loopback_http=True,
            protocol_versions=("2026-07-28",),
            preflight_attempts=1,
        )
        result = await call_tool(config, "echo", {"value": "fixture-only"})
        assert result["isError"] is False
        assert result["structuredContent"] == {"value": "fixture-only"}
    finally:
        if process.returncode is None:
            process.terminate()
            try:
                await asyncio.wait_for(process.wait(), timeout=3)
            except TimeoutError:
                process.kill()
                await process.wait()
