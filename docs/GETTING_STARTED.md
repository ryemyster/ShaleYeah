# Getting Started with SHALE YEAH

Welcome to SHALE YEAH! This guide will help junior engineers and contributors get up and running quickly.

## Quick Start (5 minutes)

### Prerequisites
- **Node.js 18+** - [Download here](https://nodejs.org/)
- **Git** - For cloning and contributing
- **Terminal/Command Line** - Basic familiarity required

### 1. Clone and Install
```bash
git clone https://github.com/rmcdonald/ShaleYeah.git
cd ShaleYeah
npm install --legacy-peer-deps
```

### 2. Run the Demo
```bash
npm run demo
```

**What happens:**
- 14 AI expert agents analyze a Permian Basin tract
- The Agent OS kernel executes servers in parallel with dependency ordering
- Complete analysis finishes in ~6 seconds
- Professional reports generated in `outputs/demo/`
- Executive summary, detailed analysis, and financial model created
- No API keys required - uses realistic mock data

### 3. Verify Everything Works
```bash
npm run build      # TypeScript compilation
npm run type-check # Type checking
npm run lint       # Code quality
```

## Understanding SHALE YEAH

### What It Does
SHALE YEAH replaces expensive consulting teams with AI-powered analysis:

**Traditional Process:**
- 15+ weeks of expert analysis
- $500K+ in consulting fees
- Inconsistent quality and delays

**SHALE YEAH Process:**
- 5 seconds for complete analysis
- Production-ready investment reports
- Consistent, repeatable results

### The AI Expert Team

Each "agent" is an AI expert with a Roman Imperial persona:

| Agent | Persona | Role | What They Analyze |
|-------|---------|------|-------------------|
| **geowiz** | Marcus Aurelius Geologicus | Senior Geologist | Rock formations, reservoir quality |
| **econobot** | Caesar Augustus Economicus | Financial Analyst | NPV, IRR, cash flows |
| **curve-smith** | Lucius Technicus Engineer | Reservoir Engineer | Decline curves, production forecasts |
| **decision** | Augustus Decidius Maximus | Investment Strategist | Final investment recommendations |
| **research** | Scientius Researchicus | Market Intelligence | Competitive analysis, market trends |
| **risk-analysis** | Gaius Probabilis Assessor | Risk Manager | Monte Carlo, risk assessment |

*...and 8 more specialists for complete coverage*

## Project Structure

```
ShaleYeah/
├── src/
│   ├── servers/           # 14 Active AI Expert Agents (MCP Servers)
│   │   ├── geowiz.ts     # Geological analysis
│   │   ├── econobot.ts   # Economic analysis
│   │   └── ...           # 12 more experts
│   ├── shared/           # Common utilities and base classes
│   │   ├── mcp-server.ts # Base class for all agents
│   │   └── parsers/      # File format parsers
│   ├── demo-runner.ts    # Demo orchestration
│   └── main.ts          # Production entry point
├── docs/                 # Documentation (you are here!)
├── data/                 # Required static data
│   └── samples/         # Sample files for production mode
│       ├── demo.las     # Well log data (required)
│       └── economics.csv # Economic parameters (required)
└── outputs/             # Generated analysis results (auto-created)
    ├── demo/           # Demo run outputs
    ├── reports/        # Production analysis reports
    ├── processing/     # Batch/research outputs
    └── test/          # Test outputs
```

## Running Individual Agents

Each expert agent can run independently as an MCP server:

```bash
npm run server:geowiz      # Start geological analysis server
npm run server:econobot    # Start economic analysis server
npm run server:decision    # Start investment decision server
# ... 11 more servers available
```

**Use Case:** Connect individual agents to Claude Desktop or other MCP clients for interactive analysis.

## Common Tasks

### Add a New Analysis Feature
1. Find the relevant agent in `src/servers/`
2. Add a new tool to the `setupCapabilities()` method
3. Implement the analysis logic
4. Test with the agent's individual server

### Modify Report Outputs
1. Edit `src/servers/reporter.ts`
2. Update the report generation methods
3. Test with `npm run demo`

### Add Support for New File Formats
1. Create a new parser in `src/shared/parsers/`
2. Add to `FileIntegrationManager` in `src/shared/file-integration.ts`
3. Update relevant agents to use the new parser

## Demo Deep Dive

The demo simulates a real investment analysis:

### 1. Setup Phase
```typescript
// Creates analysis ID: demo-20250917T132058
// Sets up output directory: data/outputs/demo-20250917T132058/
```

### 2. Agent Execution Phase
```typescript
// Each agent runs analysis (simulated with realistic delays)
🤖 Executing Marcus Aurelius Geologicus (Geological Analysis)
   ✅ Geological Analysis: 90% confidence in 844ms
```

### 3. Report Generation Phase
```typescript
// Generates 3 professional reports:
• Executive Summary: INVESTMENT_DECISION.md
• Detailed Analysis: DETAILED_ANALYSIS.md
• Financial Model: FINANCIAL_MODEL.json
```

### 4. Final Recommendation
```typescript
📊 Overall Recommendation: ✅ PROCEED (Strong Economics & Acceptable Risk)
```

## Production Setup

Ready to analyze real oil & gas prospects? Follow this checklist:

### Prerequisites for Production Mode

**API Keys:**

| Key | Required? | Purpose | How to get |
| --- | --------- | ------- | ---------- |
| `ANTHROPIC_API_KEY` | **Yes for real AI output** | Enables LLM synthesis in all 14 servers. Without this, servers fall back to rule-based estimates — the app still runs but outputs won't be AI-generated. | [console.anthropic.com](https://console.anthropic.com) |
| `EIA_API_KEY` | Optional | Real WTI/Henry Hub commodity prices in `market.ts`. Without this, market uses hardcoded price constants. | Free — see [docs/EIA_API_SETUP.md](EIA_API_SETUP.md) |

```bash
# .env (never commit)
ANTHROPIC_API_KEY=sk-ant-...
EIA_API_KEY=your_eia_key_here
```

```bash
# 1. Verify required sample files exist
ls data/samples/demo.las         # Should exist
ls data/samples/economics.csv    # Should exist

# 2. Test production mode
npm run prod

# 3. Check results
ls outputs/reports/              # Should contain timestamped analysis
```

**⚠️ Important**: Production mode requires the sample files in `data/samples/`. Demo mode works without them.

### Critical Sample Files

#### `data/samples/demo.las`
- **Format**: LAS 2.0 (Log ASCII Standard)
- **Used by**: `geowiz` (geological analysis) and `curve-smith` (engineering analysis)
- **Required curves**: DEPT, GR, NPHI, RHOB, PEF
- **Example structure**:
```
~VERSION INFORMATION
VERS.                    2.0 : CWLS LOG ASCII STANDARD -VERSION 2.0
~WELL INFORMATION
STRT .FT               5000.0000 : START DEPTH
STOP .FT               5100.0000 : STOP DEPTH
~CURVE INFORMATION
DEPT .FT                        : DEPTH
GR   .GAPI                      : GAMMA RAY
NPHI .V/V                       : NEUTRON POROSITY
RHOB .G/C3                      : BULK DENSITY
~ASCII
[depth] [gr] [nphi] [rhob] [...]
```

#### `data/samples/economics.csv`
- **Format**: CSV (Excel `.xlsx` also supported)
- **Used by**: `econobot` (economic analysis)
- **Required columns**: Parameter, Value, Unit, Description
- **Example structure**:
```csv
Parameter,Value,Unit,Description
Oil Price,75.00,$/bbl,WTI Crude Oil Price
Gas Price,3.50,$/MCF,Natural Gas Price
Drilling Cost,8500000,$,Total Drilling & Completion Cost
Operating Cost,25000,$/month,Monthly Operating Expenses
Discount Rate,0.10,decimal,NPV Discount Rate
```

### Troubleshooting Production Setup

**"No such file or directory" errors:**
1. Verify `data/samples/demo.las` exists
2. Verify `data/samples/economics.csv` exists
3. Check file permissions (should be readable)
4. Ensure exact file names (case-sensitive)

**"Invalid file format" errors:**
1. Validate LAS file with an online LAS checker
2. Ensure CSV has header row with required columns
3. Check for special characters or encoding issues

**Production mode fails but demo works:**
1. Demo mode uses mock data — production requires real files
2. Check that sample files contain valid, realistic data
3. Verify file formats match the requirements above

## Workspace Cleanup

```bash
npm run clean              # Clean build artifacts, cache, and old demos
npm run clean:outputs      # Remove all generated outputs
npm run clean:all          # Nuclear option: clean everything including node_modules (requires npm install --legacy-peer-deps after)
```

Kernel audit logs are written to `data/audit/YYYY-MM-DD.jsonl` when `KERNEL_AUDIT_ENABLED=true`.

## Next Steps

- **Explore the code**: Start with `src/demo-runner.ts` to understand the flow
- **Read the architecture docs**: See [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Try modifying an agent**: Start with simple changes to confidence levels
- **Run individual servers**: Connect them to Claude Desktop for interactive testing

## Getting Help

- **Issues**: Report bugs on GitHub Issues
- **Documentation**: Check the `/docs` folder for detailed guides
- **Code Questions**: All code is extensively commented

## Contributing

Ready to contribute? See [CONTRIBUTING.md](../CONTRIBUTING.md) for the full contributor guide.

---

**Welcome to the future of oil & gas investment analysis!** 🛢️