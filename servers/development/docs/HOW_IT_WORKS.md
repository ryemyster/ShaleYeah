# How Development Works

The Development server gives callers structured tools for planning and tracking oil and gas field development work.

The ADK agent decides what the user is asking for. This server executes the requested MCP tool and returns structured output.

## Tools

| Tool | What it does |
|------|--------------|
| `create_development_plan` | Builds a draft development plan with project, development, resources, economics, confidence, and outlook sections |
| `estimate_project_timeline` | Builds a phase timeline and strategy from project name, well count, budget, and constraints |
| `monitor_development_progress` | Builds a progress report for a project and reporting period |

## Request Lifecycle

```text
MCP caller
  -> tool name plus JSON arguments
  -> validation in src/index.ts
  -> domain helper in src/tools/
  -> optional callLLM synthesis
  -> deterministic fallback if LLM is unavailable
  -> structured MCP response
```

## Fallback Behavior

Fallbacks are deterministic. They should return useful planning output without pretending to have live project data. If the user needs final approvals, current execution authority, or verified field status, the ADK agent must defer to human review.
