# SHALE YEAH

**AI-Powered Oil & Gas Investment Analysis Platform**

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js](https://img.shields.io/badge/node.js-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-purple.svg)](https://modelcontextprotocol.io/)

> **Transform oil & gas investment analysis from weeks to minutes with AI-powered expert agents**

SHALE YEAH replaces traditional teams of expensive specialists with 14 AI expert agents, each embodying a Roman Imperial persona with deep domain expertise. Built on the Model Context Protocol (MCP), it delivers production-ready investment analysis in seconds.

---

## 🎯 The Problem We Solve

**Traditional Process:**
- **15+ weeks** of analysis time
- **$500K+** in consulting fees
- **Inconsistent quality** across projects
- **Human bottlenecks** in critical decisions

**SHALE YEAH Solution:**
- **5 seconds** for complete analysis
- **$0** marginal cost per analysis
- **Consistent, repeatable** results
- **AI-powered expertise** available 24/7

---

## 🏛️ Meet Your AI Expert Team

Each agent embodies a Roman Imperial expert with specialized knowledge:

| **Agent** | **Roman Persona** | **Expertise** |
|-----------|------------------|---------------|
| 🗿 **Geology** | Marcus Aurelius Geologicus | Formation analysis, reservoir quality |
| 💰 **Economics** | Caesar Augustus Economicus | DCF modeling, NPV/IRR analysis |
| ⚡ **Engineering** | Lucius Technicus Engineer | Decline curves, production forecasts |
| 🎯 **Decision** | Augustus Decidius Maximus | Investment recommendations |
| 🔍 **Research** | Scientius Researchicus | Market intelligence, competitive analysis |
| ⚠️ **Risk** | Gaius Probabilis Assessor | Monte Carlo, risk quantification |
| ⚖️ **Legal** | Legatus Juridicus | Contract analysis, regulatory compliance |
| 📈 **Market** | Mercatus Analyticus | Commodity forecasting, supply/demand |

*...and 6 more specialists covering drilling, infrastructure, development, title, testing, and reporting.*

**Why Roman Personas?**
- **Memorable & engaging** - easier to trust "Marcus Aurelius Geologicus" than "Agent #3"
- **Authority & expertise** - each persona embodies centuries of wisdom in their domain
- **Consistent decision-making** - personas maintain character across all interactions
- **Clear accountability** - each agent owns their specific recommendations

---

## 🚀 5-Minute Quick Start

### Prerequisites
- **Node.js 18+** ([download here](https://nodejs.org/))
- **Git** for cloning the repository

### Demo (No API Keys Required)

```bash
# 1. Clone and install
git clone https://github.com/rmcdonald/ShaleYeah.git
cd ShaleYeah
npm install

# 2. Run the demo with realistic mock data
npm run demo

# 3. View results
ls data/temp/demo/demo-*/
cat data/temp/demo/demo-*/INVESTMENT_DECISION.md
```

**What happens:** 6 AI experts analyze a Permian Basin tract in ~5 seconds, generating professional investment reports.

**Sample Output:**
```
🛢️  SHALE YEAH - AI-Powered Oil & Gas Investment Analysis
📋 Analysis ID: demo-20250922T123120
🗺️  Target Tract: Permian Basin Demo Tract

🤖 Executing Marcus Aurelius Geologicus (Geological Analysis)
   ✅ Formation Analysis: 77% confidence (150ft net pay, 13.1% porosity)

🤖 Executing Caesar Augustus Economicus (Financial Analysis)
   ✅ Economic Analysis: 82% confidence ($2.9M NPV, 31% IRR)

🎯 SHALE YEAH Analysis Complete!
📊 Overall Recommendation: ✅ PROCEED (Strong Economics & Acceptable Risk)
📁 Reports saved to: data/temp/demo/demo-20250922T123120/
```

### Production Setup

```bash
# 1. Add Anthropic API key for real AI analysis
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" >> .env

# 2. Add your data files
cp your-data.las data/samples/
cp your-database.accdb data/samples/

# 3. Run production analysis
npm run prod

# 4. Review comprehensive output
ls data/outputs/reports/production-*/
```

---

## 📊 What You Get

Every analysis produces professional-grade deliverables:

### 1. Executive Investment Decision
```markdown
# INVESTMENT RECOMMENDATION: ✅ PROCEED

**NPV (10%):** $2.9M | **IRR:** 30.9% | **Payback:** 14 months

## Key Findings
- Strong reservoir quality (77% geological confidence)
- Favorable economics with 31% IRR
- Low risk profile with clear title
- Tier 1 drilling target identified

## Recommendation
Proceed with acquisition at current terms.
```

### 2. Detailed Technical Analysis
- Comprehensive geological assessment
- Reservoir engineering analysis
- Economic modeling with sensitivities
- Risk assessment and mitigation strategies
- Legal and regulatory compliance review

### 3. Financial Model (JSON/Excel)
- Complete DCF analysis
- Production forecasts
- Cost assumptions
- Sensitivity matrices
- Investment metrics

---

## 🏗️ Architecture Overview

SHALE YEAH implements a **microservices architecture** using the Model Context Protocol (MCP):

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   Data Ingestion    │───▶│  SHALE YEAH MCP     │───▶│   Investment        │
│                     │    │  Client             │    │   Decision          │
│ • LAS Well Logs     │    │  (Orchestrator)     │    │                     │
│ • Excel Economics   │    │                     │    │ • Go/No-Go          │
│ • GIS Boundaries    │    │ ┌─────────────────┐ │    │ • Risk Assessment   │
│ • Market Data       │    │ │  14 MCP Servers │ │    │ • NPV/IRR Analysis  │
│ • Legal Documents   │    │ │  Roman Personas │ │    │ • Board Presentation│
└─────────────────────┘    │ └─────────────────┘ │    └─────────────────────┘
                           └─────────────────────┘
```

**Key Benefits:**
- **Standards-compliant** - Built on official Anthropic MCP SDK
- **Enterprise-ready** - Production architecture from day one
- **Extensible** - Easy to add new analysis domains
- **Scalable** - Each expert runs independently

---

## 🎯 Who This Is For

### Oil & Gas Investment Firms
- **Private equity funds** - Fast deal screening and due diligence
- **Independent operators** - Investment decision support
- **Institutional investors** - Portfolio analysis and optimization

### Technical Teams
- **Reservoir engineers** - Quick decline curve analysis
- **Geologists** - Formation assessment and mapping
- **Financial analysts** - Economic modeling and sensitivity analysis

### Service Companies
- **Consulting firms** - Scale expertise without hiring
- **Investment banks** - Deal evaluation and presentation materials
- **Legal firms** - Regulatory compliance and risk assessment

---

## 📚 Documentation

| Guide | Purpose | Audience |
|-------|---------|----------|
| **[Getting Started](./docs/GETTING_STARTED.md)** | First steps and basic concepts | New users |
| **[Junior Developer Guide](./docs/JUNIOR_DEVELOPER_GUIDE.md)** | System architecture and concepts | Junior developers |
| **[Development Guide](./docs/DEVELOPMENT.md)** | Contributing and extending | Contributors |
| **[API Reference](./docs/API_REFERENCE.md)** | Integration and technical specs | Technical integrators |
| **[Workspace Management](./docs/WORKSPACE_MANAGEMENT.md)** | File organization and cleanup | All users |

---

## 🤝 Contributing

We welcome contributions! See our [Development Guide](./docs/DEVELOPMENT.md) for:
- Setting up your development environment
- Understanding the codebase architecture
- Adding new analysis capabilities
- Testing and quality standards
- Submitting pull requests

---

## 📄 License

**Apache License 2.0** - See [LICENSE](./LICENSE) file for details.

**Commercial Use Welcome** - Use SHALE YEAH in production, modify it, distribute it. Just respect the license terms and include proper attribution.

---

## 🎯 Quick Links

- **[🚀 Try the 5-minute demo](#-5-minute-quick-start)**
- **[📖 Read the architecture guide](./docs/JUNIOR_DEVELOPER_GUIDE.md)**
- **[🛠️ Start contributing](./docs/DEVELOPMENT.md)**
- **[📋 View sample outputs](./data/temp/demo/)**
- **[💬 Join discussions](https://github.com/rmcdonald/ShaleYeah/discussions)**

---

*Generated with SHALE YEAH 2025 Ryan McDonald / Ascendvent LLC - Apache-2.0*