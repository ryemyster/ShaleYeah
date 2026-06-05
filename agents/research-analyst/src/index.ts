/**
 * Research Analyst Agent — stub, migration tracked in issue #369
 *
 * Implementation guide: .claude/rules/agent-template.md
 * Reference implementation: agents/geologist/src/agent/index.ts
 *
 * When implemented:
 *   src/agent/index.ts            — manifest + config + handlers + runResearchAnalystTask
 *   src/agent/research-client.ts  — callResearchTool (copy geowiz-client.ts, rename)
 *   tests/mcp-client.test.ts      — copy geologist mcp-client.test.ts
 *   tests/agent.test.ts           — copy geologist agent.test.ts
 *
 * Target server: research (servers/research, default port 3008)
 * Env var: RESEARCH_MCP_URL
 */

export const AGENT_ID = "research-analyst";

// Uncomment and switch to this export once src/agent/index.ts is implemented:
// export * from "./agent/index.js";
