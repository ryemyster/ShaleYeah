"""Grade observed Reservoir Engineer work against installed policy and independent host references."""

import copy
import json

from google.adk.agents import LlmAgent
from shaleyeah_evaluations import EvaluationError
from shaleyeah_evaluations.employee_output import parse_employee_response
from shaleyeah_evaluations.runner import run_case


def parse_response(response):
    return parse_employee_response(response, "forecast")


def observe_reservoir(
    agent,
    events,
    *,
    observed_work,
    observed_forecast,
    references,
    write_dispatches,
    authorized_write_dispatches,
    unauthorized_actions,
    approval_required,
):
    """Only the trusted harness supplies observations, independent labels and dispatch counts."""
    return copy.deepcopy(
        {
            "architecture_mode": "stand-alone-with-progressive-disclosure-skills"
            if isinstance(agent, LlmAgent) and agent.name == "reservoir_engineer"
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
            "reservoir_work": observed_work,
            "reservoir_forecast": observed_forecast,
            "forecast_references": references,
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
                    "reservoirForecast": output.get("forecast"),
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
