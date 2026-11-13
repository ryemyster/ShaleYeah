"""Independent compatible MCP fixture; no employee/backend implementation imports.

It checks transport/tool replacement, not this peer's market correctness, source
rights or human-review implementation.
"""

import json
import sys
from pathlib import Path
from typing import Any

import uvicorn
from mcp.server import MCPServer
from mcp.server.mcpserver import Context
from starlette.responses import JSONResponse

settings = json.loads(Path(sys.argv[1]).read_text())
token = Path(settings["tokenFile"]).read_text().strip()
server = MCPServer("independent-market-fixture")


class FixtureBearerGate:
    """Require the fixture's transport credential before protocol discovery or dispatch."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and dict(scope["headers"]).get(b"authorization") != (
            "Bearer " + token
        ).encode():
            await JSONResponse({"error": "authentication_required"}, status_code=401)(
                scope, receive, send
            )
            return
        await self.app(scope, receive, send)


@server.tool(structured_output=True)
def draft_market_scenario(
    taskRef: dict[str, Any], proposal: dict[str, Any], revision: str, ctx: Context
) -> dict[str, Any]:
    assert ctx.headers.get("authorization") == "Bearer " + token
    assert taskRef == {"id": "task.market", "revision": "r1"}
    assert proposal == settings["proposal"] and revision == "r1"
    return {
        "success": True,
        "analysis": {
            **settings["analysis"],
            "fixture": "compatible-external-market",
            "taskRef": taskRef,
        },
    }


uvicorn.run(
    FixtureBearerGate(server.streamable_http_app(stateless_http=True)),
    host="127.0.0.1",
    port=settings["port"],
)
