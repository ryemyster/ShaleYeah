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
pnpm turbo build
pnpm turbo test
```

Connect any server to Claude Desktop:

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

---

## The 14 agents

| Package | Persona | Domain |
|---------|---------|--------|
| `@shaleyeah/server-geowiz` | Marcus Aurelius Geologicus | Geological analysis, LAS/GIS/seismic |
| `@shaleyeah/server-econobot` | Caesar Augustus Economicus | NPV, IRR, DCF |
| `@shaleyeah/server-curve-smith` | Lucius Technicus Engineer | Decline curves, EUR |
| `@shaleyeah/server-risk-analysis` | Gaius Probabilis Assessor | Risk scoring, Monte Carlo |
| `@shaleyeah/server-decision` | Augustus Decidius Maximus | Investment go/no-go |
| `@shaleyeah/server-reporter` | Scriptor Reporticus Maximus | Executive reports |
| `@shaleyeah/server-research` | Scientius Researchicus | Market intelligence |
| `@shaleyeah/server-legal` | Legatus Juridicus | Lease risk, compliance |
| `@shaleyeah/server-market` | Mercatus Analyticus | Commodity prices |
| `@shaleyeah/server-title` | Titulus Verificatus | Mineral rights, title |
| `@shaleyeah/server-development` | Architectus Developmentus | Development planning |
| `@shaleyeah/server-drilling` | Perforator Maximus | Drilling programs |
| `@shaleyeah/server-infrastructure` | Structura Ingenious | Midstream infrastructure |
| `@shaleyeah/server-qa` | Testius Validatus | Quality assurance |

---

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — two-tier system, package layout, sdk contracts.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) — setup, branching, test pattern, adding servers/agents.

---

## License

Apache License 2.0 — 2025 Ryan McDonald. See [LICENSE](LICENSE).
