# SHALE YEAH — Architecture

A solo-company OS for oil & gas investment due diligence. 14 specialist AI agents, each independently deployable, replacing a full deal team.

**Open source. Enterprise target. BYOE (Bring Your Own Everything).**

---

## The building block — one two-tier employee

Every specialist is a two-tier employee. The two tiers are mutually exclusive and independently deployed.

```
┌─────────────────────────────────────────────────────────────────┐
│  Tier 2 — Agent                         agents/geologist/       │
│                                                                  │
│  AgentManifest      — tools, scopes, model requirements         │
│  AgentRuntimeConfig — MCP server URLs, model routing,           │
│                        HITL policy, evals, memory               │
│  LocalAgentRuntime  — executes tools, enforces contracts        │
│                                                                  │
│  Owns: BYO LLM routing · HITL challenges · eval scoring         │
│         secret redaction · agent working memory                 │
└────────────────────────┬────────────────────────────────────────┘
                         │ MCP over HTTP  (TypeScript import in monorepo dev)
┌────────────────────────▼────────────────────────────────────────┐
│  Tier 1 — MCP Tool Server               servers/geowiz/         │
│                                                                  │
│  Exposes tools via MCP protocol                                 │
│  Owns domain data processing + LLM synthesis                    │
│  Owns data integrations (FTP, REST APIs, Snowflake, PostgreSQL) │
│  Owns domain vector store / embeddings                          │
│                                                                  │
│  Stateless · testable in complete isolation                     │
└─────────────────────────────────────────────────────────────────┘
```

**Rule:** The agent never imports from the server's source in production — it calls the server at a configured URL. The server never knows about the agent. Both have their own LLM config and vector store.

Note: In the current monorepo, `agents/geologist/` imports `servers/geowiz/` directly as a TypeScript package (no transport overhead). The production deployment uses MCP over HTTP. Same contracts either way.

---

## The full fleet — 14 pairs

```
                    ┌─────────────────────────┐
                    │     orchestrator/        │
                    │  @shaleyeah/orchestrator │
                    │  Temporal deal pipeline  │
                    │      (planned #362)      │
                    └────────────┬────────────┘
                                 │ HTTP
          ┌──────────────────────┼──────────────────────┐
          │                      │                       │
    Phase 1 (parallel)     Phase 2 (parallel)     Phase 3
          │                      │                       │
   ┌──────▼──────┐        ┌──────▼──────┐        ┌──────▼──────┐
   │  geologist  │        │  economist  │        │  investment │
   │  ─────────  │        │  ─────────  │        │    chair    │
   │   geowiz    │        │  econobot   │        │  decision   │
   └─────────────┘        └─────────────┘        └─────────────┘
   ┌─────────────┐        ┌─────────────┐        ┌─────────────┐
   │market-analyst        │res-engineer │        │  reporter   │
   │  ─────────  │        │  ─────────  │        │  ─────────  │
   │   market    │        │ curve-smith │        │  reporter   │
   └─────────────┘        └─────────────┘        └─────────────┘
   ┌─────────────┐        ┌─────────────┐
   │title-analyst│        │ risk-analyst│
   │  ─────────  │        │  ─────────  │
   │    title    │        │risk-analysis│
   └─────────────┘        └─────────────┘
   ┌─────────────┐        ┌─────────────┐
   │legal-analyst│        │  research   │
   │  ─────────  │        │  ─────────  │
   │    legal    │        │  research   │
   └─────────────┘        └─────────────┘
                          ┌─────────────┐
                          │development  │
                          │  planner    │
                          │  ─────────  │
                          │development  │
                          └─────────────┘
                          ┌─────────────┐
                          │  drilling   │
                          │  engineer   │
                          │  ─────────  │
                          │  drilling   │
                          └─────────────┘
                          ┌─────────────┐
                          │infrastructure
                          │  planner    │
                          │  ─────────  │
                          │infra struct │
                          └─────────────┘
```

Each box is an `agent / server` pair. They can be deployed to the same host or spread across a network — the contract is the same either way.

`qa-server` runs cross-cutting quality checks and is not shown in the phase diagram.

---

## Orchestrator workflow (planned — #362)

The orchestrator runs a Temporal workflow that coordinates the fleet for a full deal analysis. Agents are called by HTTP; each has an `AgentEndpoint` that exposes `health`, `manifest`, `execute`, and `discover`.

```
trigger: deal_analysis({ tract, dataFiles })
│
├── Phase 1 — parallel, no dependencies
│   ├── geologist.analyze_formation(las_files)
│   ├── market-analyst.analyze_market_conditions(commodity_prices)
│   ├── title-analyst.examine_title(legal_description)
│   └── research-analyst.conduct_market_research(basin, operator)
│
├── Phase 2 — parallel, uses Phase 1 outputs
│   ├── economist.analyze_economics(geology, market)
│   ├── risk-analyst.assess_investment_risk(geology, economics, title)
│   ├── legal-analyst.analyze_legal_framework(lease_terms, regulatory)
│   ├── reservoir-engineer.analyze_decline_curve(production_history)
│   ├── development-planner.create_development_plan(geology, economics)
│   └── drilling-engineer.design_drilling_program(geology, development)
│
├── Phase 3 — sequential, uses all Phase 2 outputs
│   └── investment-chair.analyze_investment(all_above)
│
└── Phase 4 — report
    └── reporter.create_executive_report(decision, all_above)
```

Temporal handles retries, timeouts, human approval signals (HITL), and durable state across restarts. The orchestrator does not own domain knowledge — it only coordinates.

---

## Package structure

```
shaleyeah/
├── sdk/                @shaleyeah/sdk — shared language every package speaks
│   └── src/
│       ├── contracts.ts      AgentManifest, AgentRuntimeConfig (Zod schemas)
│       ├── runtime.ts        LocalAgentRuntime
│       ├── service.ts        LocalAgentEndpoint
│       ├── llm-client.ts     callLLM() — sole LLM call site
│       ├── mcp-server.ts     MCPServer base class
│       ├── canonical-model.ts  FormationSchema, EconomicsSchema, etc.
│       ├── types.ts          Domain types
│       └── parsers/          LAS, Excel, GIS, SEGY
│
├── servers/            Tier 1 — 14 MCP tool servers
│   ├── geowiz/         @shaleyeah/server-geowiz
│   ├── econobot/       @shaleyeah/server-econobot
│   └── ... (12 more)
│
├── agents/             Tier 2 — specialist agent packages
│   ├── geologist/      @shaleyeah/geologist  (implemented)
│   └── ... (additional specialist agents)
│
├── orchestrator/       @shaleyeah/orchestrator (stub — #362)
│
├── pnpm-workspace.yaml
├── turbo.json          build: sdk → servers → agents
└── tsconfig.base.json
```

**To extract any package to its own repo:**
```bash
mv agents/geologist ../shaleyeah-geologist
# change "@shaleyeah/sdk": "workspace:*" → "^0.1.0"
```

---

## @shaleyeah/sdk

The shared language. Every server and agent imports it.

```typescript
import {
  AgentManifest,        // what an agent declares it can do
  AgentRuntimeConfig,   // how it runs (model routing, HITL, evals, memory, MCP servers)
  LocalAgentRuntime,    // executes tools, enforces the contract
  LocalAgentEndpoint,   // HTTP endpoint wrapper (health, manifest, execute, discover)
  callLLM,             // only LLM call site — each package injects its own key
  MCPServer,           // base class for all Tier 1 servers
  FormationSchema,     // canonical Zod schemas shared across servers
  EconomicsSchema,
} from "@shaleyeah/sdk";
```

---

## Key contracts

### AgentRuntimeConfig

```typescript
{
  autonomy: "assistive" | "reviewed" | "autonomous",
  modelRouting: {
    "small-fast":        { provider: "...", model: "..." },
    "standard-analysis": { provider: "...", model: "..." },
    "deep-reasoning":    { provider: "...", model: "..." },
    "local-private":     { provider: "...", model: "..." },
    "deterministic":     { provider: "rule-based", model: "no-model" },
  },
  hitl: {
    approvalMode: "when-sensitive" | "always" | "never",
    requireForDestructive: true,
    requireForMemoryPromotion: true,
  },
  evals: { profile, checks: { schema, redactSecrets, confidenceMinimum, ... } },
  memory: { namespace, vectorStore, retentionDays, promotion },
  mcpServers: { geowiz: { url, transport, authType } },
  dataConnectors: { "las-repo": { type: "ftp" }, "well-api": { type: "rest-api" } },
}
```
