# SHALE YEAH 🛢️ 

**Multi-Agent Oil & Gas Analysis Platform**

SHALE YEAH is an intelligent multi-agent system that transforms raw geological and engineering data into actionable investment decisions for oil and gas development. By orchestrating specialized agents through a sophisticated control plane, it provides comprehensive tract evaluation from geological interpretation through economic modeling to investment recommendations.

## 🎯 Value Proposition

### **For Engineers**
- **Instant Analysis**: Transform weeks of manual analysis into minutes of automated processing
- **Consistent Quality**: Standardized workflows eliminate human error and ensure reproducible results  
- **Expert Knowledge**: Built-in domain expertise for Permian, Bakken, and other major plays

### **For Investment Teams**
- **Data-Driven Decisions**: Transparent criteria with quantified uncertainty and risk assessment
- **3x ROI Enforcement**: Rigorous financial thresholds prevent value-destroying investments
- **Executive Reporting**: Investment-grade reports ready for committee presentations

### **For Operations Teams**
- **Risk Mitigation**: Comprehensive risk scoring with Monte Carlo simulation
- **Integration Ready**: SIEM, GIS, and mining software integrations for operational continuity
- **Scalable Processing**: Handle hundreds of tracts with consistent quality and speed

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Raw Data      │ -> │  Multi-Agent     │ -> │ Investment      │
│                 │    │  Control Plane   │    │ Decision        │
│ • LAS Logs      │    │                  │    │                 │
│ • Access DBs    │    │ ┌──────────────┐ │    │ • Go/No-Go      │
│ • Shapefiles    │    │ │    geowiz    │ │    │ • LOI Generation│
│ • Market Data   │    │ │ curve-smith  │ │    │ • Risk Analysis │
└─────────────────┘    │ │  drillcast   │ │    │ • NPV/IRR/ROI   │
                       │ │  titletracker│ │    └─────────────────┘
                       │ │   econobot   │ │
                       │ │  riskranger  │ │
                       │ │   the-core   │ │
                       │ │  notarybot   │ │
                       │ │   reporter   │ │
                       │ └──────────────┘ │
                       └──────────────────┘
```

### **Agent Specializations**

| Agent | Function | Inputs | Outputs |
|-------|----------|---------|---------|
| **geowiz** | Geological interpretation | LAS logs, shapefiles | zones.geojson, geology_summary.md |
| **curve-smith** | Log data QC & fitting | LAS files, zones | curves/*.csv, qc_report.md |  
| **drillcast** | Drilling & production forecasting | Geological zones | drill_forecast.json, well_locations.geojson |
| **titletracker** | Ownership & title analysis | Access databases, legal docs | ownership.json, title_analysis.md |
| **econobot** | Economic modeling | Production forecasts, costs | valuation.json, npv_breakdown.md |
| **riskranger** | Risk assessment & scoring | All prior analyses | risk_score.json, risk_analysis.md |
| **the-core** | Investment decision logic | Economics, risk, ownership | investment_decision.json, recommendation.md |
| **notarybot** | Legal document generation | Investment decisions | loi.md, term_sheet.json |
| **reporter** | Executive reporting | All agent outputs | SHALE_YEAH_REPORT.md |

## 🚀 Quick Start

### **Prerequisites**
- Python 3.8+ with pandas, numpy, scipy
- Node.js 18+ with TypeScript support
- Git with LFS for large data files

### **Installation**

```bash
# Clone repository
git clone https://github.com/your-org/ShaleYeah.git
cd ShaleYeah

# Install dependencies
npm install
pip install -r requirements.txt

# Initialize sample data
npm run init
```

### **Basic Usage**

```bash
# Set run parameters
export RUN_ID=$(date +%Y%m%d-%H%M%S)
export OUT_DIR=./data/outputs/${RUN_ID}

# Run tract evaluation pipeline
python mcp.py --goal tract_eval --run-id $RUN_ID

# View results
cat ./data/outputs/${RUN_ID}/SHALE_YEAH_REPORT.md
```

### **Pipeline Modes**

| Mode | Description | Use Case |
|------|-------------|----------|
| **demo** | Synthetic data smoke test | System validation, training |
| **batch** | Production tract processing | Investment screening, portfolio analysis |  
| **research** | Market analysis & RFC generation | Competitive intelligence, integration planning |

## 📊 Example Output

### **Investment Decision Matrix**
```markdown
**DECISION: PROCEED**
**Confidence Level:** HIGH  
**Composite Score:** 78/100

| Criteria | Status | Threshold | Actual |
|----------|---------|-----------|---------|
| NPV ($M) | ✅ PASS | $300K | $2.5M |
| IRR | ✅ PASS | 25% | 28% |  
| ROI | ✅ PASS | 3.0x | 3.5x |
| Payback | ✅ PASS | 14 mo | 12 mo |
```

### **Generated Files**
- `investment_decision.json` - Structured decision data
- `decision_matrix.md` - Criteria evaluation breakdown  
- `recommendation.md` - Executive summary with next steps
- `loi.md` - Letter of Intent ready for execution
- `SHALE_YEAH_REPORT.md` - Comprehensive analysis report

## ⚙️ Configuration

### **Investment Thresholds**
Edit `.claude/agents/the-core.yaml`:

```yaml
investment_criteria:
  financial_thresholds:
    minimum_npv: 300000      # $300K minimum NPV
    minimum_irr: 0.25        # 25% minimum IRR  
    minimum_roi: 3.0         # 3x minimum ROI
    maximum_payback: 14      # 14 months max payback
```

### **Environment Variables**
```bash
# Required
RUN_ID=unique-run-identifier
OUT_DIR=./data/outputs/${RUN_ID}

# Optional integrations  
SPLUNK_HEC_TOKEN=your-token
SENTINEL_BEARER=your-bearer
ELASTIC_API_KEY=your-key
```

## 🔌 Integrations

### **SIEM Integration**
Connect to security and operations platforms:

```bash
# Splunk HEC
export SPLUNK_HEC_TOKEN=your-token
python integrations/siem/splunk_connector.py

# Microsoft Sentinel  
export SENTINEL_BEARER=your-bearer
python integrations/siem/sentinel_connector.py
```

### **GIS Integration**
Spatial analysis and mapping:

```bash
# ArcGIS REST API
python integrations/gis/arcgis_connector.py --feature-service-url $URL

# QGIS Processing
python integrations/gis/qgis_processor.py --project-file tract_analysis.qgs
```

### **Mining Software**
Connect to reservoir modeling platforms:

```bash
# OMF (Open Mining Format)
python integrations/mining/omf_export.py --zones zones.geojson

# Petrel Integration  
python integrations/mining/petrel_connector.py --project $PROJECT_FILE
```

## 🧪 Testing

### **Unit Tests**
```bash
# Run agent unit tests
python -m pytest tests/agents/

# Run integration tests  
python -m pytest tests/integration/

# Run end-to-end pipeline
bash scripts/test-pipeline.sh
```

### **Quality Gates**
Each agent includes built-in quality validation:

```bash
# Geological interpretation confidence
grep -q "confidence.*0\.[89]" ${OUT_DIR}/geology_summary.md

# Curve quality control
grep -q "RMSE.*NRMSE" ${OUT_DIR}/qc_report.md

# Investment decision completeness
grep -q "PROCEED\|NO_GO" ${OUT_DIR}/investment_decision.json
```

### **Validation Scripts**
```bash
# Check branding and attribution
bash scripts/verify-branding.sh

# Validate output formats
bash scripts/validate-outputs.sh $OUT_DIR

# Test agent connectivity  
bash scripts/health-check.sh
```

## 🚀 Deployment

### **Local Development**
```bash
# Development server
npm run dev

# Local pipeline execution
python mcp.py --goal tract_eval --run-id local-test
```

### **Production Deployment**

#### **Docker Compose**
```bash
# Clean build and deploy
docker-compose down --volumes --remove-orphans
docker-compose build --no-cache  
docker-compose up -d --force-recreate
```

#### **Cloud Platforms**

**Render/Railway:**
```bash
# Set environment variables in platform dashboard
RUN_ID=$(date +%Y%m%d-%H%M%S)
OUT_DIR=./data/outputs/${RUN_ID}
NODE_ENV=production

# Deploy with automatic builds
git push origin main
```

**AWS/GCP/Azure:**
```bash
# Container registry push
docker build -t shale-yeah:latest .
docker tag shale-yeah:latest your-registry/shale-yeah:latest
docker push your-registry/shale-yeah:latest

# Infrastructure as Code deployment
terraform apply -var="image=your-registry/shale-yeah:latest"
```

### **Environment Configuration**
```bash
# Production secrets (never commit)
cp config/env/production.env.template config/env/production.env
# Edit config/env/production.env with actual credentials

# Staging configuration  
cp config/env/staging.env.template config/env/staging.env
```

## 🔄 Development Workflow

### **Adding New Agents**

1. **Create Agent Class**
```python
from shared import BaseAgent

class MyNewAgent(BaseAgent):
    def __init__(self, output_dir: str, run_id: str):
        super().__init__(output_dir, run_id, 'my-new-agent')
    
    def _initialize_agent(self):
        self.expected_outputs = {
            'output_file.json': self.output_dir / "output_file.json"
        }
```

2. **Create Agent YAML**
```yaml
# .claude/agents/my-new-agent.yaml
name: my-new-agent
description: "Description of agent functionality"
inputs:
  required:
    - input_data: "Required input description"
outputs:
  - name: output_file.json
    path: "${OUT_DIR}/output_file.json"
```

3. **Add Pipeline Integration**
```python
# Update mcp.py agent registry
def _load_agent_registry(self):
    # Agent loading automatically discovers new YAML files
    pass
```

### **Testing New Features**
```bash
# Create feature branch
git checkout -b feature/new-agent-functionality

# Implement with tests
python -m pytest tests/agents/test_my_new_agent.py

# Integration testing
export RUN_ID=test-$(date +%Y%m%d-%H%M%S)  
python mcp.py --goal tract_eval --run-id $RUN_ID

# Validate outputs
bash scripts/validate-outputs.sh ./data/outputs/$RUN_ID
```

### **Code Quality Standards**
```bash
# Linting and formatting
ruff format agents/
ruff check agents/

# Type checking
mypy agents/

# Security scanning  
bandit -r agents/
```

## 📚 Documentation

### **API Documentation**
```bash
# Generate API docs
pydoc-markdown > docs/api.md

# View agent specifications
ls .claude/agents/*.yaml
```

### **Architecture Decisions**
- [Multi-Agent Design](docs/architecture/multi-agent-design.md)
- [Investment Criteria](docs/business/investment-criteria.md)
- [Integration Patterns](docs/integration/patterns.md)

### **Troubleshooting**
- [Common Issues](docs/troubleshooting/common-issues.md)
- [Agent Debugging](docs/troubleshooting/agent-debugging.md)
- [Performance Tuning](docs/troubleshooting/performance.md)

## 🛡️ Security

### **Data Protection**
- No secrets in code or version control
- Environment-based credential management
- PII detection and redaction in Access database processing
- Configurable data retention policies

### **Access Control**
- Agent-level permission isolation
- API key rotation support
- Integration-specific security controls
- Audit logging for all processing activities

### **Compliance**
- SLSA provenance for all releases
- CodeQL security scanning
- Gitleaks secret detection  
- Signed commits and releases

## 📈 Performance & Scaling

### **Benchmarks**
- **Single Tract Analysis**: < 2 minutes end-to-end
- **Batch Processing**: 100 tracts/hour on standard hardware
- **Memory Usage**: < 1GB per tract analysis
- **Storage**: ~50MB outputs per tract

### **Optimization Tips**
```bash
# Parallel agent execution
python mcp.py --goal tract_eval --parallel --max-workers 4

# Memory optimization
export PYTHON_GC_OPTIMIZATION=1
python -O mcp.py --goal tract_eval --run-id $RUN_ID

# Output compression
export COMPRESS_OUTPUTS=1
```

## 🤝 Contributing

### **Development Setup**
```bash
# Fork and clone
git clone https://github.com/yourusername/ShaleYeah.git
cd ShaleYeah

# Install development dependencies
npm install --include=dev
pip install -r requirements-dev.txt

# Set up pre-commit hooks
pre-commit install
```

### **Contribution Guidelines**
1. Follow established agent patterns in `agents/shared/base_agent.py`
2. Include unit tests for all new functionality
3. Update documentation for API changes
4. Ensure SHALE YEAH branding compliance
5. Add integration tests for new agent types

### **Pull Request Process**
1. Create feature branch with descriptive name
2. Implement changes with tests and documentation
3. Validate with full pipeline test: `bash scripts/test-pipeline.sh`
4. Submit PR with detailed description and testing evidence
5. Address review feedback and ensure CI passes

## 📄 License

**Apache License 2.0**

Copyright (c) 2024 Ryan McDonald / Ascendvent LLC

Licensed under the Apache License, Version 2.0 (the "License"). See [LICENSE](LICENSE) file for details.

### **Attribution Requirement**
All outputs must include: `Generated with SHALE YEAH (c) Ryan McDonald / Ascendvent LLC - Apache-2.0`

## 🎉 Acknowledgments

- **Domain Experts**: Oil and gas professionals who provided industry knowledge
- **Open Source Community**: NumPy, Pandas, and scientific Python ecosystem  
- **Beta Testers**: Early adopters who provided valuable feedback

---

**Ready to transform your oil and gas analysis?** Start with `npm run init` and run your first tract evaluation in minutes.

*Built with ❤️ for the energy industry*