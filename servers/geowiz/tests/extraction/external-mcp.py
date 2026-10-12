"""Read-only compatible external MCP fixture. Imports no SHALE YEAH code."""

import json
import sys
from pathlib import Path

from mcp.server.fastmcp import Context, FastMCP

settings = json.loads(Path(sys.argv[1]).read_text())
token = Path(settings["tokenFile"]).read_text().strip()
server = FastMCP("external-geology-fixture", host="127.0.0.1", port=settings["port"])


@server.tool()
def assess_quality(filePath: str, dataType: str, thresholds: dict, ctx: Context) -> dict:
    assert ctx.request_context.request.headers.get("authorization") == "Bearer " + token
    assert dataType == "las"
    return {
        "success": True,
        "analysis": {"fixture": "compatible-external-mcp", "dataType": dataType},
    }


server.run(transport="streamable-http")
