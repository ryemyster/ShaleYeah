# SHALE YEAH

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js](https://img.shields.io/badge/node.js-%3E%3D22.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-purple.svg)](https://modelcontextprotocol.io/)

14 specialist AI agents replacing a full oil & gas investment due diligence team — geologist, economist, reservoir engineer, risk analyst, lawyer, market analyst, and more. Open-source, BYOE (Bring Your Own Everything), enterprise target.

There are [~9,000 independent O&G operators](https://www.ipaa.org/independent-producers/) in the US running 95% of American wells. A proper deal review still costs $50K–$200K and 8–10 weeks. SHALE YEAH closes that gap.

---

## Quick start

```bash
git clone https://github.com/ryemyster/ShaleYeah.git
cd ShaleYeah
pnpm install
pnpm demo        # geologist agent boots standalone — no API key required
```

```bash
pnpm turbo build  # all 30 packages
pnpm turbo test   # all suites
```

---

## Documentation

| Topic | File |
|-------|------|
| Architecture — two-tier agents, package layout | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Getting started for new contributors | [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) |
| All 14 servers — what they do, where they live | [docs/SERVERS.md](docs/SERVERS.md) |
| Connect to Claude Desktop / VS Code / Claude CLI | [docs/MCP_INTEGRATION.md](docs/MCP_INTEGRATION.md) |
| Demo mode vs production mode | [docs/DEMO_VS_PRODUCTION.md](docs/DEMO_VS_PRODUCTION.md) |
| Standalone agent deployment guide | [docs/STANDALONE_AGENT_DEPLOYMENT.md](docs/STANDALONE_AGENT_DEPLOYMENT.md) |
| Distributed agent architecture | [docs/DISTRIBUTED_AGENTS.md](docs/DISTRIBUTED_AGENTS.md) |
| O&G glossary for new engineers | [docs/GLOSSARY.md](docs/GLOSSARY.md) |
| Role-based workflows by O&G profession | [docs/ROLES.md](docs/ROLES.md) |
| CI/CD gates | [docs/CI_CD.md](docs/CI_CD.md) |
| Project intent and vision | [docs/PROJECT-INTENT.md](docs/PROJECT-INTENT.md) |
| SHALE YEAH vs Claude Managed Agents | [docs/WHY_SHALEYEAH_IS_DEFENSIBLE.md](docs/WHY_SHALEYEAH_IS_DEFENSIBLE.md) |
| Agent OS architecture review | [docs/AGENT-OS-REVIEW.md](docs/AGENT-OS-REVIEW.md) |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide. TL;DR: branch from `develop`, write failing tests first, run `pnpm turbo build && pnpm turbo test && pnpm demo` before opening a PR.

---

## License

Apache License 2.0 — 2025 Ryan McDonald. See [LICENSE](LICENSE).
