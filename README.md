# SHALE YEAH

## AI-Powered Oil & Gas Investment Analysis

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js](https://img.shields.io/badge/node.js-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-purple.svg)](https://modelcontextprotocol.io/)

There are roughly [9,000 independent oil and gas operators](https://www.ipaa.org/independent-producers/) in the US. They run **[95% of American wells](https://www.ipaa.org/independent-producers/)** and produce **[85% of domestic oil](https://www.ipaa.org/independent-producers/)** — but they don't have the resources of the majors. A proper investment due diligence still requires a petroleum geologist ([$58–67/hr](https://www.bls.gov/ooh/architecture-and-engineering/petroleum-engineers.htm)), a reservoir engineer ([$57–62/hr](https://www.zippia.com/salaries/reservoir-engineering-consultant/)), a financial analyst, a lawyer, and a risk manager, working for [8–10 weeks](https://datarooms.org/vdr-blog/how-long-is-the-due-diligence-period-in-a-deal/). That's [$50,000–$200,000 per deal](https://ogscapital.com/article/how-much-due-diligence-services-cost/) for a mid-market acquisition — before you've committed a dollar of capital. And in a market that saw **[$105–206 billion in upstream M&A in 2024 alone](https://oilprice.com/Latest-Energy-News/World-News/US-Upstream-Oil-Gas-MA-Hit-105-Billion-In-2024.html)**, deal windows don't wait.

The result: serious investment analysis is effectively gated behind enterprise budgets. Independent operators, small funds, and mineral rights buyers either skip the analysis or pay more than they should for less than they need.

**SHALE YEAH exists to close that gap.** It's an open-source **Agent OS** — a kernel-based runtime for AI agents, built on the same architectural principles as an operating system. The kernel handles agent discovery, parallel scatter-gather execution, session management, role-based access control, an append-only audit trail, and fault-tolerant resilience — so agents can fail gracefully, retry intelligently, and compose into larger workflows without breaking. 14 expert agents cover geology, economics, engineering, legal, risk, market, and more. The kernel decides who runs, in what order, with what permissions, and what to do when something goes wrong.

The OS infrastructure is complete. All 14 agents call the real Anthropic API — every one verified with anti-stub tests that prove Claude is actually being called, not just that the server returns something. Agents fall back to deterministic rule-based estimates when the API is unavailable so the full pipeline always runs.

AI adoption in upstream oil and gas is accelerating fast — [44% of E&P companies already use AI](https://worldoil.com/news/2026/1/23/oil-and-gas-operators-accelerate-ai-driven-software-adoption-isg-finds/), with the upstream software market projected to reach **[$25 billion by 2034](https://finance.yahoo.com/news/ai-oil-gas-market-size-140200556.html)**. SHALE YEAH is built for the operators who should be leading that shift, not waiting for the majors to trickle it down.

The goal isn't to replace human judgment. It's to make high-quality analysis fast and cheap enough that human judgment gets applied to *decisions* — not spent on data wrangling.

---

## What you need to get started

- **Node.js 18 or higher** — download at [nodejs.org](https://nodejs.org/)
- **Git** — for cloning this repo
- **An Anthropic API key** — this is what lets the agents actually call Claude (the AI). Without it the system still runs, but agents return rule-based estimates instead of real AI analysis. Get a key at [console.anthropic.com](https://console.anthropic.com).

---

## Three commands to see it work

```bash
# 1. Clone the repo and install dependencies
git clone https://github.com/ryemyster/ShaleYeah.git
cd ShaleYeah
npm install --legacy-peer-deps

# 2. Run the demo — no API key needed, uses pre-written fixture data
npm run demo

# 3. Run all tests to confirm everything passes
npm run test
```

The demo takes about 1 second and writes reports to `outputs/demo/`. Open `INVESTMENT_DECISION.md` in that folder to see the go/no-go recommendation.

---

## What's in this repo

```text
ShaleYeah/
├── src/
│   ├── kernel/          # The traffic controller — routes all analysis
│   ├── servers/         # 14 AI expert agents (one file per expert)
│   ├── shared/          # Shared tools: LLM client, file parsers, base class
│   ├── demo-runner.ts   # Runs the demo
│   └── main.ts          # Runs real production analysis
├── tests/               # All test files (run with npm run test)
├── docs/                # Detailed documentation (start here after this README)
├── data/samples/        # Sample data files for production mode
└── outputs/             # Where reports are written (auto-created)
```

---

## Go deeper

| I want to... | Read this |
| --- | --- |
| Understand oil & gas terms and why they matter | [docs/GLOSSARY.md](docs/GLOSSARY.md) |
| Set up my environment step by step | [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) |
| Connect agents to Claude Desktop, VS Code, or Claude CLI | [docs/MCP_INTEGRATION.md](docs/MCP_INTEGRATION.md) |
| Run a real analysis with my own data | [docs/DEMO_VS_PRODUCTION.md](docs/DEMO_VS_PRODUCTION.md) |
| Check which agents call the real AI vs. stubs | [docs/DEMO_VS_PRODUCTION.md#llm-integration-status](docs/DEMO_VS_PRODUCTION.md#llm-integration-status) |
| See all 14 agents and what they each do | [docs/SERVERS.md](docs/SERVERS.md) |
| Understand how the agents and kernel work together | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Use the kernel from my own code | [docs/API_REFERENCE.md](docs/API_REFERENCE.md) |
| Get free live oil and gas prices (EIA API) | [docs/EIA_API_SETUP.md](docs/EIA_API_SETUP.md) |
| See which Agent OS patterns are implemented | [docs/ARCADE-PATTERNS.md](docs/ARCADE-PATTERNS.md) |
| Read the Agent OS architecture review | [docs/AGENT-OS-REVIEW.md](docs/AGENT-OS-REVIEW.md) |
| Understand the original project intent and goals | [docs/PROJECT-INTENT.md](docs/PROJECT-INTENT.md) |

---

## The agents (quick list)

14 expert agents, each with a Roman Imperial persona and a specific domain:

| Agent | Persona | What they analyze | Claude? |
| --- | --- | --- | --- |
| `geowiz` | Marcus Aurelius Geologicus | Rock formations, well logs, reservoir quality | ✅ |
| `econobot` | Caesar Augustus Economicus | NPV, IRR, cash flows, breakeven prices | ✅ |
| `curve-smith` | Lucius Technicus Engineer | Decline curves, production forecasts | ✅ |
| `risk-analysis` | Gaius Probabilis Assessor | Risk scoring, Monte Carlo | ✅ |
| `decision` | Augustus Decidius Maximus | Final investment recommendation | ✅ |
| `reporter` | Scriptor Reporticus Maximus | Executive reports and summaries | ✅ |
| `research` | Scientius Researchicus | Market intelligence, competitive analysis | ✅ |
| `legal` | Legatus Juridicus | Contract risk, regulatory compliance | ✅ |
| `market` | Mercatus Analyticus | Commodity prices, supply/demand | ✅ |
| `title` | Titulus Verificatus | Ownership verification, title risk | ✅ |
| `development` | Architectus Developmentus | Project planning, resource allocation | ✅ |
| `drilling` | Perforator Maximus | Drilling programs, cost optimization | ✅ |
| `infrastructure` | Structura Ingenious | Facility design, capacity planning | ✅ |
| `test` | Testius Validatus | Quality assurance, validation | ✅ |

See [docs/SERVERS.md](docs/SERVERS.md) for details on each one.

---

## Running individual agents

Each agent can also run on its own as a standalone MCP server. This is useful if you want to connect one agent to Claude Desktop or another MCP client:

```bash
npm run server:geowiz        # Geological analysis
npm run server:econobot      # Economic analysis
npm run server:decision      # Investment decisions
npm run server:research      # Market intelligence
npm run server:risk-analysis # Risk assessment
npm run server:legal         # Legal analysis
npm run server:market        # Market analysis
npm run server:development   # Development planning
npm run server:drilling      # Drilling operations
npm run server:infrastructure # Infrastructure planning
npm run server:title         # Title analysis
npm run server:test          # Quality assurance
npm run server:curve-smith   # Reservoir engineering
npm run server:reporter      # Executive reporting
```

---

## Contributing

New here? Here's the path from zero to opening a pull request:

1. Pick an issue from [GitHub Issues](https://github.com/ryemyster/ShaleYeah/issues) or create one with `/create-issue`
1. Cut a branch off `develop`: `/new-issue-branch <number> <slug>`
1. Write a failing test first — see `tests/geowiz-anti-stub.test.ts` for the pattern we use
1. Implement the change (no `Math.random()`, no hardcoded stubs)
1. Run the full pre-commit check — all five must pass:

```bash
npm run build && npm run type-check && npm run lint && npm run test && npm run demo
```

Useful build commands:

```bash
npm run build        # compile TypeScript → dist/ (required before connecting any MCP client)
npm run build:mcp    # same as build — named alias for clarity when setting up MCP clients
npm run build:watch  # recompile automatically whenever you save a file (useful during development)
```

1. Ship it: `/finish-issue <number>` — this updates docs, commits, pushes, and opens the PR to `develop`

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide.

---

## Security

Role-based access control (4 tiers: analyst → engineer → executive → admin) and an append-only audit log with automatic sensitive-value redaction. See [SECURITY.md](SECURITY.md).

---

## Roadmap

| Milestone | Focus | Status |
| --- | --- | --- |
| LLM wiring — core servers | Wire `callLLM` into geowiz, econobot, curve-smith, risk-analysis, decision, reporter | ✅ Complete (#211–#216) |
| LLM wiring — support servers | Wire `callLLM` into all 8 remaining servers | ✅ Complete (#217) |
| Production hardening | Resilience, session persistence, caching, timeouts | Planned |
| Smart Agents v1 | Memory, data connectors, feedback loops | Planned |
| External integration | REST API, streaming, webhooks | Planned |

See [GitHub milestones](https://github.com/ryemyster/ShaleYeah/milestones) and [open issues](https://github.com/ryemyster/ShaleYeah/issues).

---

## License

Apache License 2.0 — 2025 Ryan McDonald

All reports include: `Generated with SHALE YEAH 2025 Ryan McDonald - Apache-2.0`

See [LICENSE](LICENSE).

---

*Aedificatum cum amore pro industria energiae.* (Built with love for the energy industry)
