/**
 * Drilling Engineer Agent — stub, migration tracked in issue #374
 *
 * Implementation guide: .claude/rules/agent-template.md
 * Reference implementation: agents/geologist/src/agent/index.ts
 *
 * When implemented:
 *   src/agent/index.ts              — manifest + config + handlers + runDrillingEngineerTask
 *   src/agent/drilling-client.ts    — callDrillingTool (copy geowiz-client.ts, rename)
 *   tests/mcp-client.test.ts        — copy geologist mcp-client.test.ts
 *   tests/agent.test.ts             — copy geologist agent.test.ts
 *
 * Target server: drilling (servers/drilling, default port 3003)
 * Env var: DRILLING_MCP_URL
 */

export const AGENT_ID = "drilling-engineer";

// Uncomment and switch to this export once src/agent/index.ts is implemented:
// export * from "./agent/index.js";
