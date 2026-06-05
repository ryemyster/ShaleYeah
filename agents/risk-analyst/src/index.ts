/**
 * Risk Analyst Agent — stub, migration tracked in issue #366
 *
 * Implementation guide: .claude/rules/agent-template.md
 * Reference implementation: agents/geologist/src/agent/index.ts
 *
 * When implemented:
 *   src/agent/index.ts                — manifest + config + handlers + runRiskAnalystTask
 *   src/agent/risk-analysis-client.ts — callRiskAnalysisTool (copy geowiz-client.ts, rename)
 *   tests/mcp-client.test.ts          — copy geologist mcp-client.test.ts
 *   tests/agent.test.ts               — copy geologist agent.test.ts
 *
 * Target server: risk-analysis (servers/risk-analysis, default port 3005)
 * Env var: RISK_ANALYSIS_MCP_URL
 */

export const AGENT_ID = "risk-analyst";

// Uncomment and switch to this export once src/agent/index.ts is implemented:
// export * from "./agent/index.js";
