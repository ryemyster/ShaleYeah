# SHALE YEAH 🛢️💥

> **The world's first open-source energy intelligence stack**  
> *Democratizing upstream decision-making, one agent at a time*

![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)
![Build Status](https://img.shields.io/github/workflow/status/rmcdonald/shale-yeah/CI)
![Version](https://img.shields.io/badge/version-0.1.0-green.svg)

---

## 💣 Why We're Disrupting

Because oil & gas workflows are broken.
- **Evaluation tools** are locked behind overpriced SaaS walls
- **Deal modeling** is trapped in Excel hell or legacy Access databases  
- **Geologic analysis** is still done in desktop silos
- **Title, curves, and LOIs** are stitched together manually — every time
- Every "modern" tool pretends to help but just creates more lock-in

**We're disrupting this because no one else had the guts to build it open.**

---

## 🛠️ What We Built

SHALE YEAH is an **agent-powered AI platform** that:
- 🗺️ **Turns a shapefile into a geology score** with one click
- 📊 **Runs type curves and economics** without a finance team
- 📄 **Parses title PDFs** like a junior analyst  
- 📝 **Generates LOIs you can send** — without logging into anything
- 📈 **Forecasts well activity** based on operator trends
- 👀 **Monitors assets against projections** like a live analyst

**All using modular AI agents, open data, and zero black boxes.**

We didn't raise a fund. We didn't pitch a startup.  
**We just wrote the damn code and gave it to the people who need it.**

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.8+ (for scientific tools)
- Git

### Installation
```bash
git clone https://github.com/rmcdonald/shale-yeah.git
cd shale-yeah
npm install
```

### Run the Demo
```bash
# Initialize the agent framework
npm run init

# Generate agents from specs
npm run gen

# Run the full pipeline
npm run demo
```

**Outputs land in `data/outputs/<run-id>/`** including:
- `geology_summary.md` - Formation analysis
- `zones.geojson` - Geological zones with depth units
- `curves/*.csv` - QC'd curve data  
- `qc_report.md` - Statistical analysis (RMSE, NRMSE)
- `SHALE_YEAH_REPORT.md` - Executive summary

### Verify It Works
```bash
# Check branding compliance
bash scripts/verify-branding.sh

# Run a single agent locally
bash scripts/run-local.sh
```

---

## 🧠 Agent Architecture

**6 Core Agents** that work standalone or together:

| Agent | Purpose | Inputs | Outputs |
|-------|---------|--------|---------|
| **geowiz** | Geology analysis & well-log interpretation | LAS, shapefiles | geology_summary.md, zones.geojson |
| **curve-smith** | Curve fitting & quality control | LAS files, zones | curves/*.csv, qc_report.md |
| **reporter** | Executive reporting & data provenance | All outputs | SHALE_YEAH_REPORT.md |
| **research-hub** | Technology research & RFC generation | Product names | research/rfcs/*.md |
| **agent-forge** | Agent generation from RFCs | RFCs | New agent YAMLs |
| **research-agent** | Advanced research for future development | Topics | research/reports/*.md |

---

## 🔧 Tools & Integrations

### Core Tools
- `access-ingest.ts` - Convert Access DBs to CSV
- `las-parse.ts` - Extract LAS metadata
- `curve-fit.ts` - Fit missing curves with baselines
- `curve-qc.py` - Statistical analysis (RMSE/NRMSE)
- `web-fetch.ts` - Research data gathering

### Integration Hooks
- **SIEM**: Splunk HEC, Azure Sentinel, QRadar, Elasticsearch, Cortex XSOAR
- **GIS**: ArcGIS REST, QGIS headless, MapInfo/GDAL, GeoMedia WFS
- **Mining**: OMF format, Leapfrog, Surpac, Vulcan, Datamine, Micromine

---

## 📦 Adding New Agents

1. **Create a spec**: `specs/my-agent.spec.md`
```markdown
Name: my-agent
Goal: Describe what it does
Inputs: LAS, CSV, Shapefiles
Outputs: results.md, data.csv
Notes: Keep it simple and focused
```

2. **Generate the agent**: `npm run gen`

3. **Add to pipeline**: Edit `pipelines/shale.yaml`

4. **Test locally**: `bash scripts/run-local.sh`

---

## 🌊 Development Methodology

**Wave-based development** for systematic delivery:

- **Wave 1**: Foundation & Infrastructure ✅
- **Wave 2**: Core Functionality & Pipeline 🚧  
- **Wave 3**: Integration Stubs & Research 📋
- **Wave 4**: CI/CD & Security 📋
- **Wave 5**: Next-Generation Features 📋

See [TODO.md](TODO.md) for detailed roadmap.

---

## 🎯 For Contributors

### We're Looking For
- **Engineers** with GIS, economic modeling, NLP experience
- **Landmen, brokers, consultants** who want to build in public
- **Students and researchers** applying ML to energy

### Contribution Guidelines
- **Small PRs** - Keep changes focused and reviewable
- **No secrets** - Use environment variables for tokens
- **Open formats** - Prefer CSV, GeoJSON, OMF, LAS
- **Attribution** - Include SHALE YEAH footer in outputs
- **Quality gates** - Ensure tests pass and docs are updated

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

---

## 🔒 Security & Compliance

- **No secrets in code** - Environment variables only
- **Automated scanning** - CodeQL, Gitleaks, Dependabot
- **Supply chain security** - SLSA provenance, Cosign signing
- **Open source compliance** - Apache 2.0, proper attribution

Report security issues: [SECURITY.md](SECURITY.md)

---

## 📜 License & Credits

**Apache 2.0 License** - Use it, fork it, build on it.

**Created by Ryan McDonald / Ascendvent LLC**

This project exists to prove that **small teams can disrupt entire industries** when they're willing to build in the open.

---

## 🔗 Links

- **Documentation**: [TODO: Add docs site]
- **Issues**: [GitHub Issues](https://github.com/rmcdonald/shale-yeah/issues)
- **Discussions**: [GitHub Discussions](https://github.com/rmcdonald/shale-yeah/discussions)
- **License**: [Apache 2.0](LICENSE)

---

**Ready to disrupt the industry?** Start with `npm run demo` and see what one person can build.

*Generated with SHALE YEAH (c) Ryan McDonald / Ascendvent LLC - Apache-2.0*