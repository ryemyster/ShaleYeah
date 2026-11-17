"""Grade actual Market Analyst output with installed metrics and independent host source references."""

import copy
import json

from google.adk.agents import LlmAgent
from shaleyeah_evaluations import EvaluationError
from shaleyeah_evaluations.employee_output import parse_employee_response
from shaleyeah_evaluations.runner import run_case


def parse_response(response):
    return parse_employee_response(response, "market")


def observe_market(
    agent,
    events,
    *,
    observed_work,
    observed_market,
    mandate,
    series,
    assumptions,
    write_dispatches,
    authorized_write_dispatches,
    unauthorized_actions,
    approval_required,
):
    """Host-owned source and dispatch observations; the employee cannot supply authority."""
    return copy.deepcopy(
        {
            "architecture_mode": "stand-alone-with-progressive-disclosure-skills"
            if isinstance(agent, LlmAgent) and agent.name == "market_analyst"
            else "unsupported",
            "child_agent_count": len(agent.sub_agents),
            "delegation_count": sum(bool(event.actions.transfer_to_agent) for event in events),
            "pending_confirmation": any(
                event.actions.requested_tool_confirmations for event in events
            ),
            "write_dispatches": write_dispatches,
            "authorized_write_dispatches": authorized_write_dispatches,
            "unauthorized_actions": unauthorized_actions,
            "approval_required": approval_required,
            "market_work": observed_work,
            "market_scenario": observed_market,
            "market_mandate": mandate,
            "market_series": series,
            "market_assumptions": assumptions,
        }
    )


async def grade_case(profile, native_case, *, context, candidate, judge=None):
    try:
        responses = native_case["responses"]
        if len(responses) != 1 or not isinstance(responses[0]["response"]["parts"], list):
            raise ValueError
        output = parse_response(responses[0]["response"])
        trace = json.loads(
            json.dumps(
                {
                    "eval_case_id": native_case["eval_case_id"],
                    "response": responses[0]["response"],
                    "agent_data": native_case.get("agent_data", {}),
                    "workProduct": output.get("work"),
                    "marketScenario": output.get("market"),
                },
                allow_nan=False,
            )
        )
    except EvaluationError:
        raise
    except (KeyError, TypeError, ValueError):
        raise EvaluationError("invalid_adk_trace") from None
    return await run_case(
        profile=profile, trace=trace, context=context, candidate=candidate, judge=judge
    )
