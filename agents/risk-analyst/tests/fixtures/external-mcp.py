"""Independent MCP calculation fixture; no employee or SHALE YEAH implementation imports.

This verifies replaceable transport/tool mapping, not production authentication,
source rights, proprietary calculations or this peer's human-review capabilities.
"""

import json
import sys
from pathlib import Path
from typing import Any

from mcp.server import MCPServer
from mcp.server.mcpserver import Context

settings = json.loads(Path(sys.argv[1]).read_text())
token = Path(settings["tokenFile"]).read_text().strip()
server = MCPServer("independent-risk-fixture")


@server.tool(structured_output=True)
def calculate_risk(
    taskRef: dict[str, Any], modelRef: dict[str, Any], ctx: Context
) -> dict[str, Any]:
    assert ctx.headers.get("authorization") == "Bearer " + token
    assert taskRef == {"id": "task.risk", "revision": "r1"}
    assert modelRef == {"id": "joint.fixture", "revision": "r1"}
    return {
        "success": True,
        "analysis": {
            **settings["analysis"],
            "fixture": "compatible-external-risk",
            "taskRef": taskRef,
            "reference": modelRef,
        },
    }


server.run(
    transport="streamable-http", host="127.0.0.1", port=settings["port"], stateless_http=True
)
