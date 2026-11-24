# How It Works

The Infrastructure Planner turns a development concept into a surface and midstream feasibility analysis.

## Flow

1. A user or another agent provides project location, well count, production assumptions, phasing, water-handling needs, surface constraints, or commercial constraints.
2. The ADK agent identifies the requested infrastructure work and missing inputs.
3. The agent calls the matching Infrastructure MCP tool over HTTP.
4. The MCP backend returns structured pipeline, facility, cost, or compliance output.
5. The agent summarizes the result, separates assumptions from tool output, and states what requires human review.

## Outputs

- Pipeline or gathering strategy with takeaway-risk notes.
- Facility sizing for batteries, separators, compression, and saltwater disposal.
- Infrastructure CAPEX estimate with assumptions and confidence limits.
- Compliance and permitting risk summary.
- Missing-input checklist and human-review deferrals.

## Data Limits

Public maps, GIS sources, pipeline capacity data, and permitting sources can be stale or incomplete. The agent should preserve provenance and data vintage when available and avoid treating public GIS output as survey-grade truth.
