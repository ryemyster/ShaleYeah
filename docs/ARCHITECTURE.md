# SHALE YEAH — Architecture

**What it is:** A solo-company operating system for oil & gas investment due diligence. Replaces a full specialist deal team (geologist, economist, landman, reservoir engineer, risk analyst, lawyer, market analyst, reporter) with 14 specialist AI agents, each independently deployable.

**Open source. Enterprise target. BYOE (Bring Your Own Everything).**

---

## The Two-Tier Employee Architecture

Every specialist is a **two-tier employee**. The two tiers are mutually exclusive, independently deployed, and communicate only over HTTP.

```
┌─────────────────────────────────────────────────────────────────┐
│  Tier 2 — Agent (Employee)          e.g. geologist.internal:3002│
│                                                                  │
│  AgentManifest — declares tools, scopes, model requirements     │
│  AgentRuntimeConfig — MCP server connections, model routing,    │
│                        HITL policy, evals, memory, data connectors│
│  LocalAgentRuntime — executes tools, enforces contracts         │
│  Handlers — call Tier 1 via MCP client (no direct imports)      │
│                                                                  │
│  Owns: BYO LLM routing · HITL challenges · eval scoring ·       │
│         secret redaction · agent working memory                 │
└────────────────────────┬────────────────────────────────────────┘
                         │ MCP over HTTP
┌────────────────────────▼────────────────────────────────────────┐
│  Tier 1 — MCP Tool Server            e.g. geowiz.internal:3001  │
│                                                                  │
│  Exposes tools via MCP protocol                                 │
│  Owns domain data processing + LLM synthesis for its domain     │
│  Owns data integrations: FTP (LAS files), REST APIs (Enverus,   │
│    IHS, EIA), Snowflake, PostgreSQL                             │
│  Owns domain vector store / embeddings (geological formations,  │
│    market data, etc.)                                           │
│                                                                  │
│  Stateless · fast · testable in complete isolation              │
└─────────────────────────────────────────────────────────────────┘
```

**Rule:** The agent NEVER imports from the server's source code. It calls the server at a configured URL. The server NEVER knows about the agent. Both have their own `llm-client` config, both have their own vector store.

---

## Monorepo Structure (Issue #385)

```
shaleyeah/
│
├── sdk/                    @shaleyeah/sdk
│   ├── src/
│   │   ├── contracts.ts    AgentManifest, AgentRuntimeConfig, all Zod schemas
│   │   ├── runtime.ts      LocalAgentRuntime
│   │   ├── service.ts      LocalAgentEndpoint
│   │   ├── llm-client.ts   Shared LLM call utility (each package configures independently)
│   │   ├── mcp-server.ts   MCPServer base class for Tier 1 servers
│   │   ├── server-factory.ts ServerFactory, ServerUtils
│   │   ├── types.ts        Global domain types (orchestrator-level contracts)
│   │   ├── file-*.ts       File detection, integration, utils
│   │   └── parsers/        LAS, Excel, GIS, SEGY parsers
│   └── tests/
│
├── agents/                 Tier 2 — one package per employee
│   ├── geologist/          @shaleyeah/geologist
│   │   ├── src/agent/      Manifest, config, handlers (calls geowiz MCP server)
│   │   ├── tests/
│   │   └── package.json    { "@shaleyeah/sdk": "workspace:*" }
│   ├── agent-zero/         Reference implementation for contract validation
│   └── <12 stubs>/         Filled in when each migration issue is worked (#364-376)
│
├── servers/                Tier 1 — one package per MCP tool server
│   ├── geowiz/             @shaleyeah/server-geowiz
│   │   ├── src/            Tool implementations, LLM synthesis, deterministic fallbacks
│   │   ├── tests/
│   │   └── package.json    { "@shaleyeah/sdk": "workspace:*" }
│   └── <13 more>/          econobot, curve-smith, decision, reporter, risk-analysis,
│                           research, legal, market, title, development, drilling,
│                           infrastructure, qa-server
│
├── orchestrator/           @shaleyeah/orchestrator (placeholder — Temporal workflows, #362)
│
├── pnpm-workspace.yaml
├── turbo.json              Build/test pipeline (sdk → servers → agents, dependency order)
└── tsconfig.base.json
```

**To pull any package into its own repo:**
```bash
mv agents/geologist ../shaleyeah-geologist
# change "@shaleyeah/sdk": "workspace:*" → "^0.1.0" in package.json
# remove path filter from CI workflow
```

---

## @shaleyeah/sdk

The shared language every package speaks. Published to npm. Every agent and every server imports it.

```typescript
import {
  AgentManifest,           // what an agent declares it can do
  AgentRuntimeConfig,      // how it's deployed (model routing, HITL, evals, etc.)
  LocalAgentRuntime,       // executes tools, enforces the contract
  LocalAgentEndpoint,      // HTTP endpoint wrapper
  callLLM,                 // shared LLM utility — each package injects its own key
  MCPServer,               // base class for Tier 1 servers
  ServerFactory,           // DRY factory for MCP tool registration
} from "@shaleyeah/sdk";
```

---

## Key Contracts

### AgentRuntimeConfig (what the operator configures per deployment)

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
  evals: { enabled, profile, checks: { schema, redactSecrets, ... } },
  memory: {
    namespace: string,
    vectorStore: { enabled, provider, url, embeddingModel },
    retentionDays: number,
    promotion: { requireHumanReview, allowSharedMemory },
  },
  mcpServers: {               // where this agent's Tier 1 tool servers live
    geowiz: { url, transport, authType }
  },
  dataConnectors: {           // BYO data integrations
    "las-repository": { type: "ftp", description },
    "well-data-api":  { type: "rest-api", description },
  },
}
```

**Auth rule:** `authType` is declared in config. Actual credentials are injected at runtime via execution context — never stored in config, manifests, prompts, responses, logs, or memory.

### AgentToolManifest (per tool)

```typescript
{
  name: "geologist.analyze_formation",
  type: "query" | "command",
  modelRequirement: "standard-analysis",   // capability label, never a provider name
  requiredScopes: ["read:geology"],
  mcpServer: "geowiz",                     // which mcpServers key this tool calls
  requiresHumanApproval: false,
  readOnly: false,
  destructive: false,
}
```

---

## Infrastructure Stack

| Layer | Decision | Notes |
|---|---|---|
| API Gateway | **Kong** | Sits at public edge. TLS, rate limiting, auth, per-tenant policies. Wire before orchestrator ships. |
| Workflow engine | **Temporal** | Orchestrator deal pipeline only — not inside individual agents. Durable execution for 14-agent analyses. |
| Transport | **HTTP** | Agent↔server and orchestrator↔agent. Enterprise O&G orgs can consume it. |
| Vector store | **Supabase pgvector** (default) | Swappable via `vectorStore.provider`. Never hardcode pgvector calls — always go through the provider field. |
| Data integrations | **REST first** | Enverus, IHS, EIA, state regulatories all have REST APIs. FTP for legacy bulk. Snowflake is high-value for enterprise. |
| Workspace | **pnpm + Turborepo** | `pnpm turbo build` builds all packages in dependency order. Each package builds independently. |
| Observability | **Deferred** | When we do it: structured JSON logs ingestible by Splunk/AWS CloudWatch. `AgentExecutionResult.metadata` is already the right shape. |

**No-go:** LangChain/LangGraph (our AgentRuntime IS the abstraction), Temporal inside individual agents, Kong between internal services.

---

## O&G Enterprise Reality

- Most investment-side orgs are 10-20 years behind on tech. Snowflake is new for them.
- Data vendors (Enverus, IHS Markit, PHDWin, ARIES) all have REST APIs now.
- Common data stack: Snowflake or Excel/Access, SharePoint/Box for docs, ESRI ArcGIS.
- REST + Snowflake connector covers 90% of real enterprise use cases.
- Build for where they're going (cloud, REST), not where they are.

---

## The 14 Employees

| Employee | Server | Domain |
|---|---|---|
| geologist | geowiz | Formation analysis, well logs, GIS, seismic, ARIES |
| economist | econobot | NPV, IRR, DCF, EIA market data |
| reservoir-engineer | curve-smith | Arps decline curves, production forecasting |
| risk-analyst | risk-analysis | Monte Carlo simulation, risk scoring |
| investment-chair | decision | Investment decision synthesis |
| reporter | reporter | Report assembly and delivery |
| research-analyst | research | Web search, regulatory data, news |
| legal-analyst | legal | Lease analysis, title review, compliance |
| market-analyst | market | Commodity prices, market intelligence |
| title-analyst | title | Mineral rights, title chain, acreage |
| development-planner | development | Well spacing, pad design, capex sequencing |
| drilling-engineer | drilling | AFE estimation, drilling program design |
| infrastructure-planner | infrastructure | Pipeline, midstream, compression |
| quality-assurance | qa-server | Output validation, cross-agent consistency |

---

## Issue Roadmap

| Issue | Description | Blocked by |
|---|---|---|
| #385 | **Monorepo conversion** — pnpm workspaces, sdk/, agents/, servers/, orchestrator/, kernel deleted | — (start here) |
| #363 Phase 2 | Geologist agent calls geowiz MCP server via MCP client | #385 |
| #364-376 | Migrate remaining 13 agents to two-tier pattern | #385 |
| #362 | Orchestrator — Temporal deal pipeline | #364-376 |

---

## Development Commands (post #385)

```bash
pnpm install                          # install all workspaces
pnpm turbo build                      # build everything (sdk → servers → agents)
pnpm turbo test                       # test everything
pnpm demo                             # standalone geologist agent demo

cd sdk && pnpm build                  # build just the SDK
cd servers/geowiz && pnpm start       # run geowiz MCP server
cd agents/geologist && pnpm start     # run geologist agent
```
