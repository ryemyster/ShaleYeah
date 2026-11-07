# Integration Guide - Legal Analyst ADK Agent

Integrate Legal Analyst through its ADK package.

## Local ADK Invocation

```bash
cd agents/legal-analyst
LEGAL_MCP_URL=http://localhost:3006/mcp LEGAL_MCP_ACCESS_TOKEN_FILE=/path/to/private/mcp-token agents-cli run \
  "Review a farmout agreement for assignment consent, drilling commitment, indemnity, and default remedies"
```

## Backend Contract

The ADK tools map to the current Legal MCP server tools:

| ADK wrapper | MCP tool |
|-------------|----------|
| `analyze_legal_framework` | `analyze_legal_framework` |
| `review_contract` | `review_contract` |
| `assess_compliance` | `assess_compliance` |

The MCP backend URL comes from `LEGAL_MCP_URL`. The default is `http://localhost:3006/mcp`.

## Orchestration Boundary

An orchestrator may call the ADK app as a standalone agent unit. It should not import internal Python functions as shared library APIs. Shared contracts belong in `sdk/`; Legal execution stays behind `servers/legal`.

## Human/Legal Review

Downstream systems must treat legal opinions, redlines, filings, regulatory submissions, signatures, waivers, settlement positions, enforcement decisions, and binding approvals as human/legal-review actions. Legal Analyst can provide supporting analysis only.

## Connection profile

This caller uses MCP 2026-07-28 with self-contained requests, fresh tool discovery and validated results. Set the private credential-file reference shown above; model keys and MCP credentials serve different purposes. The backend must configure permitted identities/scopes and required audit before opening HTTP. Old initialized servers are outside this selected profile. Keep caller credentials separate from any model or third-party source credentials.
