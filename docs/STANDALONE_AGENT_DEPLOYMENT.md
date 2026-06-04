# Standalone Agent Deployment Guide

This guide explains the target deployment model for SHALE YEAH's standalone agents.

Read this before migrating or deploying any specialist agent. It is written as a tutorial on purpose: a new contributor should be able to follow it on a Linux machine without already understanding the whole codebase.

## The Simple Version

SHALE YEAH is becoming a distributed system of specialist agents.

Each agent is like a junior employee on an oil and gas analysis team:

- `geowiz` is the geologist.
- `econobot` is the economist.
- `curve-smith` is the reservoir engineer.
- `decision` is the investment chair.
- `reporter` writes the final report.
- The other agents cover research, legal, market, title, development, drilling, infrastructure, and quality assurance.

Each agent should be able to run by itself.

That means Geowiz should not need the full 14-agent suite to start. It should be able to boot, publish its manifest, expose its MCP tools, use its own providers, store its own context, and answer health checks on a Linux machine.

## What Every Standalone Agent Must Include

Every migrated agent must ship with:

| Required piece | What it does |
| --- | --- |
| Agent manifest | Describes the agent id, role, persona, tools, scopes, provider needs, memory policy, eval policy, and compatibility version |
| MCP service | Exposes only this agent's tools, resources, prompts, and discovery responses |
| Runtime config | Lets the user choose LLM, embedding, vector store, memory, data connectors, evals, and autonomy level |
| Health command or endpoint | Confirms the agent can start, read config, reach providers, and access storage |
| Linux deployment steps | A copy/paste tutorial for running the agent on Ubuntu or another common Linux environment |
| Evals config | Defines how outputs are checked and how strict those checks should be |
| Memory config | Defines what the agent can remember, what requires review, and where memory is stored |
| README | Explains what the agent does and how to run it alone |

The orchestrator is optional. An agent that only works when the orchestrator is running is not a standalone agent.

## Target Folder Shape

The legacy repo still has agents in `src/servers/*.ts`. The target shape for migrated agents is:

```text
agents/geowiz/
├── README.md
├── manifest.ts
├── mcp-server.ts
├── runtime.ts
├── config.example.yaml
├── tools/
├── integrations/
├── memory/
├── evals/
└── tests/
```

The same pattern should repeat for every specialist.

## Linux Tutorial Template

Every agent README must include a Linux section like this.

### 1. Install System Requirements

```bash
sudo apt update
sudo apt install -y git curl build-essential
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node --version
npm --version
```

### 2. Clone and Install

```bash
git clone https://github.com/ryemyster/ShaleYeah.git
cd ShaleYeah
npm install --legacy-peer-deps
npm run build
```

### 3. Copy the Agent Config

```bash
cp agents/geowiz/config.example.yaml agents/geowiz/config.local.yaml
```

Then edit `agents/geowiz/config.local.yaml`.

At minimum, the config should answer:

- Which LLM provider should this agent use?
- Are embeddings enabled?
- Which vector store should memory use?
- Which data connectors are enabled?
- How autonomous can the agent be?
- Which evals should run after each answer?

### 4. Set Secrets With Environment Variables

Never put secrets in committed config files.

Use environment variables:

```bash
export ANTHROPIC_API_KEY="your-key"
export EIA_API_KEY="optional-eia-key"
```

Secrets must be injected into tools at execution time. They must not appear in prompts, logs, client responses, run context, or memory.

### 5. Start One Agent

The target command shape is:

```bash
npm run agent:geowiz
```

During migration, legacy server commands may still be used:

```bash
npm run server:geowiz
```

### 6. Check Health

The target health command shape is:

```bash
npm run agent:geowiz:health
```

Health should verify:

- Config file is valid.
- Required environment variables are present.
- LLM provider is reachable or intentionally disabled.
- Embedding provider is reachable or intentionally disabled.
- Vector store is reachable or intentionally disabled.
- Memory storage is writable.
- Enabled data connectors are reachable or intentionally disabled.

### 7. Connect an MCP Client

After the agent starts, connect Claude Desktop, Claude Code, VS Code, or another MCP client to that agent's MCP service.

The client should see only the tools for that agent. For Geowiz, the client should see geology tools, not every SHALE YEAH tool.

## Autonomy Levels

Each agent should support configurable autonomy.

| Level | Meaning |
| --- | --- |
| `assistive` | Agent can analyze and recommend, but cannot take side-effecting actions without approval |
| `reviewed` | Agent can run read-only tools and propose memory updates, but a human reviews decisions and learning |
| `autonomous` | Agent can complete approved workflows within declared scopes, still respecting evals, auth, and approval gates |

Autonomy is not permission to bypass safety. Destructive actions, investment-impacting decisions, and memory promotion still require explicit policy.

## Memory and Learning

Agents should learn, but only through reviewed memory.

| Memory type | Rule |
| --- | --- |
| Run context | Stored automatically with retention and redaction |
| Candidate memory | Proposed by the agent after a run |
| Private reviewed memory | Approved lessons for one agent |
| Shared reviewed memory | Approved lessons that other agents may use |

Unreviewed run output is not trusted memory.

Each agent config should include:

```yaml
memory:
  enabled: true
  namespace: geowiz
  vectorStore: local-file
  retentionDays: 30
  promotion:
    requireHumanReview: true
    allowSharedMemory: false
```

## Evals

Each agent should have configurable evals that can be tightened or relaxed.

Evals should check:

- Output schema validity
- Domain completeness
- Confidence thresholds
- Source/provenance requirements
- Secret redaction
- Tool-call safety
- Whether memory promotion is allowed

Example:

```yaml
evals:
  enabled: true
  profile: standard
  checks:
    schema: strict
    domainCompleteness: standard
    confidenceMinimum: 0.7
    requireSources: true
    redactSecrets: strict
    allowMemoryPromotion: reviewed-only
```

## Data Integrations

Each agent owns its data integrations. The default should be open-source or public-data friendly where possible.

Provider-specific integrations should be optional stubs until the user configures credentials.

Examples:

| Agent | Open/default integration | Proprietary-provider stub examples |
| --- | --- | --- |
| Geowiz | LAS, GeoJSON, shapefile, WITSML-compatible XML parsing where available | Enverus, TGS, SLB, Halliburton/Landmark, IHS/S&P Global |
| Economist | CSV/XLSX economics inputs, EIA prices | ARIES, PHDWin, Enverus economics datasets |
| Market analyst | EIA public API | Bloomberg, Refinitiv/LSEG, S&P Global Commodity Insights |
| Title/legal | User-provided documents and county records where available | Drillinginfo/Enverus, courthouse data providers, legal DMS exports |

Stubs should make the integration point obvious without requiring proprietary access.

## Per-Agent README Checklist

Every migrated agent README must answer these questions:

- What does this agent do?
- What MCP tools does it expose?
- What data formats does it understand?
- What providers can I bring myself?
- What secrets or scopes does it need?
- How do I run it alone on Linux?
- How do I check health?
- How do I configure memory and learning?
- How do I configure evals?
- What actions require human approval?
- What output should I expect from a successful run?
- How do I troubleshoot the three most common failures?

If a 12-year-old could not follow the first-run tutorial, the README is not done.

