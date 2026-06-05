/**
 * Market Analyst Agent — stub, migration tracked in issue #371
 *
 * Implementation guide: .claude/rules/agent-template.md
 * Reference implementation: agents/geologist/src/agent/index.ts
 *
 * When implemented:
 *   src/agent/index.ts           — manifest + config + handlers + runMarketAnalystTask
 *   src/agent/market-client.ts   — callMarketTool (copy geowiz-client.ts, rename)
 *   tests/mcp-client.test.ts     — copy geologist mcp-client.test.ts
 *   tests/agent.test.ts          — copy geologist agent.test.ts
 *
 * Target server: market (servers/market, default port 3007)
 * Env var: MARKET_MCP_URL
 */

export const AGENT_ID = "market-analyst";

// Uncomment and switch to this export once src/agent/index.ts is implemented:
// export * from "./agent/index.js";
