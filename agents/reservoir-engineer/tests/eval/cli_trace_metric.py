"""Supplementary agents-cli trace fidelity; installed job qualification remains mandatory."""

import json


def evaluate(instance):
    try:
        actual = json.loads("".join(p["text"] for p in instance["response"]["parts"]))
        expected = json.loads(
            "".join(p["text"] for p in instance["reference"]["response"]["parts"])
        )
        calls = {
            p["function_call"]["name"]
            for turn in instance["agent_data"]["turns"]
            for event in turn["events"]
            for p in (event.get("content") or {}).get("parts", [])
            if p.get("function_call")
        }
        passed = (
            actual == expected
            and {
                "read_forecast_inputs",
                "read_forecast_source",
                "draft_forecast",
                "prepare_forecast_review",
            }
            <= calls
        )
    except (KeyError, TypeError, ValueError):
        passed = False
    return {
        "score": 1.0 if passed else 0.0,
        "explanation": "Exact returned forecast packet and native tool trajectory",
    }
