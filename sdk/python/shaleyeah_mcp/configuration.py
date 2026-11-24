"""Host configuration for role callers; credentials are resolved only at dispatch."""

import os
from pathlib import Path

from .client import FileBearerCredential, MCPClientConfig
from .errors import MCPClientError


async def _missing_credential() -> str:
    raise MCPClientError("authentication_required", "auth_required")


def load_mcp_config(prefix: str, default_endpoint: str) -> MCPClientConfig:
    """Read PREFIX_MCP_URL, private token-file reference and bounded timeouts."""
    if (
        not isinstance(prefix, str)
        or not 1 <= len(prefix) <= 64
        or not prefix.isascii()
        or not "A" <= prefix[0] <= "Z"
        or any(not ("A" <= char <= "Z" or "0" <= char <= "9" or char == "_") for char in prefix)
    ):
        raise MCPClientError("invalid_configuration", "user_action")
    reference = os.environ.get(f"{prefix}_MCP_ACCESS_TOKEN_FILE")
    credential = FileBearerCredential(Path(reference)) if reference else _missing_credential
    try:
        total_timeout = float(os.environ.get(f"{prefix}_MCP_TIMEOUT_SECONDS", "30"))
        request_timeout = float(os.environ.get(f"{prefix}_MCP_REQUEST_TIMEOUT_SECONDS", "10"))
    except ValueError:
        raise MCPClientError("invalid_configuration", "user_action") from None
    return MCPClientConfig(
        endpoint=os.environ.get(f"{prefix}_MCP_URL", default_endpoint),
        credential=credential,
        allow_loopback_http=True,
        total_timeout=total_timeout,
        request_timeout=request_timeout,
    )
