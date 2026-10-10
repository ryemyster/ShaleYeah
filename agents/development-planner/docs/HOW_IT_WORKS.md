# How It Works

The Development Planner helps a user think through how an oil and gas asset could be developed over time.

It collects or infers the planning task, identifies missing inputs, chooses a Development MCP tool, and turns the tool output into planning guidance. It should be explicit when the result is provisional.

## Main Inputs

Useful inputs include:

- project name and location
- reserves
- well count
- target schedule
- capital budget
- surface, environmental, regulatory, facility, or technical constraints
- progress metrics for active projects

If those inputs are missing, the agent should ask for them or explain the assumptions needed for a provisional answer.

## Tool Selection

| User Need | Tool |
|-----------|------|
| Draft a field-development plan | `create_development_plan` |
| Estimate phases, milestones, or schedule risk | `estimate_project_timeline` |
| Summarize active-project progress | `monitor_development_progress` |

The agent uses `plan_development_tool_call` to explain the intended backend call and the ADK-to-MCP boundary.

## Output Style

Good responses should:

- ground conclusions in tool output
- separate known facts from assumptions
- name missing inputs that affect confidence
- call out schedule, budget, infrastructure, and operating constraints
- defer final approval or authorization decisions to humans

The agent should not invent reserves, budgets, facility availability, regulatory status, or partner commitments.
