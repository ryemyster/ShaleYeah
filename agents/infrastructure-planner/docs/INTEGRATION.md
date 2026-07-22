# Integration Guide

Integrate with this package as an ADK agent. Keep direct backend execution in `servers/infrastructure`.

## MCP Pairing

Set the backend URL for live tool calls:

```bash
INFRASTRUCTURE_MCP_URL=http://localhost:3012
```

The Python wrappers call these MCP tools:

| Tool | Required inputs |
|------|-----------------|
| `plan_pipeline` | `wellCount`, `expectedProduction`, `location` |
| `size_facilities` | `wellCount`, `expectedProduction`, `location` |
| `estimate_costs` | `wellCount`, `compressors`, `swdWells`, `location` |
| `assess_compliance` | `wellCount`, `location`; optional `environmentalConstraints` |

## Typical Inputs

- Basin, county, state, coordinates, lease, tract, pad, or well locations.
- Well count, production, fluid mix, peak/average rates, and phasing.
- Existing or proposed gathering, processing, compression, disposal, road, power, and interconnect context.
- Facility, water, legal/title, surface, ROW, environmental, and commercial constraints.

## Typical Outputs

- Pipeline/gathering plan and takeaway-risk summary.
- Facility sizing recommendation.
- Infrastructure CAPEX estimate.
- Permitting, safety, environmental, ROW, and compliance risk summary.
- Missing-input list and human-review boundary.
