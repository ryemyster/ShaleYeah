# Junior Developer Guide

**Understanding SHALE YEAH's Architecture and Implementation**

This guide explains how SHALE YEAH works under the hood, making it easy for junior developers to understand the system architecture, key concepts, and implementation patterns.

---

## 🎯 Learning Path

**Recommended order for understanding the codebase:**

1. **[Run the demo](#-step-1-run-the-demo)** - See the system in action
2. **[Understand the architecture](#-step-2-understand-the-architecture)** - Learn how components work together
3. **[Explore an MCP server](#-step-3-explore-an-mcp-server)** - Dive into a single expert agent
4. **[Follow the data flow](#-step-4-follow-the-data-flow)** - Trace how data moves through the system
5. **[Study the orchestration](#-step-5-study-the-orchestration)** - See how everything coordinates

---

## 🚀 Step 1: Run the Demo

Start by experiencing what the system does:

```bash
# Clone and set up
git clone https://github.com/rmcdonald/ShaleYeah.git
cd ShaleYeah
npm install --legacy-peer-deps

# Run the demo
npm run demo

# Explore the outputs
ls data/temp/demo/demo-*/
cat data/temp/demo/demo-*/INVESTMENT_DECISION.md
```

**What just happened?**
- 6 AI experts analyzed an oil & gas investment opportunity
- They generated professional reports in ~5 seconds
- All using mock data (no API calls needed for demo)

---

## 🏗️ Step 2: Understand the Architecture

SHALE YEAH uses a **microservices architecture** with AI expert agents:

### High-Level View

```
Input Data → MCP Client → 14 Active Expert Servers → Investment Decision
```

### Current Implementation

```
Demo Runner (src/demo-runner.ts)
    ↓
Simulates 6 Core Experts:
├── Marcus Aurelius Geologicus (Geology)
├── Caesar Augustus Economicus (Economics)
├── Lucius Technicus Engineer (Engineering)
├── Gaius Probabilis Assessor (Risk Analysis)
├── Titulus Verificatus (Title Analysis)
└── Scriptor Reporticus Maximus (Reporting)
    ↓
Professional Investment Reports
```

### Production Architecture (Ready but Not Active)

```
MCP Client (src/mcp-client.ts)
    ↓
14 Active MCP Servers (src/servers/*.ts):
├── geowiz.ts (Marcus Aurelius Geologicus)
├── econobot.ts (Caesar Augustus Economicus)
├── curve-smith.ts (Lucius Technicus Engineer)
├── decision.ts (Augustus Decidius Maximus)
├── research.ts (Scientius Researchicus)
├── risk-analysis.ts (Gaius Probabilis Assessor)
├── legal.ts (Legatus Juridicus)
├── market.ts (Mercatus Analyticus)
├── development.ts (Architectus Developmentus)
├── drilling.ts (Perforator Maximus)
├── infrastructure.ts (Structura Ingenious)
├── title.ts (Titulus Verificatus)
├── test.ts (Testius Validatus)
└── reporter.ts (Scriptor Reporticus Maximus)
    ↓
FileIntegrationManager (src/shared/file-integration.ts)
    ↓
Industry Format Parsers (src/shared/parsers/*.ts)
```

### Key Files to Understand

| **File** | **Purpose** | **What It Does** |
|----------|-------------|------------------|
| `src/demo-runner.ts` | Demo orchestration | Simulates 6 experts, generates reports |
| `src/mcp-client.ts` | Production orchestration | Coordinates all 14 active MCP servers |
| `src/servers/geowiz.ts` | Geology expert | Geological analysis MCP server |
| `src/shared/mcp-server.ts` | Base server class | Common functionality for all experts |
| `src/shared/file-integration.ts` | File processing | Handles 20+ industry formats |

---

## 🤖 Step 3: Explore an MCP Server

Let's understand how a single expert agent works by examining the geology server:

### File: `src/servers/geowiz.ts`

```typescript
// This is the Geological Analysis Expert
export class GeowizServer extends MCPServer {
  constructor() {
    super({
      name: 'geowiz',
      version: '1.0.0',
      description: 'Geological Analysis MCP Server',
      persona: {
        name: 'Marcus Aurelius Geologicus',    // Roman persona
        role: 'Master Geological Analyst',     // Professional title
        expertise: [                           // What they know
          'Formation analysis',
          'Well log interpretation',
          'Reservoir characterization',
          'GIS data processing'
        ]
      }
    });
  }
```

### What Makes an Expert Agent?

**1. Roman Imperial Persona**
- Each agent has a memorable Roman character
- Provides consistent decision-making style
- Makes interactions more engaging and trustworthy

**2. Specialized Tools**
```typescript
// Example tools from geowiz server
this.registerTool({
  name: 'analyze_formation',           // What the tool does
  description: 'Analyze geological formations from well log data',
  inputSchema: z.object({             // Input validation
    filePath: z.string(),
    analysisType: z.enum(['basic', 'standard', 'comprehensive'])
  }),
  handler: async (args) => this.analyzeFormation(args)  // Implementation
});
```

**3. File Processing Integration**
```typescript
// Every server can process industry files
const parseResult = await this.fileManager.parseFile(filePath);
// Handles .las, .xlsx, .shp, .segy, .pdf automatically
```

**4. Structured Outputs**
```typescript
// Consistent response format
return {
  analysis: geologicalData,
  confidence: 0.85,              // How sure we are (0-1)
  recommendations: [...],        // What to do next
  persona: 'Marcus Aurelius Geologicus',
  timestamp: new Date().toISOString()
};
```

### Run a Single Expert

```bash
# Start just the geology expert
npm run server:geowiz

# Or start the economics expert
npm run server:econobot
```

This starts the server in MCP mode - you can connect it to Claude Desktop for interactive analysis.

---

## 📊 Step 4: Follow the Data Flow

Let's trace how data moves through the system:

### Demo Mode Data Flow

```
1. Demo Runner Starts
   ↓
2. Creates Output Directory: data/temp/demo/demo-20250922T123120/
   ↓
3. For Each Expert Agent:
   ├── Load mock data
   ├── Simulate analysis (with realistic delays)
   ├── Generate structured results
   └── Save to individual analysis file
   ↓
4. Generate Final Reports:
   ├── INVESTMENT_DECISION.md (Executive summary)
   ├── DETAILED_ANALYSIS.md (Technical details)
   └── FINANCIAL_MODEL.json (Economic data)
```

### Production Mode Data Flow (When Implemented)

```
1. MCP Client Receives Request
   ↓
2. File Processing:
   ├── FileIntegrationManager detects format
   ├── Routes to appropriate parser (LAS, Excel, GIS, etc.)
   ├── Validates and structures data
   └── Returns ParseResult
   ↓
3. Expert Server Processing:
   ├── Receives structured data
   ├── Performs domain-specific analysis
   ├── Generates confidence-scored results
   └── Returns analysis to orchestrator
   ↓
4. Report Generation:
   ├── Aggregates all expert analyses
   ├── Generates executive summary
   └── Produces client deliverables
```

### Data Directories

```
data/
├── samples/              # Input files for testing
│   ├── demo.las         # Sample well log
│   ├── economics.xlsx   # Sample financial data
│   └── boundaries.shp   # Sample GIS data
├── temp/                # Temporary outputs (auto-cleaned)
│   └── demo/           # Demo runs (keep last 3)
└── outputs/             # Production results (permanent)
    └── reports/        # Client deliverables
```

---

## 🎭 Step 5: Study the Orchestration

The orchestration layer coordinates all the experts:

### Demo Orchestration (`src/demo-runner.ts`)

```typescript
class ShaleYeahMCPDemo {
  async runCompleteDemo(): Promise<void> {
    // 1. Setup
    const runId = this.generateRunId();      // demo-20250922T123120
    const outputDir = `./data/temp/demo/${runId}`;

    // 2. Execute experts sequentially
    for (const agent of this.agents) {
      console.log(`🤖 Executing ${agent.persona} (${agent.domain})`);

      const analysis = await this.simulateExpertAnalysis(agent);

      console.log(`✅ ${agent.domain}: ${analysis.confidence}% confidence`);

      await this.saveAnalysis(outputDir, agent.name, analysis);
    }

    // 3. Generate reports
    await this.generateInvestmentDecision(outputDir, analyses);
    await this.generateDetailedAnalysis(outputDir, analyses);
    await this.generateFinancialModel(outputDir, analyses);
  }
}
```

### MCP Client Orchestration (`src/mcp-client.ts`)

```typescript
export class ShaleYeahMCPClient {
  private serverConfigs: MCPServerConfig[] = [
    // 14 active expert server configurations
    { name: 'geowiz', script: 'src/servers/geowiz.ts', persona: 'Marcus Aurelius Geologicus' },
    { name: 'econobot', script: 'src/servers/econobot.ts', persona: 'Caesar Augustus Economicus' },
    // ... 12 more servers
  ];

  async executeAnalysis(request: AnalysisRequest): Promise<WorkflowResult> {
    // 1. Start all required servers
    const servers = await this.initializeServers();

    // 2. Process files
    const processedFiles = await this.processInputFiles(request.inputFiles);

    // 3. Execute analysis across all servers
    const results = await Promise.all(
      servers.map(server => server.analyze(processedFiles))
    );

    // 4. Synthesize results
    return this.synthesizeResults(results);
  }
}
```

---

## 🔧 Key Concepts for Junior Developers

### 1. Model Context Protocol (MCP)

**What is MCP?**
- A standard protocol for AI agents to communicate
- Like REST API, but for AI services
- Enables tools, resources, and prompts
- Built by Anthropic for Claude integration

**Why MCP?**
- **Standardized** - Works with any MCP client (Claude Desktop, etc.)
- **Composable** - Mix and match different expert servers
- **Extensible** - Easy to add new analysis domains
- **Enterprise-ready** - Production-grade protocol

### 2. Persona-Based AI Architecture

**Why Roman Personas?**
```typescript
// Instead of this:
"Analysis Server #3 returned confidence: 0.82"

// We have this:
"Marcus Aurelius Geologicus analyzed formations with 82% confidence"
```

**Benefits:**
- **Memorable** - Easier to remember and trust
- **Authoritative** - Roman emperors convey expertise
- **Consistent** - Each persona has distinct decision-making style
- **Accountable** - Clear ownership of recommendations

### 3. Microservices with Shared Infrastructure

**Each Server Is Independent:**
```typescript
// Every server can run standalone
npm run server:geowiz      # Just geology
npm run server:econobot    # Just economics
```

**But They Share Common Capabilities:**
- File processing (FileIntegrationManager)
- Base MCP server functionality
- Error handling and logging
- Data directory management

### 4. File Processing Architecture

**Universal File Support:**
```typescript
// One interface handles 20+ formats
const result = await fileManager.parseFile(filePath);
// Works with: .las, .xlsx, .shp, .segy, .pdf, .geojson, etc.
```

**Auto-Detection:**
```typescript
// System figures out format automatically
detectFormat("well_data.las")     → "las"
detectFormat("economics.xlsx")    → "excel"
detectFormat("boundaries.shp")    → "shapefile"
```

### 5. Confidence-Scored Analysis

**Every Analysis Includes Confidence:**
```typescript
interface AnalysisResult {
  analysis: any;           // The actual results
  confidence: number;      // How sure we are (0.0 - 1.0)
  quality: QualityGrade;   // 'Excellent' | 'Good' | 'Fair' | 'Poor'
  recommendations: string[]; // What to do next
}
```

**Why This Matters:**
- **Transparency** - Users know reliability of results
- **Quality control** - Low confidence triggers review
- **Risk management** - Factor uncertainty into decisions

---

## 🛠️ Common Development Patterns

### 1. Adding a New Analysis Tool

**Step 1:** Find the relevant server (e.g., `src/servers/geowiz.ts`)

**Step 2:** Add tool in `setupCapabilities()`:
```typescript
this.registerTool({
  name: 'analyze_porosity',
  description: 'Calculate porosity from well log data',
  inputSchema: z.object({
    filePath: z.string(),
    depthRange: z.object({
      top: z.number(),
      bottom: z.number()
    }).optional()
  }),
  handler: async (args) => this.analyzePorosityData(args)
});
```

**Step 3:** Implement the analysis method:
```typescript
private async analyzePorosityData(args: any): Promise<any> {
  // Parse input file
  const parseResult = await this.fileManager.parseFile(args.filePath);

  // Perform analysis
  const porosity = this.calculatePorosity(parseResult.data);

  // Return structured result with confidence
  return {
    analysis: { averagePorosity: porosity, /* ... */ },
    confidence: 0.85,
    quality: 'Good',
    recommendations: ['Drill test well', 'Run additional logs']
  };
}
```

### 2. Creating a New Expert Server

**Template Pattern:**
```typescript
export class MyDomainServer extends MCPServer {
  constructor() {
    super({
      name: 'my-domain',
      version: '1.0.0',
      description: 'My Domain Analysis MCP Server',
      persona: {
        name: 'Roman Persona Name',           // Choose a Roman name
        role: 'Master [Domain] Strategist',   // Professional title
        expertise: [                          // List of specializations
          'Domain expertise 1',
          'Domain expertise 2'
        ]
      }
    });
  }

  protected async setupDataDirectories(): Promise<void> {
    // Create directories for this server's data
    const dirs = ['analyses', 'reports', 'temp'];
    for (const dir of dirs) {
      await fs.mkdir(path.join(this.dataPath, dir), { recursive: true });
    }
  }

  protected setupCapabilities(): void {
    // Register your analysis tools here
    this.registerTool({ /* ... */ });
    this.registerResource({ /* ... */ });
  }
}
```

### 3. File Processing Pattern

**Standard Approach:**
```typescript
async processFile(filePath: string): Promise<AnalysisResult> {
  // 1. Parse the file
  const parseResult = await this.fileManager.parseFile(filePath);
  if (!parseResult.success) {
    throw new Error(`Failed to parse ${filePath}: ${parseResult.errors.join(', ')}`);
  }

  // 2. Validate data
  const validatedData = this.validateInput(parseResult.data);

  // 3. Perform analysis
  const analysis = await this.performDomainAnalysis(validatedData);

  // 4. Calculate confidence
  const confidence = this.assessConfidence(analysis, validatedData);

  // 5. Save results
  const analysisId = `${this.config.name}_${Date.now()}`;
  await this.saveResult(`analyses/${analysisId}.json`, analysis);

  return {
    analysis,
    confidence,
    quality: confidence > 0.8 ? 'Good' : 'Fair',
    recommendations: this.generateRecommendations(analysis)
  };
}
```

---

## 🧪 Testing and Debugging

### Running Individual Components

```bash
# Test the demo
npm run demo

# Test individual servers
npm run server:geowiz
npm run server:econobot

# Test file processing
npm run build
node -e "
  import('./dist/shared/file-integration.js').then(({ FileIntegrationManager }) => {
    const fm = new FileIntegrationManager();
    fm.parseFile('./data/samples/demo.las').then(console.log);
  });
"
```

### Debug Configuration

**VS Code Launch Configuration:**
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Demo",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/demo-runner.ts",
      "runtimeArgs": ["-r", "tsx/cjs"],
      "console": "integratedTerminal"
    },
    {
      "name": "Debug Geowiz Server",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/servers/geowiz.ts",
      "runtimeArgs": ["-r", "tsx/cjs"],
      "console": "integratedTerminal"
    }
  ]
}
```

### Common Issues

**Problem:** "Cannot find module" errors
```bash
# Solution: Build TypeScript first
npm run build
```

**Problem:** File parsing failures
```bash
# Check file exists and is readable
ls -la data/samples/demo.las
file data/samples/demo.las
```

**Problem:** MCP server won't start
```bash
# Check for port conflicts
ps aux | grep tsx
kill [process-id]
```

---

## 📚 Next Steps

### Beginner Tasks
1. **Modify confidence scoring** in an existing server
2. **Add a new analysis tool** to the geowiz server
3. **Change report formatting** in the demo runner
4. **Add file validation** to a parser

### Intermediate Tasks
1. **Create a new expert server** for environmental analysis
2. **Add support for new file format** (e.g., JSON)
3. **Implement caching** for analysis results
4. **Add unit tests** for a server

### Advanced Tasks
1. **Integrate external APIs** for live data
2. **Implement real AI analysis** with Anthropic API
3. **Add authentication** and user management
4. **Create web dashboard** for analysis results

---

## 🎯 Key Takeaways

**SHALE YEAH Architecture:**
- ✅ **Microservices** - Each expert is independent
- ✅ **MCP Standard** - Uses Anthropic's protocol
- ✅ **Persona-Based** - Roman characters for engagement
- ✅ **File Agnostic** - Handles 20+ industry formats
- ✅ **Confidence Scored** - Every result has reliability measure

**Development Approach:**
- ✅ **Start with demo** - See system in action first
- ✅ **One server at a time** - Master single expert before orchestration
- ✅ **Follow patterns** - Consistent structure across all servers
- ✅ **Test incrementally** - Build and verify each component

**Production Ready:**
- ✅ **Demo works now** - Full pipeline with mock data
- ✅ **MCP servers ready** - All 14 experts implemented
- ✅ **File processing ready** - Industry format support
- ✅ **Just needs AI integration** - Connect to Anthropic API

---

**Ready to dive deeper?** See the [Development Guide](./DEVELOPMENT.md) for contributing guidelines and advanced topics.