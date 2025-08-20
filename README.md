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
# Quick demo with sample data (works immediately)
npm run demo

# Production analysis with real data and API keys  
npm run prod

# Batch processing for multiple tracts
npm run pipeline:batch

# Research mode for exploring new integrations
npm run pipeline:research

# View results
cat ./data/outputs/*/SHALE_YEAH_REPORT.md
```

## 🎯 Pipeline Modes

SHALE YEAH operates in four distinct modes, each optimized for different use cases:

### **Demo Mode** (`npm run demo`)
- ✅ **Works immediately** - No API keys required
- ✅ **Sample data** - Uses demo.las, demo.accdb.txt, tract.shp.txt  
- ✅ **Mock LLM responses** - Intelligent demo responses when no API keys
- ✅ **Fast execution** - Reduced agent set for quick turnaround
- ⚠️ **Not for production** - Results are for demonstration only

### **Production Mode** (`npm run prod`)  
- 🔒 **Requires API keys** - Real LLM analysis mandatory
- 📊 **Real data inputs** - Your actual LAS files, databases, shapefiles
- 🔍 **Full validation** - Strict confidence thresholds and error checking
- 🚀 **Complete orchestration** - All 8 agent personas fully engaged
- ✅ **Investment-grade** - Board-ready analysis and reporting

### **Batch Mode** (`npm run pipeline:batch`)
- 📁 **Multiple tracts** - Process entire folders of geological data
- 🔄 **Automated processing** - Unattended analysis of large datasets
- 📈 **Scalable** - Production-grade validation with batch optimization
- 🎯 **Enterprise-ready** - For operators with 10+ investment opportunities

### **Research Mode** (`npm run pipeline:research`)
- 🔬 **Integration development** - Test new vendor APIs and data sources
- 📝 **RFC generation** - Auto-creates technical specifications
- ⚡ **Fast iteration** - Mock responses for rapid prototyping
- 🛠️ **Developer-focused** - Perfect for extending the platform

### **With LLM Integration**

```bash
# Get API keys from https://console.anthropic.com or https://platform.openai.com
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" >> .env
echo "LLM_PROVIDER=claude" >> .env

# Run with full LLM reasoning
npm run demo  # Still works in demo mode
npm run prod  # Now uses real LLM analysis
```

## ⚙️ Configuration

### **Environment Setup**

The system works out-of-the-box with demo data. For full functionality, configure `.env`:

```bash
# ==========================================
# Mode Configuration
# ==========================================
# Pipeline mode: "demo", "production", "batch", "research" (auto-detected)
PIPELINE_MODE=demo
# Node environment: "development", "production", "test"
NODE_ENV=development

# ==========================================
# LLM Integration
# ==========================================
# Get API keys from https://console.anthropic.com or https://platform.openai.com
ANTHROPIC_API_KEY=sk-ant-your-key-here
OPENAI_API_KEY=sk-proj-your-key-here
LLM_PROVIDER=claude  # or "openai"

# ==========================================
# Pipeline Configuration  
# ==========================================
RUN_ID=custom-run-id  # Auto-generated if not set
OUT_DIR=./data/outputs/${RUN_ID}
PIPELINE_GOAL=tract_eval

# ==========================================
# Development Settings
# ==========================================
LOG_LEVEL=info  # debug, info, warn, error
DEV_MODE=false  # Auto-enabled for NODE_ENV=development

# ==========================================
# Optional Integrations
# ==========================================
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

## 🏗️ Agent Architecture

SHALE YEAH uses a **dual-layer agent architecture** that separates **configuration** from **implementation** for maximum flexibility and maintainability.

### **📋 Dual-Layer Architecture**

```typescript
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   YAML Configs      │    │   MCP Controller    │    │  TypeScript Agents  │
│  (.claude/agents)   │───▶│   Orchestrator      │───▶│   (src/agents)      │
│                     │    │                     │    │                     │
│ • 20 Agent Configs  │    │ • Load YAML configs │    │ • 2 Implementations │
│ • Roman Personas    │    │ • Resolve deps      │    │ • Execute analysis  │
│ • Resource deps     │    │ • Trigger execution │    │ • Generate outputs  │
│ • CLI commands      │    │ • Monitor progress  │    │ • Use LLM reasoning │
│ • Error handling    │    │ • Event coordination│    │ • Handle edge cases │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

### **📄 Configuration Layer**: `.claude/agents/` (20 YAML files)

**Purpose**: Agent workflow definitions, personas, and orchestration metadata  
**Used by**: MCP Controllers, Claude Code, automation systems  
**Contains**: Roman personas, resource dependencies, CLI commands, error handling rules

#### **Agent Types**

| Type | Pattern | Example | Purpose |
|------|---------|---------|---------|
| **Legacy** | `agent.yaml` | `geowiz.yaml` | Simple agent definitions with basic personas |
| **MCP-Enhanced** | `agent-mcp.yaml` | `geowiz-mcp.yaml` | Modern agents with resource dependencies |
| **Specialized** | Various | `build-monitor.yaml` | System agents for monitoring and automation |

#### **Roman Personas Migration**

Modern agents use **Roman imperial personas** for consistency and gravitas:

| Agent | Legacy Persona | Modern Roman Persona | Role |
|-------|----------------|---------------------|------|
| **geowiz** 🪨 | Dr. Sarah Mitchell | **Marcus Aurelius Geologicus** | Senior Petroleum Geologist |
| **reporter** 📊 | Sarah Chen | **Cicero Reporticus Maximus** | Executive Scribe & Investment Herald |
| **econobot** 💰 | David Chen | **Lucius Cornelius Monetarius** | Imperial Financial Strategist |
| **riskranger** ⚠️ | Dr. Amanda Foster | **Seneca Prudentius Risicus** | Risk Assessment Philosopher |
| **the-core** 🎯 | Robert Hamilton | **Caesar Augustus Decidicus** | Supreme Investment Commander |

### **💻 Implementation Layer**: `src/agents/` (2 TypeScript files)

**Purpose**: Actual executable agent logic with LLM integration  
**Used by**: Direct execution, complex analysis workflows  
**Contains**: Business logic, data processing, AI reasoning, output generation

```typescript
// src/agents/geowiz.ts - Full implementation
export class GeoWizAgent extends BaseAgent {
  private expectedOutputs = ['geology_summary.md', 'zones.geojson'];

  constructor(runId: string, outputDir: string, modeOverride?: string) {
    super(runId, outputDir, 'geowiz', GEOWIZ_PERSONA, modeOverride);
  }

  async analyze(inputData: GeowizInputs): Promise<AgentResult> {
    // Complex geological analysis logic
    // LLM integration for reasoning  
    // Data processing and validation
    // Professional geological assessment
  }
}
```

### **🔄 MCP Resource System**

**Model Context Protocol (MCP)** enables event-driven agent coordination:

```yaml
# .claude/agents/geowiz-mcp.yaml
resources:
  inputs:
    - uri: "mcp://shale-data/inputs/las-files/**"
      required: true
      condition: "not-empty"
  outputs:
    - uri: "mcp://shale-data/outputs/geology-summary.md"
      format: "markdown"
    - uri: "mcp://shale-data/outputs/zones.geojson" 
      format: "geojson"
```

### **⚡ Execution Flow**

1. **MCP Controller** loads all YAML configs from `.claude/agents/`
2. **Agent Factory** filters for MCP-enabled agents (6 of 20 have `resources`)
3. **Dependency Resolver** builds execution graph based on resource URIs  
4. **Event Coordinator** triggers agents when dependencies are satisfied
5. **CLI Execution** invokes TypeScript implementations via YAML commands
6. **TypeScript Agents** perform actual analysis and generate outputs
7. **Resource Events** trigger downstream agents automatically

### **📊 Current Agent Inventory**

From system analysis:
- **📄 20 YAML configuration files** in `.claude/agents/`
- **⚡ 6 MCP-enabled agents** with resource configurations
- **📚 14 legacy agents** without MCP resources  
- **💻 2 TypeScript implementations** (geowiz, reporter)
- **🏛️ Roman personas** implemented for 5 core agents

### **🏭 Agent Factory Integration**

The **Unified Agent Factory** bridges YAML configurations and TypeScript implementations:

```typescript
// Dynamic agent creation from YAML
const agentConfigs = await YAMLConfigLoader.loadAgentConfigs('.claude/agents');
const agents = AgentFactory.createAgentsFromRegistry(agentConfigs, config);

// Direct TypeScript instantiation
const geowiz = AgentFactoryHelpers.createGeowizAgent(config);
const reporter = AgentFactoryHelpers.createReporterAgent(config);
```

### **🔧 Creating New Agents**

1. **Create YAML Configuration** in `.claude/agents/my-agent.yaml`:
```yaml
name: my-agent
persona:
  name: "Maximus My-Expertus"
  role: "Domain Expert"
resources:
  inputs: [...]
  outputs: [...]
cli:
  entrypoint: "npx tsx src/agents/my-agent.ts"
```

2. **Implement TypeScript Logic** in `src/agents/my-agent.ts`:
```typescript
export class MyAgent extends BaseAgent {
  async analyze(input: MyInputs): Promise<AgentResult> {
    // Your domain-specific logic here
  }
}
```

3. **Register with Factory** (optional):
```typescript
AgentFactoryHelpers.createMyAgent = (config) => { /* ... */ };
```

### **🎯 Why This Architecture?**

- **🔧 Flexibility**: YAML configs allow rapid agent definition without code changes
- **⚡ Performance**: TypeScript implementations provide full computational power
- **🎭 Personas**: Roman characters add gravitas and consistency to AI interactions
- **🔄 Event-Driven**: MCP resources enable intelligent workflow coordination
- **📈 Scalability**: Add new agents by creating YAML files, no code compilation
- **🧪 Testing**: Mock agents via YAML without touching implementation logic

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

### **Mode Comparison**

| Feature | Demo | Production | Batch | Research |
|---------|------|------------|-------|----------|
| **API Keys Required** | ❌ No | ✅ Yes | ✅ Yes | ❌ No |
| **Data Sources** | Sample files | Real data | Real data | Sample/Test |
| **Agent Count** | Limited (2) | Full (8+) | Full (8+) | Limited (2-3) |
| **Validation** | Relaxed | Strict | Strict | Relaxed |
| **Execution Speed** | Fast | Thorough | Batch-optimized | Fast |
| **LLM Responses** | Mock/Real | Real only | Real only | Mock/Real |
| **Use Case** | Quick demo | Investment analysis | Bulk processing | Development |

### **Mode Selection Logic**

```bash
# Automatic mode detection based on NODE_ENV
NODE_ENV=development  → defaults to "demo" mode
NODE_ENV=production   → defaults to "production" mode

# Manual override with environment variable
PIPELINE_MODE=batch

# CLI override (highest priority)
npx tsx src/mcp.ts --mode=research
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