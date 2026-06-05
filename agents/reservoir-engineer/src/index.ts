/**
 * Reservoir Engineer Agent — stub, migration tracked in issue #365
 *
 * Implementation guide: .claude/rules/agent-template.md
 * Reference implementation: agents/geologist/src/agent/index.ts
 *
 * When implemented:
 *   src/agent/index.ts               — manifest + config + handlers + runReservoirEngineerTask
 *   src/agent/curve-smith-client.ts  — callCurveSmithTool (copy geowiz-client.ts, rename)
 *   tests/mcp-client.test.ts         — copy geologist mcp-client.test.ts
 *   tests/agent.test.ts              — copy geologist agent.test.ts
 *
 * Target server: curve-smith (servers/curve-smith, default port 3004)
 * Env var: CURVE_SMITH_MCP_URL
 */

export const AGENT_ID = "reservoir-engineer";

// Uncomment and switch to this export once src/agent/index.ts is implemented:
// export * from "./agent/index.js";
