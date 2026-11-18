import asyncio
import json
import socket
import subprocess
import sys
from pathlib import Path
from secrets import token_urlsafe

import pytest
from shaleyeah_mcp import FileBearerCredential, MCPClientConfig

from app.econobot_mcp import EconomistTools


@pytest.mark.asyncio
async def test_economist_uses_an_independent_compatible_external_calculation_service(tmp_path):
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    token = token_urlsafe(32)
    token_file = tmp_path / "token"
    token_file.write_text(token)
    token_file.chmod(0o600)
    settings = tmp_path / "peer.json"
    settings.write_text(json.dumps({"port": port, "tokenFile": str(token_file)}))
    settings.chmod(0o600)
    log_file = tmp_path / "peer.log"
    with log_file.open("w") as log:
        peer = subprocess.Popen(
            [
                sys.executable,
                str(Path(__file__).parent / "fixtures/external-mcp.py"),
                str(settings),
            ],
            stdout=log,
            stderr=log,
        )
        try:
            for _ in range(100):
                if peer.poll() is not None:
                    raise AssertionError("Independent economics fixture did not start")
                try:
                    _, writer = await asyncio.open_connection("127.0.0.1", port)
                    writer.close()
                    await writer.wait_closed()
                    break
                except OSError:
                    await asyncio.sleep(0.05)
            else:
                raise AssertionError("External fixture readiness timeout")
            tools = EconomistTools(
                MCPClientConfig(
                    endpoint=f"http://127.0.0.1:{port}/mcp",
                    credential=FileBearerCredential(token_file),
                    allow_loopback_http=True,
                )
            )
            result = await tools.calculate_scenario("task.economist", "r1", "base", "r1")
            assert result["isError"] is False
            actual = result["structuredContent"]["analysis"]
            assert actual["fixture"] == "compatible-external-economics"
            assert actual["taskRef"] == {"id": "task.economist", "revision": "r1"}
            assert actual["reference"] == {"id": "base", "revision": "r1"}
            assert actual["economics"]["npv"]["value"] == 0
            assert actual["economics"]["irr"]["value"] == 0.1
            assert actual["economics"]["authorizesInvestment"] is False
            assert token not in json.dumps(result)
            token_file.write_text(token_urlsafe(32))
            denied = await tools.calculate_scenario("task.economist", "r1", "base", "r1")
            assert denied["isError"] is True
        finally:
            peer.terminate()
            try:
                peer.wait(timeout=5)
            except subprocess.TimeoutExpired:
                peer.kill()
                peer.wait(timeout=5)
    assert token not in log_file.read_text()
