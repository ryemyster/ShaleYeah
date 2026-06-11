/**
 * Infrastructure Planner Agent — stub, migration tracked in issue #375
 *
 * Implementation guide: .claude/rules/agent-template.md
 * Reference implementation: agents/geologist/src/agent/index.ts
 *
 * When implemented:
 *   src/agent/index.ts                  — manifest + config + handlers + runInfrastructurePlannerTask
 *   src/agent/infrastructure-client.ts  — callInfrastructureTool (copy geowiz-client.ts, rename)
 *   tests/mcp-client.test.ts            — copy geologist mcp-client.test.ts
 *   tests/agent.test.ts                 — copy geologist agent.test.ts
 *
 * Target server: infrastructure (servers/infrastructure, default port 3012)
 * Env var: INFRASTRUCTURE_MCP_URL
 */

export const AGENT_ID = "infrastructure-planner";
export * from "./agent/index.js";
