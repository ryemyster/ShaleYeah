"""Compatible external fixture with no employee or SHALE YEAH implementation imports."""

import json
import sys
from pathlib import Path
from typing import Any

from mcp.server.fastmcp import Context, FastMCP

settings = json.loads(Path(sys.argv[1]).read_text())
token = Path(settings["tokenFile"]).read_text().strip()
server = FastMCP("external-reporting-fixture", host="127.0.0.1", port=settings["port"])


@server.tool(structured_output=True)
def draft_report(
    sourceIds: list[str], requirements: dict[str, Any], ctx: Context
) -> dict[str, Any]:
    assert ctx.request_context.request.headers.get("authorization") == "Bearer " + token
    return {
        "success": True,
        "analysis": {
            "fixture": "compatible-external-mcp",
            "sourceIds": sourceIds,
            "requirements": requirements,
        },
    }


server.run(transport="streamable-http")
