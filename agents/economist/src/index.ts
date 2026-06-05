/**
 * Economist Agent — stub, migration tracked in issue #364
 *
 * Implementation guide: .claude/rules/agent-template.md
 * Reference implementation: agents/geologist/src/agent/index.ts
 *
 * When implemented:
 *   src/agent/index.ts           — manifest + config + handlers + runEconomistTask
 *   src/agent/econobot-client.ts — callEconobotTool (copy geowiz-client.ts, rename)
 *   tests/mcp-client.test.ts     — copy geologist mcp-client.test.ts
 *   tests/agent.test.ts          — copy geologist agent.test.ts
 *
 * Target server: econobot (servers/econobot, default port 3002)
 * Env var: ECONOBOT_MCP_URL
 */

export const AGENT_ID = "economist";

// Uncomment and switch to this export once src/agent/index.ts is implemented:
// export * from "./agent/index.js";
