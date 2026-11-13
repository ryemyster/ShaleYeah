"""Adapt actual ADK events to Agent Platform's narrower trace event contract."""

import argparse
import copy
import json
import os
from pathlib import Path


def convert(case):
    value = copy.deepcopy(case)
    for index, turn in enumerate(value["agent_data"]["turns"]):
        turn["turn_index"] = index
        # Preserve the actual calls, arguments, responses and final text. ADK's
        # invocation IDs/actions/usage fields belong to its own event contract;
        # Agent Platform rejects them as extra AgentEvent fields.
        turn["events"] = [
            {"author": event["author"], "content": event.get("content")}
            for event in turn["events"]
        ]
    return value


def export(source, destination):
    source, destination = Path(source), Path(destination)
    files = sorted(source.glob("*.json"))
    if {file.name for file in files} != {"gemini.json", "anthropic.json"}:
        raise ValueError("Both native provider traces are required")
    destination.mkdir(mode=0o700, parents=True, exist_ok=False)
    for file in files:
        cases = json.loads(file.read_text())["eval_cases"]
        if len(cases) != 1:
            raise ValueError("One exact native task per provider is required")
        descriptor = os.open(destination / file.name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        with os.fdopen(descriptor, "w") as handle:
            json.dump({"eval_cases": [convert(cases[0])]}, handle, allow_nan=False)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source")
    parser.add_argument("destination", help="New output directory for this exact trace run")
    args = parser.parse_args()
    export(args.source, args.destination)
