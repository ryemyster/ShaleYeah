# SHALE YEAH 🛢️ 

> **🎯 Democratize oil & gas investing through AI agent flows that replace what used to take 100s of employees**

**AGENTIC AI INVESTMENT PLATFORM** - Each agent represents a $200K+/year human expert, powered by LLM intelligence and orchestrated through YAML-driven workflows. From geological analysis to investment decisions, SHALE YEAH replaces entire teams with intelligent AI personas.

## 🧠 The Agentic Vision

**Traditional Process:** 
- Senior Geologist (6 weeks) → Drilling Engineer (4 weeks) → Financial Analyst (3 weeks) → Investment Committee (2 weeks) → Legal Team (2 weeks)
- **Total: 17+ weeks, $500K+ in salaries, inconsistent quality**

**SHALE YEAH Process:**
- AI Geologist → AI Engineer → AI Analyst → AI Director → AI Legal
- **Total: 2 minutes, consistent expert-level analysis, full documentation**

## 🚀 Quick Start

### **Prerequisites**
- Node.js 18+ with npm
- TypeScript support (included)
- Git for source control

### **Installation**

```bash
# Clone repository
git clone https://github.com/your-org/ShaleYeah.git
cd ShaleYeah

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Edit .env with your API keys (optional - works without)
```

### **Basic Usage**

```bash
# Run geological analysis pipeline (works immediately)
npm run demo

# Custom run with specific ID
npx tsx src/mcp.ts --goal=tract_eval --run-id=my-analysis

# View results
cat ./data/outputs/*/SHALE_YEAH_REPORT.md
```

### **With LLM Integration (Optional)**

```bash
# Get API keys from https://console.anthropic.com or https://platform.openai.com
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" >> .env
echo "LLM_PROVIDER=claude" >> .env

# Run with full LLM reasoning
npm run demo
```

## ⚙️ Configuration

### **Environment Setup**

The system works out-of-the-box with demo data. For full functionality, configure `.env`:

```bash
# LLM Integration (Optional - uses intelligent mock responses if not provided)
ANTHROPIC_API_KEY=sk-ant-your-key-here
OPENAI_API_KEY=sk-proj-your-key-here
LLM_PROVIDER=claude  # or "openai"

# Pipeline Configuration (Auto-generated if not set)
RUN_ID=custom-run-id
OUT_DIR=./data/outputs/${RUN_ID}
PIPELINE_GOAL=tract_eval

# Development Settings
LOG_LEVEL=info  # debug, info, warn, error
DEV_MODE=false

# Optional Integrations
SPLUNK_HEC_TOKEN=your-splunk-token
SENTINEL_BEARER=your-sentinel-token
ELASTIC_API_KEY=your-elastic-key
```

### **Input Data Setup**

Place your data in the `data/samples/` directory:

```bash
data/samples/
├── demo.las          # Well log data (LAS format)
├── demo.accdb.txt    # Ownership data (Access database export)
└── tract.shp.txt     # Tract boundaries (shapefile data)
```

The system includes demo data and works without real inputs for testing.

## 🏗️ System Architecture

```typescript
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Input Data    │ -> │  Multi-Agent     │ -> │ Investment      │
│                 │    │  Control Plane   │    │ Decisions       │
│ • LAS Logs      │    │     (MCP)        │    │                 │
│ • Access DBs    │    │                  │    │ • Go/No-Go      │
│ • Shapefiles    │    │ ┌──────────────┐ │    │ • Executive     │
│ • Market Data   │    │ │   geowiz     │ │    │   Reports       │
└─────────────────┘    │ │   reporter   │ │    │ • Risk Analysis │
                       │ │ (+ 12 more)  │ │    │ • NPV/IRR/ROI   │
                       │ └──────────────┘ │    └─────────────────┘
                       └──────────────────┘
```

### **Core Components**

| Component | Technology | Purpose |
|-----------|------------|---------|
| **MCP Controller** | TypeScript | Orchestrates agent workflows with LLM intelligence |
| **Agent Personas** | TypeScript Classes | Embody human expert roles with domain knowledge |
| **LLM Integration** | Anthropic/OpenAI SDKs | Powers intelligent reasoning and decision-making |
| **YAML Configuration** | Agent definitions | Drives workflow logic and persona behavior |
| **Tools & Utilities** | TypeScript modules | Parse data, perform calculations, generate outputs |

## 🤖 AI Agent Personas

Each agent represents a human expert with 15+ years experience:

| Agent | Persona | Role | Expertise |
|-------|---------|------|-----------|
| **geowiz** 🪨 | Dr. Sarah Mitchell | Senior Petroleum Geologist | Subsurface analysis, shale plays, drilling recommendations |
| **reporter** 📊 | Sarah Chen | Executive Assistant | Investment reporting, data synthesis, board presentations |
| **drillcast** 🔧 | Mike Rodriguez | Drilling Engineer | Horizontal wells, completion design, cost estimation |
| **econobot** 💰 | David Chen | Financial Analyst | NPV/DCF modeling, economic evaluation, ROI analysis |
| **riskranger** ⚠️ | Dr. Amanda Foster | Risk Manager | Monte Carlo analysis, scenario planning, risk mitigation |
| **the-core** 🎯 | Robert Hamilton | Investment Director | Strategic decisions, portfolio impact, final approval |
| **titletracker** 📋 | Jennifer Davis | Senior Landman | Ownership analysis, mineral rights, title verification |
| **notarybot** 📑 | Susan Wright | Legal Counsel | Transaction documents, compliance, deal structuring |

### **How Agents Think & Decide**

Each agent uses **LLM-powered reasoning** with domain expertise:

```typescript
// Example: GeoWiz geological analysis
const geologicalAnalysis = await this.llmClient.generateResponse(`
  You are Dr. Sarah Mitchell, a senior petroleum geologist with 15+ years 
  experience making $50M+ investment recommendations.
  
  Analyze this geological data and provide your professional assessment:
  - Formation quality and hydrocarbon potential  
  - Drilling risks and development recommendations
  - Confidence scoring with human escalation criteria
  
  Think like you're presenting to the investment committee tomorrow.
`, { persona: this.persona, data: geologicalData });
```

## 🛠️ Development

### **Build & Test**

```bash
# Type check
npm run type-check

# Build for production
npm run build

# Run built version
npm start

# Lint code
npm run lint

# Clean build artifacts (compiled TypeScript, outputs, cache)
npm run clean

# Clean only compiled TypeScript
npm run clean:dist

# Clean only pipeline outputs
npm run clean:outputs

# Clean everything for fresh start (including node_modules)
npm run clean:all && npm install

# Test specific agent
npx tsx src/agents/geowiz.ts --shapefile data/samples/tract.shp.txt --region Permian --run-id test
```

### **Project Structure**

```
src/
├── mcp.ts                 # Main orchestration controller
├── agents/
│   ├── geowiz.ts          # Senior geologist persona
│   ├── reporter.ts        # Executive assistant persona
│   └── (8 more agents)    # Additional expert personas
└── shared/
    ├── types.ts           # TypeScript interfaces
    ├── base-agent.ts      # Agent base class with LLM integration
    ├── llm-client.ts      # Claude/OpenAI integration
    └── config.ts          # Environment configuration

tools/
├── las-parse.ts           # LAS file parser
├── curve-qc.ts           # Curve quality control
├── access-ingest.ts      # Database processing
├── curve-fit.ts          # Mathematical curve fitting
└── web-fetch.ts          # Web data retrieval

.claude/agents/            # YAML agent configurations
├── geowiz.yaml           # Geological analysis workflow
├── reporter.yaml         # Executive reporting workflow
└── (12 more configs)     # Additional agent definitions
```

### **Adding New Agents**

1. **Create Agent Class**:
```typescript
// src/agents/my-new-agent.ts
import { BaseAgent } from '../shared/base-agent.js';

export class MyNewAgent extends BaseAgent {
  constructor(runId: string, outputDir: string) {
    super(runId, outputDir, 'my-new-agent', {
      name: "Expert Name",
      role: "Professional Title", 
      experience: "15+ years domain expertise",
      // ... persona definition
    });
  }

  async analyze(inputData: any): Promise<AgentResult> {
    // Agent-specific analysis logic
  }
}
```

2. **Create YAML Configuration**:
```yaml
# .claude/agents/my-new-agent.yaml
name: "my-new-agent"
persona:
  name: "Expert Name"
  role: "Professional Title"
  llmInstructions: |
    You are [Expert Name], a [role] with [experience].
    Analyze [domain] data like you're making a $[amount] recommendation.

cli:
  entrypoint: "npx tsx src/agents/my-new-agent.ts"
  args: ["--input", "${input.data}", "--run-id", "${RUN_ID}"]

inputs:
  required:
    data: "Input data description"
outputs:
  - name: "analysis_report"
    path: "${OUT_DIR}/analysis_report.md"
```

3. **Test & Integrate**:
```bash
# Test standalone
npx tsx src/agents/my-new-agent.ts --input test-data --run-id test

# Test in pipeline (auto-discovered)
npm run demo
```

## 📊 Example Output

### **Geological Analysis Report**
```markdown
# Geological Analysis Summary

**Region:** Permian
**Analyst:** Dr. Sarah Mitchell, Senior Petroleum Geologist
**Confidence:** 82%

## Formation Analysis
| Formation | Thickness | Porosity | Permeability | Confidence |
|-----------|-----------|----------|--------------|------------|
| Wolfcamp A | 200 ft   | 8.0%     | 0.0001 md   | 82%        |
| Wolfcamp B | 200 ft   | 9.0%     | 0.00015 md  | 82%        |

## Professional Recommendations
- High confidence in formation identification supports development
- Sufficient thickness for horizontal drilling targets
- Standard multi-stage completion recommended
```

### **Executive Investment Report**
```markdown
# SHALE YEAH Investment Analysis Report

**Analysis Date:** 2024-08-20
**Prepared by:** Sarah Chen, Executive Assistant & Investment Reporter
**Agent Analyses:** 2 specialized evaluations completed

## Executive Summary
AI-powered analysis of oil & gas investment opportunity. Moderate geological 
confidence with typical unconventional risks. Comprehensive agent analysis 
completed across investment criteria.

## Key Investment Metrics
- **Geological Confidence:** 82%
- **Net Pay Thickness:** 400 ft

## Recommended Next Steps
1. Review geological and economic analyses
2. Conduct detailed due diligence on identified risks  
3. Prepare investment committee presentation
4. Schedule board approval if proceeding
```

### **Generated Files**
Each run produces structured outputs:
```
data/outputs/2024MMDD-HHMMSS/
├── SHALE_YEAH_REPORT.md      # Executive summary
├── geology_summary.md         # Geological analysis  
├── zones.geojson             # Spatial formation data
├── state.json                # Pipeline execution state
└── (additional agent outputs)
```

## 🔌 Available Integrations

### **SIEM Integration** (Optional)
```bash
# Configure monitoring
export SPLUNK_HEC_TOKEN=your-token
export SENTINEL_BEARER=your-bearer  
export ELASTIC_API_KEY=your-key

# Integrations automatically activate when tokens are provided
npm run demo
```

### **GIS Integration** (Optional)
```bash
# Spatial analysis
export ARCGIS_TOKEN=your-token
export QGIS_SERVER_URL=your-server

# GIS processing automatically includes spatial analysis
npm run demo
```

## 🚀 Deployment

### **Local Development**
```bash
# Development with hot reload
npm run dev

# Production build
npm run build && npm start

# Fresh development setup
npm run clean:all && npm install && npm run dev
```

### **Docker Deployment**
```bash
# Build container
docker build -t shale-yeah .

# Run with environment
docker run -e ANTHROPIC_API_KEY=your-key -p 3000:3000 shale-yeah
```

### **Cloud Deployment**
```bash
# Railway/Render
git push origin main  # Automatic deployment

# AWS/GCP/Azure
# Use provided Dockerfile and environment configuration
```

## 📚 Documentation

### **Configuration Reference**
- [Environment Variables](.env.example) - Complete configuration options
- [Agent Personas](.claude/agents/) - YAML workflow definitions  
- [TypeScript Types](src/shared/types.ts) - System interfaces and schemas

### **API Documentation**
```bash
# Generate API docs
npm run build
# Open dist/ for compiled documentation
```

## 🛡️ Security & Compliance

### **Data Protection**
- No secrets in code or version control
- Environment-based credential management  
- Configurable data retention policies
- PII detection and redaction capabilities

### **API Security**
- API key rotation support
- Rate limiting and error handling
- Secure credential storage
- Audit logging for all processing activities

## 📈 Performance

### **Benchmarks**
- **Single Tract Analysis**: < 2 minutes end-to-end
- **Memory Usage**: < 500MB per analysis
- **Storage**: ~10MB outputs per tract  
- **Concurrent Processing**: Scales with Node.js event loop

### **Optimization**
```bash
# Production optimization
export NODE_ENV=production
npm run build && npm start

# Parallel processing (future)
# System designed for horizontal scaling
```

## 🤝 Contributing

### **Development Setup**
```bash
# Fork and clone
git clone https://github.com/yourusername/ShaleYeah.git
cd ShaleYeah

# Install with development dependencies  
npm install

# Set up environment
cp .env.example .env
```

### **Contribution Process**
1. Create feature branch: `git checkout -b feature/new-capability`
2. Implement with TypeScript: Follow existing agent patterns
3. Add tests: `npm run type-check` must pass
4. Update documentation: Include README updates for new features
5. Submit PR: Include testing evidence and clear description

### **Code Standards**
- TypeScript strict mode required
- ESLint/Prettier formatting enforced
- Agent personas must include confidence scoring
- All outputs include SHALE YEAH attribution

## 📄 License

**Apache License 2.0**

Copyright (c) 2024 Ryan McDonald / Ascendvent LLC

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for details.

### **Attribution Requirement**
All outputs include: `Generated with SHALE YEAH (c) Ryan McDonald / Ascendvent LLC - Apache-2.0`

## 🎉 Ready to Start?

```bash
# Install and run in 30 seconds
git clone https://github.com/your-org/ShaleYeah.git
cd ShaleYeah && npm install && npm run demo

# View your first AI-powered geological analysis
cat ./data/outputs/*/SHALE_YEAH_REPORT.md
```

**Transform your oil and gas analysis from weeks to minutes.** 🚀

*Built with ❤️ for the energy industry*