/**
 * Legal Analyst Agent — stub, migration tracked in issue #370
 *
 * Implementation guide: .claude/rules/agent-template.md
 * Reference implementation: agents/geologist/src/agent/index.ts
 *
 * When implemented:
 *   src/agent/index.ts           — manifest + config + handlers + runLegalAnalystTask
 *   src/agent/legal-client.ts    — callLegalTool (copy geowiz-client.ts, rename)
 *   tests/mcp-client.test.ts     — copy geologist mcp-client.test.ts
 *   tests/agent.test.ts          — copy geologist agent.test.ts
 *
 * Target server: legal (servers/legal, default port 3006)
 * Env var: LEGAL_MCP_URL
 */

export const AGENT_ID = "legal-analyst";

// Uncomment and switch to this export once src/agent/index.ts is implemented:
// export * from "./agent/index.js";
