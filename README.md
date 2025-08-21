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

#### **🎮 Try It Right Now (No Setup Required)**

```bash
# Quick demo with sample data (works immediately)
npm run demo

# View the generated report
cat ./data/outputs/demo-*/SHALE_YEAH_REPORT.md
```

**What happens**: The system analyzes demo LAS files and Access databases, performs geological analysis, runs economic modeling, and generates a comprehensive investment report. Takes ~30 seconds.

#### **📊 Understanding Your Results**

After running `npm run demo`, you'll find:

```bash
./data/outputs/demo-YYYYMMDD-HHMMSS/
├── SHALE_YEAH_REPORT.md           # Executive summary report
├── geology_summary.md             # Detailed geological analysis  
├── zones.geojson                  # Geographic formation boundaries
├── economic_analysis.json         # NPV, IRR, risk metrics
└── qc_report.md                   # Data quality assessment
```

**Key files to review:**
- **`SHALE_YEAH_REPORT.md`** - Start here! Executive summary with investment recommendation
- **`economic_analysis.json`** - Financial metrics: NPV, IRR, payback period
- **`zones.geojson`** - Open in GIS software to see formation boundaries

#### **🔧 Using Your Own Data**

Replace the demo data with your real files:

```bash
# 1. Add your LAS files (well logs)
cp your-well-001.las data/samples/
cp your-well-002.las data/samples/

# 2. Add your Access databases (optional)
cp your-database.accdb data/samples/

# 3. Run analysis with your data
npm run start -- --las-files=data/samples/your-well-001.las,data/samples/your-well-002.las

# 4. View results
cat ./data/outputs/run-*/SHALE_YEAH_REPORT.md
```

#### **💡 With API Keys (Intelligent Analysis)**

For AI-powered geological and economic reasoning:

```bash
# 1. Get API key from https://console.anthropic.com
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" >> .env

# 2. Run with AI analysis
npm run start

# AI will now provide intelligent geological interpretations and investment insights
```

#### **🏢 Production Analysis**

```bash
# Full production pipeline with real data
npm run prod

# Custom analysis with specific parameters  
npm run start -- \
  --las-files=data/samples/well1.las,data/samples/well2.las \
  --well-lat=47.7511 \
  --well-lon=-101.7778 \
  --mode=production
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

## 🏗️ Standards-Compliant MCP Architecture

SHALE YEAH uses the **official Anthropic MCP (Model Context Protocol)** standard for AI agent orchestration. This provides interoperability with Claude Desktop and other MCP-compliant systems.

### **📡 MCP Standards Architecture**

```typescript
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   YAML Agent       │    │  Unified MCP        │    │  Domain MCP         │
│   Configurations   │───▶│  Client             │───▶│  Servers            │
│  (.claude/agents)  │    │  (Orchestrator)     │    │  (Tools/Resources)  │
│                    │    │                     │    │                     │
│ • 20 Agent Configs │    │ • JSON-RPC 2.0      │    │ • 3 Domain Servers  │
│ • Roman Personas   │    │ • Protocol v2025-06-18│ │ • Tools & Resources │
│ • Resource deps    │    │ • Standards-compliant │  │ • Prompt templates  │
│ • CLI definitions  │    │ • Event coordination │    │ • Real MCP SDK      │
│ • Error handling   │    │ • Client orchestration│  │ • Claude interop    │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

### **📄 Configuration Layer**: `.claude/agents/` (20 YAML files)

**Purpose**: Agent workflow definitions and personas  
**Used by**: Claude Code, MCP clients, automation systems  
**Format**: Standard Claude agent YAML configurations with Roman personas

#### **🏛️ Roman Imperial Personas**

All agents use **Roman imperial personas** for consistency and memorable AI interactions:

| Domain | Roman Persona | Role | MCP Tools |
|--------|---------------|------|-----------|
| **Geology** 🪨 | **Marcus Aurelius Geologicus** | Senior Petroleum Geologist | `parse_las_file`, `analyze_formations`, `generate_zones_geojson` |
| **Economics** 💰 | **Lucius Cornelius Monetarius** | Imperial Financial Strategist | `dcf_analysis`, `risk_modeling`, `portfolio_optimization` |  
| **Reporting** 📊 | **Cicero Reporticus Maximus** | Executive Scribe & Investment Herald | `generate_comprehensive_report`, `synthesize_analysis_data`, `generate_qc_report` |

### **💻 MCP Implementation Layer**: `src/mcp-servers/` (3 TypeScript files)

**Purpose**: Standards-compliant MCP servers using official Anthropic SDK  
**Protocol**: JSON-RPC 2.0 with MCP protocol version `2025-06-18`  
**Interoperability**: Compatible with Claude Desktop and other MCP clients

#### **🏗️ Domain-Specific MCP Servers**

```typescript
// src/mcp-servers/geology.ts - Geological analysis server
export class GeologyMCPServer {
  private server: McpServer; // Official SDK

  setupGeologyTools(): void {
    this.server.registerTool("parse_las_file", { /* tool definition */ }, 
      async ({ file_path, analysis_type }) => { /* implementation */ });
    
    this.server.registerTool("analyze_formations", { /* tool definition */ }, 
      async ({ formations, analysis_criteria }) => { /* implementation */ });
  }
  
  setupGeologyResources(): void {
    this.server.registerResource("geological_formations", 
      new ResourceTemplate("geology://formations/{name}"), { /* resource handler */ });
  }
}

// src/mcp-servers/economics.ts - Economic analysis server  
export class EconomicsMCPServer {
  private server: McpServer; // Official SDK
  
  setupEconomicsTools(): void {
    this.server.registerTool("dcf_analysis", { /* DCF tool */ });
    this.server.registerTool("risk_modeling", { /* risk tool */ });
    this.server.registerTool("portfolio_optimization", { /* portfolio tool */ });
  }
}

// src/mcp-servers/reporting.ts - Report generation server
export class ReportingMCPServer {
  private server: McpServer; // Official SDK
  
  setupReportingTools(): void {
    this.server.registerTool("generate_comprehensive_report", { /* report tool */ });
    this.server.registerTool("synthesize_analysis_data", { /* synthesis tool */ });
  }
}
```

### **🚀 Unified MCP Client Orchestration**

The **Unified MCP Client** orchestrates all domain servers using standards-compliant JSON-RPC 2.0:

```typescript
// src/unified-mcp-client.ts - Standards-compliant orchestrator
export class UnifiedMCPClient {
  private client: Client; // Official MCP SDK
  private geologyServer: GeologyMCPServer;
  private economicsServer: EconomicsMCPServer;
  private reportingServer: ReportingMCPServer;

  async executeCompletePipeline(inputData: PipelineInput): Promise<PipelineResult> {
    // 1. Geological Analysis Workflow
    const geological = await this.executeGeologicalAnalysisWorkflow(inputData);
    
    // 2. Economic Analysis Workflow  
    const economic = await this.executeEconomicAnalysisWorkflow(geological);
    
    // 3. Comprehensive Reporting Workflow
    const reporting = await this.executeReportingWorkflow(geological, economic);
    
    return { geological, economic, reporting };
  }
}
```

### **🔄 MCP Standards Benefits**

**Interoperability**: Works with Claude Desktop and other MCP clients  
**Protocol Compliance**: JSON-RPC 2.0 with protocol version `2025-06-18`  
**Tool Registration**: Standard MCP tool/resource/prompt registration  
**Error Handling**: Standards-compliant error responses and status codes  
**Extensibility**: Add new domain servers following MCP patterns

### **⚡ Execution Flow**

1. **Unified MCP Client** initializes three domain-specific MCP servers
2. **Standards-compliant communication** via JSON-RPC 2.0 protocol
3. **Domain servers** execute tools using official Anthropic MCP SDK
4. **Workflow orchestration** coordinates geological → economic → reporting
5. **Resource management** handles data flow between domains  
6. **Final report generation** synthesizes all domain analyses

### **🏛️ Claude Desktop Integration**

SHALE YEAH MCP servers are **fully compatible** with Claude Desktop:

1. **Add MCP Server Configuration** to your Claude Desktop settings
2. **Point to SHALE YEAH servers** for geological, economic, and reporting analysis  
3. **Use natural language** to interact with oil & gas analysis tools
4. **Standards compliance** ensures seamless integration with other MCP clients

### **🔧 Creating New MCP Servers**

Follow these steps to add new domain expertise to SHALE YEAH:

#### **1. Create Domain MCP Server**

```typescript
// src/mcp-servers/my-domain.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export class MyDomainMCPServer {
  private server: McpServer;

  constructor(config: MyDomainConfig) {
    this.server = new McpServer({
      name: config.name,
      version: config.version
    });
    this.setupTools();
    this.setupResources();
    this.setupPrompts();
  }

  private setupTools(): void {
    this.server.registerTool(
      "my_analysis_tool",
      {
        title: "My Analysis Tool",
        description: "Performs domain-specific analysis",
        inputSchema: {
          input_data: z.string().describe("Input data to analyze")
        }
      },
      async ({ input_data }) => {
        // Tool implementation
        return { content: [{ type: "text", text: "Analysis result" }] };
      }
    );
  }
}
```

#### **2. Add to Unified Client**

```typescript
// Update src/unified-mcp-client.ts
import { MyDomainMCPServer } from './mcp-servers/my-domain.js';

export class UnifiedMCPClient {
  private myDomainServer: MyDomainMCPServer;

  constructor(config: UnifiedMCPConfig) {
    // Initialize your new domain server
    this.myDomainServer = new MyDomainMCPServer({
      name: 'my-domain-server',
      version: config.version,
      resourceRoot: config.resourceRoot
    });
  }
}
```

#### **3. Register Roman Persona**

Add your expert persona to the architecture table:

| **My Domain** 🔬 | **Gaius Julius My-Expertus** | Domain Specialist | `my_analysis_tool`, `my_synthesis_tool` |

#### **4. MCP Standards Compliance**

All new servers must follow official MCP standards:
- Use `@modelcontextprotocol/sdk` for all server creation
- Implement JSON-RPC 2.0 protocol compliance  
- Register tools, resources, and prompts using SDK methods
- Follow MCP protocol version `2025-06-18`
- Ensure Claude Desktop compatibility

### **🎯 Why This Architecture?**

- **🔧 Flexibility**: YAML configs allow rapid agent definition without code changes
- **⚡ Performance**: TypeScript implementations provide full computational power
- **🎭 Personas**: Roman characters add gravitas and consistency to AI interactions
- **🔄 Event-Driven**: MCP resources enable intelligent workflow coordination
- **📈 Scalability**: Add new agents by creating YAML files, no code compilation
- **🧪 Testing**: Mock agents via YAML without touching implementation logic

## 📁 Working with Your Data

### **🗃️ Supported File Types**

SHALE YEAH can process these oil & gas data formats:

| File Type | Extension | Purpose | Example |
|-----------|-----------|---------|---------|
| **LAS Files** | `.las` | Well log data | `WELL_001.las` |
| **Access Databases** | `.accdb`, `.mdb` | Production data | `field_data.accdb` |
| **Shapefiles** | `.shp` + supporting files | Geographic boundaries | `tract_boundaries.shp` |
| **CSV Files** | `.csv` | Tabular data | `production_data.csv` |

### **📂 File Organization**

Organize your data files like this:

```
data/samples/
├── las-files/
│   ├── WELL_001.las              # Well log data
│   ├── WELL_002.las              # Additional wells
│   └── OFFSET_WELLS.las          # Nearby well data
├── access-databases/
│   ├── production.accdb          # Production history
│   └── completion.accdb          # Completion data
├── geographic/
│   ├── tract_boundaries.shp      # Land boundaries
│   ├── tract_boundaries.shx      # Shapefile index
│   └── tract_boundaries.dbf      # Attribute data
└── custom/
    ├── market_data.csv           # Commodity prices
    └── cost_data.csv             # Operating costs
```

### **🔧 Adding Your Data**

#### **Step 1: Prepare Your Files**

```bash
# Create directories if they don't exist
mkdir -p data/samples/las-files
mkdir -p data/samples/access-databases
mkdir -p data/samples/geographic

# Copy your files
cp /path/to/your/well_logs/*.las data/samples/las-files/
cp /path/to/your/databases/*.accdb data/samples/access-databases/
cp /path/to/your/shapefiles/* data/samples/geographic/
```

#### **Step 2: Run Analysis**

```bash
# Analyze specific LAS files
npm run start -- --las-files=data/samples/las-files/WELL_001.las,data/samples/las-files/WELL_002.las

# Include Access databases
npm run start -- \
  --las-files=data/samples/las-files/WELL_001.las \
  --access-files=data/samples/access-databases/production.accdb

# Add geographic coordinates
npm run start -- \
  --las-files=data/samples/las-files/WELL_001.las \
  --well-lat=47.7511 \
  --well-lon=-101.7778
```

#### **Step 3: Validate Results**

```bash
# Check output directory
ls -la data/outputs/run-*/

# View main report
cat data/outputs/run-*/SHALE_YEAH_REPORT.md

# Check data quality
cat data/outputs/run-*/qc_report.md
```

### **🔍 Data Quality Requirements**

For best results, ensure your data meets these standards:

#### **LAS Files**
- ✅ **Standard LAS 2.0 format** with proper headers
- ✅ **Gamma Ray (GR) curve** for formation identification
- ✅ **Density (RHOB) and Neutron (NPHI)** for porosity analysis
- ⚠️ **Depth consistency** across all curves
- ⚠️ **Minimal null values** in target zones

#### **Access Databases**
- ✅ **Production tables** with date, oil, gas, water volumes
- ✅ **Well information** with API numbers and coordinates
- ✅ **Completion data** with stage counts and fluid volumes
- ⚠️ **Consistent naming** across related tables

#### **Geographic Data**
- ✅ **Valid coordinate system** (preferably WGS84)
- ✅ **Complete polygon boundaries** for land areas
- ✅ **Attribute data** with ownership information

## 🔐 Security & Best Practices

### **🛡️ Data Security**

SHALE YEAH processes sensitive geological and financial data. Follow these security practices:

#### **API Key Security**
```bash
# ✅ Store API keys in .env file (never commit to git)
echo "ANTHROPIC_API_KEY=sk-ant-your-key" >> .env

# ✅ Use environment variables in production
export ANTHROPIC_API_KEY="sk-ant-your-key"

# ❌ Never hardcode API keys in source code
# const apiKey = "sk-ant-your-key"; // DON'T DO THIS
```

#### **Data Privacy**
```bash
# ✅ Keep sensitive data in data/samples/ (gitignored)
cp sensitive_well_data.las data/samples/

# ✅ Review outputs before sharing
grep -i "confidential\|proprietary" data/outputs/*/SHALE_YEAH_REPORT.md

# ✅ Clean up temp files
npm run clean:outputs
```

#### **Access Control**
```bash
# ✅ Limit file permissions
chmod 600 .env                    # Only owner can read/write
chmod 700 data/samples/           # Only owner can access data

# ✅ Use separate environments
cp .env .env.production           # Production config
cp .env .env.development          # Development config
```

### **🔒 Production Deployment**

For production use:

```bash
# 1. Use environment-specific configs
NODE_ENV=production npm run start

# 2. Enable logging and monitoring
echo "LOG_LEVEL=info" >> .env.production

# 3. Secure API endpoints (if exposing as service)
echo "API_RATE_LIMIT=100" >> .env.production

# 4. Regular security updates
npm audit
npm update
```

## 🔄 Updating & Customization

### **🆙 Updating SHALE YEAH**

Keep your installation current:

```bash
# 1. Backup your data and configs
cp -r data/samples/ data/samples.backup
cp .env .env.backup

# 2. Pull latest changes
git fetch origin
git pull origin main

# 3. Update dependencies
npm install

# 4. Test with your data
npm run demo

# 5. Restore custom configs if needed
cp .env.backup .env
```

### **⚙️ Customizing Analysis Parameters**

#### **Economic Assumptions**
Edit economic parameters by modifying the analysis call:

```bash
# Custom economic parameters
npm run start -- \
  --las-files=data/samples/well.las \
  --oil-price=85 \
  --drilling-cost=12000000 \
  --discount-rate=0.12
```

#### **Geological Analysis**
Customize geological interpretation:

```bash
# Focus on specific formations
npm run start -- \
  --las-files=data/samples/well.las \
  --target-formations=Bakken,Three_Forks \
  --min-thickness=20
```

#### **Risk Assessment**
Adjust risk parameters:

```bash
# Conservative risk analysis
npm run start -- \
  --las-files=data/samples/well.las \
  --risk-tolerance=conservative \
  --confidence-threshold=0.85
```

### **🔧 Adding Custom Tools**

Create domain-specific analysis tools:

#### **1. Create Custom Tool Script**
```bash
# Create new tool
cat > tools/my-custom-analysis.ts << 'EOF'
#!/usr/bin/env node
/**
 * Custom Analysis Tool
 */
import fs from 'fs/promises';

async function myCustomAnalysis(inputFile: string): Promise<void> {
  // Your custom analysis logic here
  console.log(`Analyzing ${inputFile}...`);
  
  // Process data
  const data = await fs.readFile(inputFile, 'utf8');
  
  // Generate custom output
  const result = {
    analysis_type: "custom",
    input_file: inputFile,
    results: {
      // Your custom results
    }
  };
  
  // Save results
  await fs.writeFile('custom_analysis.json', JSON.stringify(result, null, 2));
}

// CLI interface
const inputFile = process.argv[2];
myCustomAnalysis(inputFile).catch(console.error);
EOF

chmod +x tools/my-custom-analysis.ts
```

#### **2. Integrate with Pipeline**
```bash
# Run custom tool in pipeline
npm run start -- --las-files=data/samples/well.las
npx tsx tools/my-custom-analysis.ts data/outputs/run-*/economic_analysis.json
```

## 🚨 Troubleshooting

### **Common Issues & Solutions**

#### **🔧 Installation Problems**

**Problem**: `npm install` fails with permission errors
```bash
# Solution: Fix npm permissions
sudo chown -R $(whoami) ~/.npm
npm cache clean --force
npm install
```

**Problem**: TypeScript compilation errors
```bash
# Solution: Update TypeScript and dependencies
npm install -g typescript@latest
npm install
npm run type-check
```

#### **📁 Data Processing Issues**

**Problem**: "LAS file format not recognized"
```bash
# Check LAS file format
head -20 your-file.las

# Common fix: Ensure LAS 2.0 format with proper headers
# File should start with:
# ~VERSION INFORMATION
# VERS.                     2.0: CWLS LOG ASCII STANDARD -VERSION 2.0
```

**Problem**: "No formations identified"
```bash
# Check gamma ray curve availability
grep -i "GR\|GAMMA" your-file.las

# Ensure proper depth range
grep -i "STRT\|STOP" your-file.las
```

**Problem**: "Access database connection failed"
```bash
# Check file permissions
ls -la data/samples/*.accdb

# Ensure file is not corrupted
file data/samples/your-database.accdb
```

#### **🔑 API Key Issues**

**Problem**: "API key not found" or "Authentication failed"
```bash
# Check .env file exists
ls -la .env

# Verify API key format
cat .env | grep ANTHROPIC_API_KEY

# Test API key manually
curl -H "x-api-key: $ANTHROPIC_API_KEY" https://api.anthropic.com/v1/messages
```

#### **💰 Economic Analysis Issues**

**Problem**: "Unrealistic economic results"
```bash
# Check input parameters
cat data/outputs/run-*/economic_analysis.json | jq '.assumptions'

# Common fixes:
# - Verify oil prices are reasonable ($50-$150/bbl)
# - Check drilling costs are realistic ($5M-$15M)
# - Ensure production rates are feasible (100-2000 bbl/day initial)
```

#### **🗺️ Geographic Issues**

**Problem**: "Coordinate system not recognized"
```bash
# Check shapefile projection
ogrinfo data/samples/tract_boundaries.shp -so

# Convert to WGS84 if needed
ogr2ogr -t_srs EPSG:4326 output.shp input.shp
```

### **🔍 Debug Mode**

Enable detailed logging for troubleshooting:

```bash
# Run with debug logging
DEBUG=shale-yeah:* npm run start

# Or set log level in .env
echo "LOG_LEVEL=debug" >> .env
npm run start
```

### **📞 Getting Help**

1. **Check the logs**: Look in `data/outputs/run-*/errors.log`
2. **Review data quality**: Check `data/outputs/run-*/qc_report.md`
3. **Test with demo data**: Run `npm run demo` to verify installation
4. **Report issues**: Include error logs and data samples (sanitized)

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