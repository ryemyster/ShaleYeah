import json
from typing import Any

from jsonschema import SchemaError, ValidationError
from jsonschema.validators import validator_for

from .errors import MCPClientError


def validate_schema(value: Any, schema: dict[str, Any], label: str) -> None:
    try:
        if not isinstance(schema, dict):
            raise SchemaError("Schema must be an object")
        validator = validator_for(schema)
        validator.check_schema(schema)
        validator(schema).validate(value)
    except SchemaError:
        raise MCPClientError(f"invalid_{label}_schema") from None
    except ValidationError:
        raise MCPClientError(
            "invalid_input" if label == "input" else "invalid_result",
            "user_action" if label == "input" else "permanent",
        ) from None


async def discover_tool(session: Any, name: str) -> Any:
    cursor = None
    selected = None
    seen_cursors: set[str] = set()
    for _ in range(32):
        page = await session.list_tools(**({"cursor": cursor} if cursor else {}))
        matches = [tool for tool in page.tools if tool.name == name]
        if len(matches) > 1 or (matches and selected is not None):
            raise MCPClientError("ambiguous_tool")
        if matches:
            selected = matches[0]
        cursor = getattr(page, "nextCursor", None)
        if cursor is None:
            if selected is not None:
                return selected
            raise MCPClientError("missing_tool")
        if not isinstance(cursor, str) or not cursor or len(cursor) > 512:
            raise MCPClientError("protocol_error")
        if cursor in seen_cursors:
            raise MCPClientError("repeated_cursor")
        seen_cursors.add(cursor)
    raise MCPClientError("discovery_limit")


def legacy_failure(payload: Any, depth: int = 0) -> bool:
    if not isinstance(payload, dict):
        return False
    if depth > 3:
        raise MCPClientError("nesting_limit")
    if payload.get("success") is False:
        return True
    if payload.get("error_type") in (
        "auth_required",
        "user_action",
        "retryable",
        "permanent",
    ) and isinstance(payload.get("error"), (str, dict)):
        return True
    # Only documented legacy success wrappers are inspected, not arbitrary domain fields.
    if payload.get("success") is True:
        return any(legacy_failure(payload.get(key), depth + 1) for key in ("data", "analysis"))
    return False


def read_result(result: Any, output_schema: dict[str, Any] | None) -> dict[str, Any]:
    content = []
    for item in result.content:
        block = item.model_dump(mode="json") if hasattr(item, "model_dump") else item
        if not isinstance(block, dict) or not isinstance(block.get("type"), str):
            raise MCPClientError("invalid_result")
        content.append(block)
    structured = getattr(result, "structuredContent", None)
    is_error = getattr(result, "isError", False)
    if not isinstance(is_error, bool):
        raise MCPClientError("invalid_result")
    json_values = []
    for block in content:
        if block.get("type") == "text":
            try:
                json_values.append(json.loads(block["text"]))
            except (ValueError, KeyError, TypeError):
                pass
    if structured is not None:
        if not isinstance(structured, dict):
            raise MCPClientError("invalid_result")
        if any(value != structured for value in json_values):
            raise MCPClientError("conflicting_result")
        is_error = is_error or legacy_failure(structured)
    else:
        is_error = is_error or any(legacy_failure(value) for value in json_values)
    if not is_error and output_schema is not None:
        if structured is None:
            raise MCPClientError("missing_structured")
        validate_schema(structured, output_schema, "output")
    return {"content": content, "structuredContent": structured, "isError": is_error}
