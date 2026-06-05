/**
 * Development Planner Agent — stub, migration tracked in issue #373
 *
 * Implementation guide: .claude/rules/agent-template.md
 * Reference implementation: agents/geologist/src/agent/index.ts
 *
 * When implemented:
 *   src/agent/index.ts               — manifest + config + handlers + runDevelopmentPlannerTask
 *   src/agent/development-client.ts  — callDevelopmentTool (copy geowiz-client.ts, rename)
 *   tests/mcp-client.test.ts         — copy geologist mcp-client.test.ts
 *   tests/agent.test.ts              — copy geologist agent.test.ts
 *
 * Target server: development (servers/development, default port 3011)
 * Env var: DEVELOPMENT_MCP_URL
 */

export const AGENT_ID = "development-planner";

// Uncomment and switch to this export once src/agent/index.ts is implemented:
// export * from "./agent/index.js";
