# SHALE YEAH Quick Start Guide

> **🎯 From Raw Data to Investment Decision in 2 Minutes**

## 🚀 Basic Agentic Workflow

### 1. Setup (30 seconds)

```bash
# Clone and install
git clone https://github.com/your-org/ShaleYeah.git
cd ShaleYeah
npm install

# Set your LLM API key for intelligent agents (optional - works without)
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" >> .env
echo "LLM_PROVIDER=claude" >> .env
# OR echo "OPENAI_API_KEY=sk-proj-your-key-here" >> .env

# Verify setup
npm run demo --help
```

### 2. Run Intelligence-Driven Analysis (30 seconds)

```bash
# Quick demo with sample data (works immediately)
npm run demo

# Custom production analysis with your data
npm run prod

# View live results
export RUN_ID=$(ls -t data/outputs/ | head -1)
tail -f ./data/outputs/${RUN_ID}/SHALE_YEAH_REPORT.md
```

### 3. Review AI Agent Decisions (1 minute)

```bash
# View final investment recommendation
cat ./data/outputs/*/SHALE_YEAH_REPORT.md

# See detailed geological analysis
cat ./data/outputs/*/geology_summary.md

# Check spatial data
ls ./data/outputs/*/zones.geojson
```

## 🧠 What Just Happened?

**The TypeScript MCP orchestrated AI specialist personas:**

1. **🪨 Dr. Sarah Mitchell** (Senior Petroleum Geologist): *"Geological analysis shows 2 formations, 400ft total thickness, 82% confidence..."*
2. **📊 Sarah Chen** (Executive Assistant & Investment Reporter): *"Executive summary compiled from geological analysis with investment recommendations..."*

**Current Demo Mode:** Fast execution with 2 core agents
**Production Mode:** Full orchestration with 8+ specialist agents including DrillCast, EconoBot, RiskRanger, The Core

**Mode-Aware Intelligence:** 
- **Demo Mode**: Uses sample data, mock LLM responses, relaxed validation
- **Production Mode**: Requires API keys, real data, strict validation, full agent orchestration

**Human Escalation:** Confidence scoring with automatic escalation when thresholds not met

## 📊 Sample Output

```json
{
  "investment_decision": "PROCEED",
  "confidence": 0.85,
  "investment_thesis": "Strong Wolfcamp A target with excellent returns",
  "key_metrics": {
    "npv_10": 45000000,
    "irr": 0.28,
    "roi": 3.2,
    "payback_months": 18
  },
  "ai_reasoning": {
    "geologist": "Exceptional reservoir quality in proven fairway",
    "engineer": "Optimal development plan reduces drilling risks", 
    "analyst": "Conservative assumptions still yield strong returns",
    "director": "All investment criteria exceeded with high confidence"
  },
  "human_escalation": false,
  "next_steps": ["Execute LOI", "Begin due diligence", "Schedule board presentation"]
}
```

## 🔄 YAML-Driven Workflows

### Custom Investment Flows

Create your own agentic workflows by modifying YAML configurations:

```yaml
# .claude/agents/geowiz.yaml (example customization)
name: "geowiz"
persona:
  name: "Dr. Sarah Mitchell"
  role: "Senior Petroleum Geologist"
  experience: "15+ years unconventional reservoirs"
  personality: "Detail-oriented, risk-aware, data-driven"
  confidenceThreshold: 0.75
  escalationCriteria:
    - "geological_confidence < 0.6"
    - "high_drilling_risk"
    - "insufficient_data_quality"

cli:
  entrypoint: "npx tsx src/agents/geowiz.ts"
  args: ["--shapefile", "${input.shapefile}", "--region", "${input.region}"]
```

Run with custom parameters:

```bash
# Custom analysis with specific parameters
npx tsx src/mcp.ts --mode=production --goal=tract_eval --run-id=custom_analysis

# Different pipeline modes
npm run pipeline:batch    # Batch processing mode
npm run pipeline:research # Research and development mode
```

## 🚨 Human-in-the-Loop Escalation

When AI agents encounter uncertainty, they escalate to humans:

```bash
# Check for escalations
ls ./data/outputs/${RUN_ID}/ESCALATION_*.json

# Review escalation reasoning
cat ./data/outputs/${RUN_ID}/ESCALATION_REQUIRED.json
```

Example escalation:
```json
{
  "escalation_reason": "Geological uncertainty requires expert review",
  "director_reasoning": "GeoWiz confidence only 65% due to limited log data",
  "human_review_required": ["Senior Geologist", "Investment Committee"],
  "recommendation": "Acquire additional seismic before proceeding"
}
```

## ⚡ Advanced Usage

### Real Data Integration

```bash
# Use your actual data
npx tsx src/mcp.ts \
  --mode=production \
  --goal=tract_eval \
  --run-id=real_data_analysis

# Place your data files in:
# data/samples/your_tract.shp.txt
# data/samples/your_logs.las  
# data/samples/your_db.accdb.txt
```

### Batch Processing

```bash
# Process multiple tracts with batch mode
npm run pipeline:batch

# Or process individually
for tract in ./data/tracts/*.shp.txt; do
  RUN_ID="batch_$(basename $tract .shp.txt)"
  npx tsx src/mcp.ts --mode=batch --run-id=$RUN_ID
done
```

### Development and Testing

```bash
# Development mode with hot reload
npm run dev

# Type checking and linting
npm run type-check
npm run lint

# Clean build for production
npm run clean && npm run build
```

---

## 💡 Next Steps

- **📚 Read the [Architecture Guide](docs/architecture.md)** - Understand how agents work together
- **🔧 Customize Agent Personas** - Adapt agents to your company's investment criteria  
- **🏗️ Add Custom Data Sources** - Connect to your geological databases
- **📊 Build Custom Reports** - Create executive dashboards and presentations
- **🔄 Set Up CI/CD** - Automate tract evaluation workflows

---

**🎯 GOAL ACHIEVED:** What used to take 100+ employees and 17+ weeks now runs in 2 hours with consistent, expert-level analysis. Your AI investment team is ready to democratize oil & gas investing.