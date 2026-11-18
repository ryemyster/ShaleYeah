"""Read-only compatible external MCP fixture. Imports no SHALE YEAH code."""

import json
import sys
from pathlib import Path

from mcp.server import MCPServer
from mcp.server.mcpserver import Context

settings = json.loads(Path(sys.argv[1]).read_text())
token = Path(settings["tokenFile"]).read_text().strip()
server = MCPServer("external-geology-fixture")


@server.tool()
def assess_quality(filePath: str, dataType: str, thresholds: dict, ctx: Context) -> dict:
    assert ctx.headers.get("authorization") == "Bearer " + token
    assert dataType == "las"
    return {
        "success": True,
        "analysis": {"fixture": "compatible-external-mcp", "dataType": dataType},
    }


server.run(transport="streamable-http", host="127.0.0.1", port=settings["port"], stateless_http=True)
