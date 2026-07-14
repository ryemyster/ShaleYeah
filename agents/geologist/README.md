# @shaleyeah/geologist

**Marcus Aurelius Geologicus** — the ShaleYeah fleet's geological analyst.

Tier 2 intelligence layer over the [`@shaleyeah/server-geowiz`](../../servers/geowiz) Tier 1 MCP server. Accepts natural-language geological goals, reasons over 9 domain tools via MCP/HTTP, and returns synthesized answers — with full audit trail, HITL support, and exponential-backoff retry.

## ADK project boundary

This package is the Geologist ADK project inside the monorepo. ADK files live here (`agents-cli-manifest.yaml`, `.agents-cli-spec.md`, `pyproject.toml`, `app/agent.py`) and must not be added at repo root.

Current migration state:

- ADK owns the target agent shape, instructions, eval path, and backend-selection contract.
- ADK now executes the first real Geowiz MCP tool: `assess_quality` through `assess_geowiz_quality`.
- `servers/geowiz` remains the independently runnable MCP backend.
- `src/agent/` is retained as a temporary TypeScript adapter for the remaining Geowiz tool set until each caller has an ADK replacement.
- New Geologist reasoning/runtime work should target `app/agent.py`, not expand the custom TypeScript ReAct loop.

---

## I want to run a geological task right now

**ADK path — first MCP-backed tool**

```bash
cd agents/geologist
agents-cli install
GEOWIZ_MCP_URL=http://localhost:3001 agents-cli run \
  "Use assess_geowiz_quality to assess sample.las as LAS data"
```

This path uses `app/agent.py` and the Python MCP client in `app/geowiz_mcp.py`.

**TypeScript adapter path — remaining tools**

**Step 1 — start the geowiz MCP server (Terminal 1)**

```bash
cd servers/geowiz
PORT=3001 pnpm start
# Marcus Aurelius Geologicus ready on :3001
```

**Step 2 — run a task (Terminal 2)**

```bash
cd agents/geologist
ANTHROPIC_API_KEY=sk-ant-... npx tsx src/agent/index.ts \
  "Analyze the Permian Basin formation in data/test.las and summarize porosity and net pay"
```

You'll see the agent reason through tool calls and return a synthesized answer.

**No LAS file handy?** Try a quality check — geowiz handles missing files gracefully:

```bash
ANTHROPIC_API_KEY=sk-ant-... npx tsx src/agent/index.ts \
  "Assess the data quality of sample.las"
```

---

## I want to call this from my own code

```typescript
import { runGeologistTask } from "@shaleyeah/geologist";

const answer = await runGeologistTask(
    "Analyze the Eagle Ford well logs in /data/ef-2024/ and summarize maturity.",
    {
        apiKey: process.env.ANTHROPIC_API_KEY,
        onApprovalRequired: async (challenge) => {
            // fires when agent calls save_finding or any HITL-gated tool
            return { approved: true, reviewerId: "ops-team", reason: "approved" };
        },
    },
);
console.log(answer);
```

→ See [docs/INTEGRATION.md](docs/INTEGRATION.md) for the full API including single-tool calls, scope enforcement, and BYOE model routing.

---

## I want to connect this to Claude Desktop

Add both the server (Tier 1) and the agent endpoint (Tier 2) to your MCP config:

```json
{
  "mcpServers": {
    "geowiz": {
      "command": "pnpm",
      "args": ["--filter", "@shaleyeah/server-geowiz", "start"],
      "cwd": "/path/to/ShaleYeah",
      "env": { "ANTHROPIC_API_KEY": "sk-ant-..." }
    }
  }
}
```

For the full Tier 2 agent (HITL, scopes, audit trail), use the `LocalAgentEndpoint` HTTP service — see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## Tools

| Tool | What it does | Type | HITL |
|------|-------------|------|------|
| `geologist.analyze_formation` | LAS/DLIS/WITSML log analysis — porosity, permeability, maturity | query | No |
| `geologist.process_gis` | GIS spatial analysis (.shp, .geojson, .kml) | query | No |
| `geologist.process_well_logs` | Multi-format well log processing | query | No |
| `geologist.assess_quality` | Data quality scoring | query | No |
| `geologist.process_access_database` | Access DB / petroleum data extraction | query | No |
| `geologist.process_document` | Geological document parsing and extraction | query | No |
| `geologist.process_seismic_data` | SEG-Y seismic interpretation | query | No |
| `geologist.process_aries_database` | ARIES reserves database processing | query | No |
| `geologist.save_finding` | Persist a key finding to the agent memory store | **command** (transactional) | **Yes** |

---

## Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Yes | — | LLM reasoning calls via `callLLM` |
| `GEOWIZ_MCP_URL` | No | `http://localhost:3001` | geowiz Tier 1 server URL |

---

## Commands

```bash
pnpm build        # TypeScript compile
pnpm test         # unit + contract tests (no live server required)
pnpm type-check   # tsc --noEmit
pnpm lint         # Biome
pnpm adk:info     # verify this package is recognized by agents-cli
pnpm adk:run -- "Assess the data quality of sample.las"
```

---

## Key files

| Path | Purpose |
|------|---------|
| [`src/agent/index.ts`](src/agent/index.ts) | Manifest, config, handlers, `runGeologistTask()`, CLI entrypoint |
| [`src/agent/geowiz-client.ts`](src/agent/geowiz-client.ts) | MCP/HTTP client with timeout + error classification |
| [`app/agent.py`](app/agent.py) | Package-local ADK entrypoint and Geowiz backend-selection tools |
| [`app/geowiz_mcp.py`](app/geowiz_mcp.py) | Python MCP client and first ADK-side `assess_quality` execution tool |
| [`agents-cli-manifest.yaml`](agents-cli-manifest.yaml) | agents-cli project marker for this package only |
| [`.agents-cli-spec.md`](.agents-cli-spec.md) | ADK reference-pair spec and boundaries |
| [`tests/agent.test.ts`](tests/agent.test.ts) | Contract tests (no live server required) |
| [`tests/mcp-client.test.ts`](tests/mcp-client.test.ts) | HTTP client + task loop tests |
| [`tests/adk-project-shape.test.ts`](tests/adk-project-shape.test.ts) | Regression tests for package-local ADK shape |
| [`tests/adk-mcp-execution-shape.test.ts`](tests/adk-mcp-execution-shape.test.ts) | Regression tests for ADK-owned Geowiz MCP execution |

---

## Documentation

| Doc | Who it's for |
|-----|-------------|
| [HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md) | New to the project — plain-language + five-component framework |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Understanding the topology, execution paths, Arcade patterns |
| [INTEGRATION.md](docs/INTEGRATION.md) | Calling this agent from your own code |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Running in production — Docker, Kong, scopes, BYOE |
| [LOCAL_TESTING.md](docs/LOCAL_TESTING.md) | Running both processes locally, HITL testing |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | TDD workflow, adding tools, implementation notes |
