# Getting Started with SHALE YEAH

Welcome to SHALE YEAH! This guide will help junior engineers and contributors get up and running quickly.

## Quick Start (5 minutes)

### Prerequisites
- **Node.js 18+** - [Download here](https://nodejs.org/)
- **Git** - For cloning and contributing
- **Terminal/Command Line** - Basic familiarity required

### 1. Clone and Install
```bash
git clone https://github.com/your-org/ShaleYeah.git
cd ShaleYeah
npm install
```

### 2. Run the Demo
```bash
npm run demo
```

**What happens:**
- 14 AI expert agents analyze a Permian Basin tract
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

### Troubleshooting Production Setup
- **"No such file" errors**: Check [DIRECTORY_STRUCTURE.md](./DIRECTORY_STRUCTURE.md) for required files
- **"Invalid format" errors**: Ensure LAS files are valid and CSV has required economic parameters
- **Production vs Demo**: Demo uses mock data, production needs real files

## Next Steps

- **Production setup**: See [DIRECTORY_STRUCTURE.md](./DIRECTORY_STRUCTURE.md) for detailed requirements
- **Explore the code**: Start with `src/demo-runner.ts` to understand the flow
- **Read the architecture docs**: See [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Try modifying an agent**: Start with simple changes to confidence levels
- **Run individual servers**: Connect them to Claude Desktop for interactive testing

## Getting Help

- **Issues**: Report bugs on GitHub Issues
- **Discussions**: Ask questions in GitHub Discussions
- **Documentation**: Check the `/docs` folder for detailed guides
- **Code Questions**: All code is extensively commented

## Contributing

Ready to contribute? See [DEVELOPMENT.md](./DEVELOPMENT.md) for the full contributor guide.

---

**Welcome to the future of oil & gas investment analysis!** 🛢️