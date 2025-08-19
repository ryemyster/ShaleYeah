# SHALE YEAH Usage Guide

SHALE YEAH can operate in two modes: **Deterministic** (algorithmic) or **LLM-Enhanced** (intelligent analysis).

## 🎯 Quick Start (No API Keys Required)

### Basic Tract Evaluation
```bash
# Set run parameters
export RUN_ID=$(date +%Y%m%d-%H%M%S)

# Run complete tract evaluation
python mcp.py --goal tract_eval --run-id $RUN_ID

# View results
cat ./data/outputs/${RUN_ID}/SHALE_YEAH_REPORT.md
```

### Individual Agent Testing
```bash
# Test geological analysis
python agents/geowiz_agent.py \
  --shapefile=data/samples/tract.shp.txt \
  --region=Permian \
  --output-dir=./outputs/test \
  --run-id=test

# Test economic modeling  
python agents/econobot_agent.py \
  --drill-forecast=./outputs/test/drill_forecast.json \
  --ownership-data=./outputs/test/ownership.json \
  --output-dir=./outputs/test \
  --run-id=test
```

## 🧠 LLM-Enhanced Mode (Optional)

### Setup API Keys
```bash
# For Anthropic Claude (Recommended)
export ANTHROPIC_API_KEY=your_claude_api_key

# OR for OpenAI GPT
export OPENAI_API_KEY=your_openai_api_key

# Specify provider (optional - defaults to claude)
export LLM_PROVIDER=claude
```

### Enhanced Tract Evaluation
```bash
# Same command - automatically detects API keys
export RUN_ID=llm-enhanced-$(date +%Y%m%d-%H%M%S)
python mcp.py --goal tract_eval --run-id $RUN_ID

# Enhanced outputs will include:
# - Intelligent geological interpretation
# - Reasoned investment analysis  
# - Natural language explanations
# - Confidence-scored insights
```

## 📊 What Each Mode Provides

### Deterministic Mode (Default)
**Geological Analysis (geowiz):**
- Formation identification from regional templates
- Depth interval calculations
- Confidence scoring based on data quality

**Economic Modeling (econobot):**
- NPV/DCF calculations with 10% discount rate
- IRR calculation using Newton-Raphson method
- ROI and payback period analysis
- Monte Carlo risk simulation

**Investment Decision (the-core):**
- 3x ROI threshold enforcement
- 25% minimum IRR requirement
- Risk scoring against thresholds
- Transparent decision matrix

### LLM-Enhanced Mode
**Geological Analysis (geowiz + LLM):**
```
✅ Formation identification (deterministic)
+ 🧠 Intelligent log interpretation
+ 🧠 Hydrocarbon potential assessment
+ 🧠 Drilling risk analysis
+ 🧠 Natural language geological insights
```

**Economic Modeling (econobot + deterministic):**
```
✅ Precise NPV/IRR calculations (deterministic)
+ 🧠 Market timing analysis
+ 🧠 Competitive positioning insights
+ 🧠 Scenario planning recommendations
```

**Investment Decision (the-core + LLM):**
```
✅ Threshold compliance checking (deterministic)
+ 🧠 Investment reasoning and rationale
+ 🧠 Risk factor identification
+ 🧠 Strategic opportunity analysis
+ 🧠 Executive-level explanations
```

## 🔧 Configuration Options

### LLM Provider Selection
```bash
# Use Claude (recommended for analysis)
export LLM_PROVIDER=claude
export ANTHROPIC_API_KEY=your_key

# Use OpenAI GPT
export LLM_PROVIDER=openai  
export OPENAI_API_KEY=your_key

# Disable LLM (deterministic only)
export LLM_PROVIDER=disabled
```

### Cost Control
```bash
# Set monthly spending limit
export LLM_MAX_MONTHLY_SPEND=100

# Use faster/cheaper models
export LLM_MODEL=claude-3-haiku-20240307
# or
export LLM_MODEL=gpt-3.5-turbo
```

### Agent-Specific Configuration
Edit `config/llm-config.yaml`:
```yaml
agents:
  geowiz:
    llm_enabled: true      # Enable LLM for geological interpretation
  econobot:
    llm_enabled: false     # Keep deterministic for financial precision
  the-core:
    llm_enabled: true      # Enable LLM for investment reasoning
```

## 📈 Performance Comparison

| Mode | Speed | Cost | Consistency | Intelligence | Use Case |
|------|-------|------|-------------|--------------|----------|
| **Deterministic** | ⚡ Fast<br>(~2 min) | 💰 Free | 🎯 100%<br>Reproducible | 📊 Rule-based | Production screening |
| **LLM-Enhanced** | 🐌 Slower<br>(~5 min) | 💸 $5-20/run | 🎲 95%<br>Consistent | 🧠 Intelligent | Investment analysis |

## 🎯 Recommended Usage Patterns

### Production Screening (Deterministic)
```bash
# Fast, consistent tract screening
for tract in tract_list/*.shp; do
  RUN_ID="screen_$(basename $tract .shp)"
  python mcp.py --goal tract_eval --run-id $RUN_ID --tract=$tract
done
```

### Investment Committee Analysis (LLM-Enhanced)  
```bash
# Detailed analysis for investment decisions
export ANTHROPIC_API_KEY=your_key
export RUN_ID="investment_analysis_$(date +%Y%m%d)"
python mcp.py --goal tract_eval --run-id $RUN_ID --detailed-analysis
```

### Hybrid Workflow (Best of Both)
```bash
# 1. Fast screening (deterministic)
python mcp.py --goal tract_eval --run-id screen_$TRACT

# 2. Enhanced analysis for promising tracts
if grep -q "PROCEED" ./outputs/screen_$TRACT/investment_decision.json; then
  export ANTHROPIC_API_KEY=your_key
  python mcp.py --goal tract_eval --run-id detailed_$TRACT
fi
```

## 🔍 Output Examples

### Deterministic Output
```json
{
  "decision": "PROCEED",
  "composite_score": 78,
  "financial_metrics": {
    "npv_10": 2500000,
    "irr": 0.28,
    "roi": 3.5
  }
}
```

### LLM-Enhanced Output
```json
{
  "decision": "PROCEED", 
  "composite_score": 78,
  "financial_metrics": {
    "npv_10": 2500000,
    "irr": 0.28, 
    "roi": 3.5
  },
  "llm_insights": {
    "investment_rationale": "Strong IRR of 28% driven by excellent Wolfcamp A porosity and proven offset production. Market timing favorable with current oil prices.",
    "key_risks": ["Commodity price volatility", "Completion optimization needs"],
    "strategic_value": "Positions portfolio in core Permian acreage with drilling inventory scale",
    "confidence": 0.85
  }
}
```

## 🚀 Getting Started Recommendations

### For Oil & Gas Engineers
```bash
# Start with deterministic mode - fast and reliable
python mcp.py --goal tract_eval --run-id your_first_run
```

### For Investment Teams  
```bash
# Use LLM-enhanced for investment decisions
export ANTHROPIC_API_KEY=your_key
python mcp.py --goal tract_eval --run-id investment_analysis
```

### For Operations Teams
```bash
# Batch processing for portfolio analysis
bash scripts/batch-evaluation.sh tract_portfolio/
```

## 💡 Tips for Success

1. **Start Deterministic:** Learn the system with free deterministic mode first
2. **LLM for Decisions:** Use LLM enhancement for final investment decisions  
3. **Cost Control:** Set spending limits when using LLM mode
4. **Validate Results:** Always verify LLM insights against deterministic calculations
5. **Hybrid Approach:** Use deterministic for screening, LLM for detailed analysis

---

**Need Help?** 
- 📚 Check `docs/troubleshooting/testing-guide.md` for testing procedures
- 🔌 See `docs/integration/integration-guide.md` for SIEM/GIS integration
- 🐛 Report issues at https://github.com/your-org/ShaleYeah/issues