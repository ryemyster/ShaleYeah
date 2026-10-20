"""Strict financial output contract shared by installed graders and independent verifiers."""

import json

from . import EvaluationError


def parse_response(response):
    """Read the actual final output; a caller cannot substitute backend work for it."""
    try:
        parts = response["parts"]
        if type(parts) is not list or not parts:
            raise ValueError
        chunks, size = [], 0
        for part in parts:
            if type(part) is not dict:
                raise ValueError
            if part.get("thought") is True:
                continue
            if (
                type(part.get("text")) is not str
                or part.get("function_call") is not None
                or part.get("function_response") is not None
            ):
                raise ValueError
            size += len(part["text"].encode())
            if size > 1_000_000:
                raise ValueError
            chunks.append(part["text"])

        def pairs(items):
            value = {}
            for key, item in items:
                if key in value:
                    raise ValueError
                value[key] = item
            return value

        def constant(_):
            raise ValueError

        value = json.loads("".join(chunks), object_pairs_hook=pairs, parse_constant=constant)
        json.dumps(value, allow_nan=False)
        if type(value) is not dict:
            raise ValueError
        if (
            set(value) == {"deferred"}
            and type(value["deferred"]) is str
            and 1 <= len(value["deferred"].strip()) <= 2048
        ):
            return value
        if set(value) != {"work", "scenario"} or any(type(value[key]) is not dict for key in value):
            raise ValueError
        return value
    except (KeyError, TypeError, ValueError, RecursionError):
        raise EvaluationError("invalid_employee_output") from None
