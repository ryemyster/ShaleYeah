import asyncio
import json
import socket
import subprocess
import sys
from pathlib import Path
from secrets import token_urlsafe

import pytest
from shaleyeah_mcp import FileBearerCredential, MCPClientConfig

from app.qa_mcp import QATools


@pytest.mark.asyncio
async def test_actual_employee_tools_use_an_independent_compatible_external_service(tmp_path):
    with socket.socket() as socket_probe:
        socket_probe.bind(("127.0.0.1", 0))
        port = socket_probe.getsockname()[1]
    token_file = tmp_path / "token"
    token_file.write_text(token_urlsafe(32))
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
                    raise AssertionError("External fixture did not start")
                try:
                    reader, writer = await asyncio.open_connection("127.0.0.1", port)
                    writer.close()
                    await writer.wait_closed()
                    break
                except OSError:
                    await asyncio.sleep(0.05)
            else:
                raise AssertionError("External fixture readiness timeout")
            tools = QATools(
                MCPClientConfig(
                    endpoint=f"http://127.0.0.1:{port}/mcp",
                    credential=FileBearerCredential(token_file),
                    allow_loopback_http=True,
                )
            )
            result = await tools.run_quality_checks("task.qa", "r1", "profile.qa", "r1")
            assert result["isError"] is False
            assert result["structuredContent"]["analysis"]["fixture"] == "compatible-external-mcp"
            assert result["structuredContent"]["analysis"]["taskRef"] == {
                "id": "task.qa",
                "revision": "r1",
            }
            assert token_file.read_text() not in json.dumps(result)
        finally:
            peer.terminate()
            try:
                peer.wait(timeout=5)
            except subprocess.TimeoutExpired:
                peer.kill()
                peer.wait(timeout=5)
