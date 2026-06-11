/**
 * Title Analyst Agent — stub, migration tracked in issue #372
 *
 * Implementation guide: .claude/rules/agent-template.md
 * Reference implementation: agents/geologist/src/agent/index.ts
 *
 * When implemented:
 *   src/agent/index.ts          — manifest + config + handlers + runTitleAnalystTask
 *   src/agent/title-client.ts   — callTitleTool (copy geowiz-client.ts, rename)
 *   tests/mcp-client.test.ts    — copy geologist mcp-client.test.ts
 *   tests/agent.test.ts         — copy geologist agent.test.ts
 *
 * Target server: title (servers/title, default port 3010)
 * Env var: TITLE_MCP_URL
 */

export const AGENT_ID = "title-analyst";

export * from "./agent/index.js";
