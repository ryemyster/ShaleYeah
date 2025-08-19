# SHALE YEAH Quick Start Guide

> **🎯 From Raw Data to Investment Decision in 2 Hours**

## 🚀 Basic Agentic Workflow

### 1. Setup (5 minutes)

```bash
# Clone and install
git clone https://github.com/your-org/ShaleYeah.git
cd ShaleYeah
pip install -r requirements.txt

# Set your LLM API key for intelligent agents
export ANTHROPIC_API_KEY=your_claude_api_key
# OR export OPENAI_API_KEY=your_openai_key

# Verify setup
python mcp.py --help
```

### 2. Run Intelligence-Driven Analysis (30 seconds)

```bash
# Basic investment analysis (uses demo data if no real data provided)
export RUN_ID=$(date +%Y%m%d-%H%M%S)
python mcp.py --goal tract_eval --run-id $RUN_ID

# Watch AI agents work
tail -f ./data/outputs/${RUN_ID}/agent_log.txt
```

### 3. Review AI Agent Decisions (2 minutes)

```bash
# View final investment recommendation
cat ./data/outputs/${RUN_ID}/SHALE_YEAH_REPORT.md

# See AI reasoning from each expert
cat ./data/outputs/${RUN_ID}/investment_decision.json
```

## 🧠 What Just Happened?

**The AI Director orchestrated 7 specialist agents:**

1. **🪨 GeoWiz** (AI Geologist): *"Based on log analysis, this Wolfcamp A interval shows excellent porosity..."*
2. **🔧 DrillCast** (AI Engineer): *"Recommend 10,000ft laterals with 60-stage completion..."*
3. **📋 TitleTracker** (AI Landman): *"Clean title with 75% NRI confirmed..."*
4. **💰 EconoBot** (AI Analyst): *"NPV of $45M at 10% discount rate, 3.2x ROI..."*
5. **⚠️ RiskRanger** (AI Risk Manager): *"Medium risk profile, commodity exposure manageable..."*
6. **🎯 The Core** (AI Director): *"PROCEED - Strong IRR of 28% exceeds 25% threshold..."*
7. **📑 NotaryBot** (AI Legal): *"LOI drafted with standard terms and conditions..."*

**Human Escalation:** If any agent has <70% confidence, the Director escalates to human review.

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
# config/custom-investment-flow.yaml
flow_name: "high_grading_analysis"

orchestration:
  mode: "intelligent"
  director_persona: "Conservative Investment Director"
  
  decision_logic:
    - if: "geological_confidence < 0.8"
      then: "escalate_to_human"
    - if: "roi < 4.0" 
      then: "escalate_to_human"

agent_personas:
  geowiz:
    personality: "Highly conservative, requires exceptional data quality"
    confidence_threshold: 0.8
  
  econobot:
    personality: "Pessimistic assumptions, stress-test focused"
    required_roi: 4.0
```

Run your custom flow:

```bash
python mcp.py --config config/custom-investment-flow.yaml --run-id custom_analysis
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
python mcp.py \
  --las-files ./data/well_logs/*.las \
  --tract-shapefile ./data/tracts/prospect.shp \
  --region "Permian" \
  --run-id real_data_analysis
```

### Batch Processing

```bash
# Process multiple tracts
for tract in ./prospects/*.shp; do
  RUN_ID="batch_$(basename $tract .shp)"
  python mcp.py --tract-shapefile $tract --run-id $RUN_ID
done
```

### Integration with Existing Systems

```bash
# Export results to your CRM/ERP
python scripts/export_to_crm.py --run-id $RUN_ID
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