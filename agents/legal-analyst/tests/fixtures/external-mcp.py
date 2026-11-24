"""Independent compatible MCP fixture; no employee/backend implementation imports.

It checks transport/tool replacement, not this peer's legal correctness, source
rights or human-review implementation.
"""

import json
import sys
from pathlib import Path
from typing import Any

from mcp.server import MCPServer
from mcp.server.mcpserver import Context

settings = json.loads(Path(sys.argv[1]).read_text())
token = Path(settings["tokenFile"]).read_text().strip()
server = MCPServer("independent-legal-fixture")


@server.tool(structured_output=True)
def draft_legal_memo(
    taskRef: dict[str, Any], proposal: dict[str, Any], revision: str, ctx: Context
) -> dict[str, Any]:
    assert ctx.headers.get("authorization") == "Bearer " + token
    assert taskRef == {"id": "task.legal", "revision": "r1"}
    assert proposal == settings["proposal"] and revision == "r1"
    return {
        "success": True,
        "analysis": {
            **settings["analysis"],
            "fixture": "compatible-external-legal",
            "taskRef": taskRef,
        },
    }


server.run(
    transport="streamable-http", host="127.0.0.1", port=settings["port"], stateless_http=True
)
