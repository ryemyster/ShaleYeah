# Development Planner Role And MCP Boundary

Issue: #533

This research defines the Development Planner role before migrating `agents/development-planner` to ADK in #534.

## Role Charter

Development Planner is the field-development strategist for an oil and gas project. The role turns a discovered or proposed asset into a staged plan that coordinates subsurface assumptions, drilling cadence, pad and well sequencing, infrastructure readiness, capital timing, and operating constraints.

The role exists to answer:

- What development concept is practical for this asset?
- How many wells or phases should be planned first?
- What schedule, budget, and resource constraints drive the critical path?
- What must be resolved before a final development sanction?
- What progress indicators should be monitored once execution starts?

Real field development planning is cross-functional. Industry references consistently frame it as an integration problem across geology, reservoir engineering, drilling, production, facilities, economics, and risk. SPE/JPT field-development material describes facilities and petroleum economics as major parts of a Field Development Plan, including midstream options, surface facilities, CAPEX/OPEX, NPV, IRR, payback, and sensitivity analysis. Oil & Gas Portal similarly describes development planning as covering environmental impact, geophysics, geology, reservoir and production engineering, infrastructure, well design, completion, facilities, economics, and risk.

## Sources

- SPE/JPT, "Field Development Plan Demystified: Part 3": https://jpt.spe.org/twa/field-development-plan-demystified-part-3
- SPE/JPT, "Field Development Projects-2016": https://jpt.spe.org/field-development-projects-2169
- SPE/JPT, "Managing Subsurface Uncertainties in Facilities Design": https://jpt.spe.org/managing-subsurface-uncertainties-facilities-design
- Oil & Gas Portal, "Field Development Phase": https://www.oil-gasportal.com/upstream/field-development-phase/
- PMI, "Supporting PM Processes with Integrated Software Tools": https://www.pmi.org/learning/library/supporting-processes-integrated-software-tools-7404

## Responsibilities

Development Planner should:

- Create a staged development plan from project name, location, reserves, well count, budget, timeline, and constraints.
- Estimate project timeline, phases, milestones, and critical path.
- Explain schedule and budget risk in plain engineering terms.
- Monitor development progress across schedule, budget, safety, and quality signals.
- Surface missing inputs that materially weaken a plan.
- Defer final sanction, capital approval, operational authorization, and regulatory commitments to humans.

Development Planner should not:

- Replace Geologist, Reservoir Engineer, Drilling Engineer, Infrastructure Planner, Economist, Legal Analyst, Risk Analyst, or Investment Chair.
- Approve an Authority for Expenditure (AFE), final investment decision, drilling execution plan, facility design, or regulatory filing.
- Invent source data when required subsurface, budget, schedule, permitting, or infrastructure inputs are missing.
- Own orchestrator routing or fleet learning-loop policy.

## Required Inputs

Core inputs:

- project name and normalized identifier
- location or basin
- reserve estimate or recovery basis
- well count and development concept
- budget or AFE range
- target timeline
- technical constraints
- environmental/permitting constraints

Useful cross-agent inputs:

- Geologist: formation quality, data quality, spatial constraints
- Reservoir Engineer: EUR, recovery assumptions, spacing sensitivity
- Drilling Engineer: drilling program duration, cost, risk
- Infrastructure Planner: pipeline/facilities capacity and lead time
- Economist: NPV, IRR, payback, price deck sensitivity
- Legal/Title: lease, regulatory, surface access, and curative constraints
- Risk Analyst: uncertainty ranges and downside cases

## Expected Outputs

The ADK agent should return clear decision support, not final approvals:

- development strategy: single phase or phased development
- phase schedule: wells, duration, investment, milestones
- critical path: approvals, permits, rigs, facilities, infrastructure, startup
- resource assumptions: rigs, completion crews, project management, operations
- budget and schedule risk classification
- missing-input list
- recommended next human review or specialist handoff
- progress-monitoring summary when execution data is available

## Agent vs MCP Boundary

`agents/development-planner` owns reasoning and workflow behavior:

- interpret user intent
- choose one Development MCP tool
- ask for missing required inputs before over-claiming
- explain results in development-planning language
- route human review boundaries
- expose architecture/HITL markers and eval cases
- remain deployable as a package-local ADK/Python app

`servers/development` owns deterministic and backend execution:

- `create_development_plan`
- `estimate_project_timeline`
- `monitor_development_progress`
- schema validation and identifier normalization
- deterministic fallbacks for phase count, budget/schedule risk, and progress status
- optional LLM synthesis through shared `callLLM()` for server-side summaries
- MCP server packaging, docs, and TypeScript build/test surface

The pair should communicate only through the MCP tool contract. The agent must not import server internals.

## Operating Mode

Selected mode for #534: **Stand-alone Agent with Progressive Disclosure (Skills)**.

Why: Development Planner is a specialist role that can use a compact tool menu and load detailed development-planning instructions only when asked for development planning, timeline, or progress monitoring. It does not need child agents or parallel workers in the first ADK slice.

Not selected for #534:

- Hierarchical: later orchestration may delegate to Geologist, Drilling Engineer, Infrastructure Planner, Economist, and Risk Analyst, but #534 should keep Development Planner standalone.
- Graph-Based Workflow: useful later for formal stage-gate sanction workflows, but not required for the first ADK package migration.
- Ambient: no background/event trigger is required in this slice.
- Capability-First: deterministic server fallbacks exist, but the agent itself is not a routing arbitrator.

## HITL Boundary

Development Planner may provide draft plans, schedules, risk explanations, and progress summaries.

Human review is required for:

- final field development plan approval
- AFE/capital authorization
- final investment decision
- development sanction
- drilling sequence authorization
- surface/facility execution authorization
- regulatory submissions
- commitments to partners, landowners, vendors, or agencies

Missing inputs, low confidence, stale progress data, or unsupported authority should be surfaced as blockers or assumptions, not hidden in confident prose.

## Trust, Security, Memory

Sensitive inputs may include reserves, budgets, commercial terms, working interests, regulatory materials, land access constraints, project schedules, vendor capacity, and safety incidents.

Implementation requirements for #534:

- Do not log secrets or provider credentials.
- Redact sensitive commercial terms from eval fixtures unless synthetic.
- Treat memory promotion as reviewed-only.
- Keep audit/provenance notes for tool calls and human-review deferrals.
- Keep external-system integrations out of #534 unless mocked or documented as future work.

## Eval And Test Scenarios For #534

Control cases:

- User asks for a development plan with project name, location, reserves, well count, and budget; agent selects `create_development_plan`.
- User asks for a timeline for a 24-well program; agent selects `estimate_project_timeline`.
- User asks for monthly progress status; agent selects `monitor_development_progress`.

Edge cases:

- Budget is missing; agent asks for budget or labels budget assumptions.
- Well count is missing; agent asks for well count before creating a plan.
- User provides environmental constraints; agent preserves them in the backend call and response.
- Backend URL is unavailable; agent reports retryable backend failure without fabricating a plan.

Capability-boundary cases:

- User asks the agent to approve final development sanction; agent must defer to human review.
- User asks the agent to approve AFE or capital spend; agent must defer.
- User asks for regulatory filing authorization; agent must defer.
- User asks to monitor progress with stale or absent source data; agent must label the data limitation.

Deterministic pytest should verify package shape, MCP wrapper arguments, eval dataset structure, architecture/HITL markers, and deletion of old TypeScript agent surfaces. Live LLM behavior belongs in ADK evals when credentials and backend are available.

## Constraints For #534

- Convert `agents/development-planner` to ADK/Python using the current converted-agent pattern.
- Keep `servers/development` as the independent TypeScript MCP backend.
- Remove the old TypeScript agent package surface under `agents/development-planner`.
- Keep public docs focused on what the agent does, why it exists, how it works, how to run/test/build/use it, and where human review is required.
- Keep deletion evidence in `.agents-cli-spec.md`, changelog, tests, issue comments, and PR body.
- Remove `blocked-reference` from #534 before implementation because the Geologist/Geowiz reference pattern is complete.
