"""Offline interoperability control: installed Python role/client to actual Geowiz.

These assertions qualify transport/auth only. assess_quality currently uses fixed
metrics; no observed source quality, professional acceptance or review grant is claimed.
"""

import asyncio
import json
import os
import re
from pathlib import Path
from secrets import token_urlsafe
from tempfile import TemporaryDirectory

import httpx
from app.geowiz_mcp import assess_geowiz_quality, save_geowiz_finding

from shaleyeah_mcp import MCPClientError

REPO = Path(__file__).resolve().parents[3]


async def main():
    with TemporaryDirectory(prefix="shale-python-geowiz-") as temporary:
        private = Path(temporary)
        token = token_urlsafe(32)
        token_file, config_file, audit = (
            private / "token",
            private / "access.json",
            private / "audit.jsonl",
        )
        token_file.write_text(token)
        token_file.chmod(0o600)
        config_file.write_text(
            json.dumps(
                {
                    "bindHost": "127.0.0.1",
                    "allowedHosts": ["127.0.0.1"],
                    "allowedOrigins": [],
                    "principal": {
                        "subjectId": "reference-operator",
                        "customerId": "fixture",
                        "employeeId": "geologist",
                        "scopes": ["mcp:connect", "geowiz:quality"],
                    },
                    "policy": {
                        "id": "reference-ingress",
                        "version": "r1",
                        "connectionScopes": ["mcp:connect"],
                        "toolScopes": {"assess_quality": ["geowiz:quality"]},
                        "resourceScopes": {},
                    },
                    "accessTokenFile": str(token_file),
                    "auditFile": str(audit),
                    "dataPath": str(private / "data"),
                }
            )
        )
        config_file.chmod(0o600)
        process = await asyncio.create_subprocess_exec(
            "node",
            str(REPO / "servers/geowiz/examples/local-http.mjs"),
            env={**os.environ, "PORT": "0", "GEOWIZ_HTTP_CONFIG_FILE": str(config_file)},
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        output = []
        ready = asyncio.get_running_loop().create_future()

        async def read_output():
            while line := await process.stdout.readline():
                text = line.decode(errors="replace")
                output.append(text)
                match = re.search(r"HTTP transport listening on port (\d+)", text)
                if match and not ready.done():
                    ready.set_result(int(match.group(1)))
            if not ready.done():
                ready.set_exception(RuntimeError("Geowiz reference did not open its listener"))

        reader = asyncio.create_task(read_output())
        settings = {}
        try:
            port = await asyncio.wait_for(ready, timeout=10)
            url = f"http://127.0.0.1:{port}/mcp"
            updates = {
                "GEOWIZ_MCP_URL": url,
                "GEOWIZ_MCP_ACCESS_TOKEN_FILE": str(token_file),
                "GEOWIZ_MCP_TIMEOUT_SECONDS": "5",
                "GEOWIZ_MCP_REQUEST_TIMEOUT_SECONDS": "2",
            }
            settings = {name: os.environ.get(name) for name in updates}
            os.environ.update(updates)
            result = await assess_geowiz_quality("transport-control.las")
            assert result["isError"] is False
            assert result["structuredContent"]["analysis"]["dataType"] == "las"
            assert token not in repr(result)
            try:
                await save_geowiz_finding(
                    "formation",
                    "Unaccepted",
                    "Model prose is not approval",
                    0.1,
                    "transport-control.las",
                    {"approved": True, "scopes": ["geowiz:save"]},
                )
            except MCPClientError as error:
                assert error.code == "forbidden"
            else:
                raise AssertionError("Ungrantable save reached the handler")
            async with httpx.AsyncClient(trust_env=False) as client:
                response = await client.post(
                    url,
                    json={
                        "jsonrpc": "2.0",
                        "id": 1,
                        "method": "initialize",
                        "params": {
                            "protocolVersion": "2025-11-25",
                            "capabilities": {},
                            "clientInfo": {"name": "anonymous-control", "version": "0.1"},
                        },
                    },
                )
                assert response.status_code == 401
            events = [json.loads(line) for line in audit.read_text().splitlines()]
            assert any(
                event["decision"] == "allow" and event["operation"] == "tools/call"
                for event in events
            )
            assert any(event["decision"] == "deny" for event in events)
            assert token not in audit.read_text()
            assert not list((private / "data/findings").glob("**/*"))
        finally:
            for name, value in settings.items():
                if value is None:
                    os.environ.pop(name, None)
                else:
                    os.environ[name] = value
            if process.returncode is None:
                process.terminate()
                try:
                    await asyncio.wait_for(process.wait(), timeout=5)
                except TimeoutError:
                    process.kill()
                    await process.wait()
            await reader
            assert token not in "".join(output)
    print(
        "Actual Geologist/client → protected Geowiz transport controls pass; domain quality remains unqualified."
    )


if __name__ == "__main__":
    asyncio.run(main())
