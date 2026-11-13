import asyncio
import json
import socket
import subprocess
import sys
from pathlib import Path
from secrets import token_urlsafe

import pytest
from shaleyeah_mcp import FileBearerCredential, MCPClientConfig, MCPClientError

from app.market_mcp import MarketAnalystTools


@pytest.mark.asyncio
async def test_market_uses_an_independent_compatible_external_scenario_service(tmp_path):
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    token = token_urlsafe(32)
    token_file = tmp_path / "token"
    token_file.write_text(token)
    token_file.chmod(0o600)
    settings = tmp_path / "peer.json"
    packet = json.loads((Path(__file__).parent / "eval/fixtures/observed-scenario.json").read_text())
    proposal = json.loads(
        (Path(__file__).parent / "eval/fixtures/source-oracles.json").read_text()
    )["input"]["proposal"]
    analysis = {key: packet[key] for key in ("work", "market", "sourceArtifacts")}
    settings.write_text(
        json.dumps(
            {"port": port, "tokenFile": str(token_file), "analysis": analysis, "proposal": proposal}
        )
    )
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
                    raise AssertionError("Independent Market fixture did not start")
                try:
                    _, writer = await asyncio.open_connection("127.0.0.1", port)
                    writer.close()
                    await writer.wait_closed()
                    break
                except OSError:
                    await asyncio.sleep(0.05)
            else:
                raise AssertionError("External fixture readiness timeout")
            tools = MarketAnalystTools(
                MCPClientConfig(
                    endpoint=f"http://127.0.0.1:{port}/mcp",
                    credential=FileBearerCredential(token_file),
                    allow_loopback_http=True,
                )
            )
            result = await tools.draft_market_scenario("task.market", "r1", json.dumps(proposal), "r1")
            assert result["isError"] is False
            actual = result["structuredContent"]["analysis"]
            assert actual["fixture"] == "compatible-external-market"
            assert actual["taskRef"] == {"id": "task.market", "revision": "r1"}
            assert abs(actual["market"]["comparison"]["meanDifferential"] + 0.2) < 1e-12
            assert actual["market"]["commercialAuthority"] is False
            assert actual["market"]["scenarios"][0]["basis"] == "operator-scenario"
            assert len(actual["sourceArtifacts"]) == 3
            assert token not in json.dumps(result)
            token_file.unlink()
            with pytest.raises(MCPClientError) as missing:
                await tools.draft_market_scenario("task.market", "r1", json.dumps(proposal), "r1")
            assert missing.value.code == "authentication_required"
            assert missing.value.effect_unknown is False
            token_file.write_text(token_urlsafe(32))
            token_file.chmod(0o600)
            with pytest.raises(MCPClientError) as denied:
                await tools.draft_market_scenario("task.market", "r1", json.dumps(proposal), "r1")
            assert denied.value.code == "authentication_required"
            assert denied.value.effect_unknown is False
            assert str(token_file) not in str(denied.value)
        finally:
            peer.terminate()
            try:
                peer.wait(timeout=5)
            except subprocess.TimeoutExpired:
                peer.kill()
                peer.wait(timeout=5)
    assert token not in log_file.read_text()
