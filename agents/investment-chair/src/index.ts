/**
 * Investment Chair Agent — stub, migration tracked in issue #367
 *
 * Implementation guide: .claude/rules/agent-template.md
 * Reference implementation: agents/geologist/src/agent/index.ts
 *
 * When implemented:
 *   src/agent/index.ts           — manifest + config + handlers + runInvestmentChairTask
 *   src/agent/decision-client.ts — callDecisionTool (copy geowiz-client.ts, rename)
 *   tests/mcp-client.test.ts     — copy geologist mcp-client.test.ts
 *   tests/agent.test.ts          — copy geologist agent.test.ts
 *
 * Target server: decision (servers/decision, default port 3013)
 * Env var: DECISION_MCP_URL
 */

export const AGENT_ID = "investment-chair";

// Uncomment and switch to this export once src/agent/index.ts is implemented:
// export * from "./agent/index.js";
