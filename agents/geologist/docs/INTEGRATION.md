# Integration — Geologist ADK Agent

Geowiz HTTP now requires configured identity/scopes and dedicated credentials.
Use [backend access setup](../../../servers/geowiz/docs/HTTP_ACCESS.md).
The current copied Python wrapper needs #679's credential/destination integration
before live connection; package checks remain available independently.

Integrate with Geologist through the ADK project in `agents/geologist`.

## Local ADK Invocation

```bash
cd agents/geologist
GEOWIZ_MCP_URL=http://127.0.0.1:3001/mcp agents-cli run \
  "Use process_geowiz_gis to analyze acreage.geojson with oil and gas context"
```

## Backend Contract

The agent calls the Geowiz-compatible MCP backend configured by `GEOWIZ_MCP_URL`.

| Backend tool | Agent wrapper |
|--------------|---------------|
| `analyze_formation` | `analyze_geowiz_formation` |
| `assess_quality` | `assess_geowiz_quality` |
| `process_well_logs` | `process_geowiz_well_logs` |
| `process_gis` | `process_geowiz_gis` |
| `process_access_database` | `process_geowiz_access_database` |
| `process_document` | `process_geowiz_document` |
| `process_seismic_data` | `process_geowiz_seismic_data` |
| `process_aries_database` | `process_geowiz_aries_database` |
| `save_finding` | `save_geowiz_finding` with ADK confirmation |

## Orchestrator Boundary

Future orchestration should call the ADK agent as a standalone unit. Keep task routing, fleet learning loops, and deployment control plane work outside this package unless an issue explicitly scopes it here.

## Server Integration

Claude Desktop and other MCP clients can connect directly to `servers/geowiz` for Tier 1 tool access. The Tier 2 Geologist behavior remains in ADK and uses the same backend URL.
