/**
 * Reporter Agent — stub, migration tracked in issue #368
 *
 * Implementation guide: .claude/rules/agent-template.md
 * Reference implementation: agents/geologist/src/agent/index.ts
 *
 * When implemented:
 *   src/agent/index.ts           — manifest + config + handlers + runReporterTask
 *   src/agent/reporter-client.ts — callReporterTool (copy geowiz-client.ts, rename)
 *   tests/mcp-client.test.ts     — copy geologist mcp-client.test.ts
 *   tests/agent.test.ts          — copy geologist agent.test.ts
 *
 * Target server: reporter (servers/reporter, default port 3009)
 * Env var: REPORTER_MCP_URL
 */

export const AGENT_ID = "reporter-agent";

// Uncomment and switch to this export once src/agent/index.ts is implemented:
// export * from "./agent/index.js";
