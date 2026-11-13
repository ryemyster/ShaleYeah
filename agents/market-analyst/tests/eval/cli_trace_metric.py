"""Supplementary agents-cli trace fidelity; installed job qualification remains mandatory."""

import json


def pairs(items):
    value = {}
    for key, item in items:
        if key in value:
            raise ValueError("ambiguous_output")
        value[key] = item
    return value


def evaluate(instance):
    try:
        actual = json.loads(
            "".join(p["text"] for p in instance["response"]["parts"]), object_pairs_hook=pairs
        )
        expected = json.loads(
            "".join(p["text"] for p in instance["reference"]["response"]["parts"]),
            object_pairs_hook=pairs,
        )
        calls = {
            p["function_call"]["name"]
            for turn in instance["agent_data"]["turns"]
            for event in turn["events"]
            for p in (event.get("content") or {}).get("parts", [])
            if p.get("function_call")
        }
        passed = (
            set(actual) == set(expected) == {"work", "market"}
            and json.dumps(actual, sort_keys=True, allow_nan=False)
            == json.dumps(expected, sort_keys=True, allow_nan=False)
            and {
                "read_market_inputs",
                "read_market_source",
                "calculate_market_scenarios",
                "draft_market_scenario",
                "prepare_market_review",
            }
            <= calls
        )
    except (KeyError, TypeError, ValueError):
        passed = False
    return {
        "score": 1.0 if passed else 0.0,
        "explanation": "Exact returned market scenario packet and native tool trajectory",
    }
