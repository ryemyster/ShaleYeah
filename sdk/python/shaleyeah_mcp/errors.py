from typing import Literal

Category = Literal["auth_required", "user_action", "retryable", "permanent"]
_MESSAGES = {
    "invalid_endpoint": "Invalid MCP endpoint: use HTTPS or explicit loopback development HTTP",
    "invalid_configuration": "Invalid bounded MCP client configuration",
    "authentication_required": "MCP authentication requires a valid dedicated credential",
    "forbidden": "MCP access is forbidden by the configured policy",
    "redirect_denied": "MCP endpoint redirect denied",
    "connection_failed": "MCP connection failed within the preflight budget",
    "timeout": "MCP call exceeded its timeout",
    "unsupported_protocol": "MCP negotiated an unsupported protocol profile",
    "invalid_input": "Invalid MCP input arguments",
    "invalid_input_schema": "Invalid MCP input arguments schema",
    "invalid_output_schema": "Invalid MCP output result schema",
    "invalid_result": "Invalid MCP output result or structured content",
    "missing_structured": "MCP output schema requires structuredContent",
    "conflicting_result": "MCP structured and JSON text results conflict",
    "missing_tool": "MCP tool was not advertised",
    "ambiguous_tool": "MCP tool discovery is ambiguous",
    "repeated_cursor": "MCP tool discovery cursor repeated",
    "discovery_limit": "MCP tool discovery exceeded 32 pages",
    "nesting_limit": "Legacy MCP result nesting exceeded supported depth",
    "protocol_error": "MCP protocol request failed",
}


class MCPClientError(RuntimeError):
    """Safe classified failure; a possibly dispatched operation is never silently replayed."""

    def __init__(
        self, code: str, category: Category = "permanent", *, effect_unknown: bool = False
    ):
        self.code = code
        self.category = category
        self.effect_unknown = effect_unknown
        super().__init__(_MESSAGES.get(code, "MCP client failed"))
