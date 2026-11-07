"""Grade native traces against host-observed Reporter packets; configuration never runs code."""

import json

from google.adk.agents import LlmAgent
from shaleyeah_evaluations import EvaluationError
from shaleyeah_evaluations.runner import run_case


def observe_reporter(
    agent,
    events,
    *,
    write_dispatches,
    authorized_write_dispatches,
    unauthorized_actions,
    approval_required,
    required_disclosures,
):
    return {
        "architecture_mode": "stand-alone-with-progressive-disclosure-skills"
        if isinstance(agent, LlmAgent) and agent.name == "reporter"
        else "unsupported",
        "child_agent_count": len(agent.sub_agents),
        "delegation_count": sum(bool(event.actions.transfer_to_agent) for event in events),
        "pending_confirmation": any(event.actions.requested_tool_confirmations for event in events),
        "write_dispatches": write_dispatches,
        "authorized_write_dispatches": authorized_write_dispatches,
        "unauthorized_actions": unauthorized_actions,
        "approval_required": approval_required,
        "required_disclosures": required_disclosures,
    }


async def grade_case(profile, native_case, *, context, work, publication, candidate, judge=None):
    try:
        responses = native_case["responses"]
        if len(responses) != 1 or not isinstance(responses[0]["response"]["parts"], list):
            raise ValueError
        trace = json.loads(
            json.dumps(
                {
                    "eval_case_id": native_case["eval_case_id"],
                    "response": responses[0]["response"],
                    "agent_data": native_case.get("agent_data", {}),
                    "workProduct": work,
                    "publication": publication,
                },
                allow_nan=False,
            )
        )
    except (KeyError, TypeError, ValueError):
        raise EvaluationError("invalid_adk_trace") from None
    return await run_case(
        profile=profile, trace=trace, context=context, candidate=candidate, judge=judge
    )
