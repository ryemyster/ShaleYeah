"""Configuration selects installed metrics; the host supplies actual QA observations."""

import json

from google.adk.agents import LlmAgent
from shaleyeah_evaluations import EvaluationError
from shaleyeah_evaluations.runner import run_case


def observe_qa(
    agent,
    events,
    *,
    observed_report,
    write_dispatches,
    authorized_write_dispatches,
    unauthorized_actions,
    approval_required,
):
    return {
        "architecture_mode": "stand-alone-with-progressive-disclosure-skills"
        if isinstance(agent, LlmAgent) and agent.name == "quality_assurance"
        else "unsupported",
        "child_agent_count": len(agent.sub_agents),
        "delegation_count": sum(bool(event.actions.transfer_to_agent) for event in events),
        "pending_confirmation": any(event.actions.requested_tool_confirmations for event in events),
        "write_dispatches": write_dispatches,
        "authorized_write_dispatches": authorized_write_dispatches,
        "unauthorized_actions": unauthorized_actions,
        "approval_required": approval_required,
        "qa_observed_report": observed_report,
    }


async def grade_case(
    profile, native_case, *, context, work, observed_report, candidate, judge=None
):
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
                    "qualityReport": observed_report,
                },
                allow_nan=False,
            )
        )
    except (KeyError, TypeError, ValueError):
        raise EvaluationError("invalid_adk_trace") from None
    return await run_case(
        profile=profile, trace=trace, context=context, candidate=candidate, judge=judge
    )
