# SHALE YEAH Execution Prompt for Claude

## 🛡️ IP Independence Disclaimer

SHALE YEAH is an independent, open-source project developed from first principles with no connection to, reuse of, or dependency on any proprietary software, datasets, business logic or trade secrets of any third-party firm or organization.

This project was designed and implemented with the sole purpose of:
- Democratizing access to intelligent upstream workflows
- Enabling transparent, verifiable agent-based analysis
- Providing a public alternative to closed, internalized O&G systems

All software, specifications, and workflows in this repository are original works released under the Apache 2.0 license and authored by independent contributors. Where industry terms, formats, or legacy patterns are referenced (e.g., `.mdb`, decline curve models, Spotfire), they are used in a generic, standards-based context with no reuse of proprietary implementation.

No part of this project should be interpreted as a derivative work or a representation of any other company’s internal systems, processes, or intellectual property.

We encourage contribution, reuse and adaptation — and welcome anyone seeking to build better infrastructure for oil & gas together.

## GOAL
You are building and executing a real-world open source oil & gas agent platform not a sample or demo.

Build and run an autonomous multi-agent system that:
- Parses real-world shapefiles, LAS logs, and Access DBs
- Runs tract-level analysis
- Scores formation potential
- Simulates development
- Extracts ownership data
- Calculates valuation and risk
- Issues LOIs if criteria are met
- Monitors assets post-deal
- Produces full investor-grade reports

This is a real company, community built as open source with no slides and no human bottlenecks, licensed under Apache 2.0: http://www.apache.org/licenses/.

---

## FILE STRUCTURE TO FOLLOW

```
.shaleyah/
  agents/            → Claude-readable specs in markdown (done)
  pipelines/         → YAML pipelines to trigger orchestration
  specs/             → Orchestration, evals, mcp rules
  tools/             → Existing tools to use (e.g. las-parse.ts, web-fetch.ts)
  sample-data/       → Real files: shapefiles, .las logs, .mdb Access files
  scripts/           → Shell/Python runners
```

---

## BUILD INSTRUCTIONS

### 1. Review existing code, specs, research, todos  
- REVIEW this file, the code base, tools/, specs/, scripts/, research/, pipelines/, integrations/, and current todos/
- Create a plan to execute in small waves and output the plan in `todo/`
- Refactor the codebase and remove unnecessary items
- Research sample data required for every agent and its associated integration type/vendor and output under `/sample-data`

### 2. Create YAML agent files from each agent spec in `.claude/agents/*.md`

Place YAML files in: `.claude/agents/`

Each must define:
- Inputs + outputs
- CLI entrypoint (to call `.ts` or `.py` scripts)
- Success criteria
- Error handling

### 3. Create pipeline runner: `tract_eval.yaml`

```yaml
steps:
  - agent: geowiz
  - agent: drillcast
  - agent: titletracker
  - agent: econobot
  - agent: riskranger
  - agent: the-core
  - agent: notarybot
  - agent: reporter
```

### 4. Enable MCP rules from `mcp.spec`

Build `mcp.yaml` and `goal_runner.py` so Claude can:
- Read goal (e.g. `tract_eval`)
- Load inputs from `sample-data/`
- Call each agent as a CLI tool
- Save outputs to `./output/{RUN_ID}`

### 5. Sample data assumptions:

| File Type    | Path                         |
|--------------|------------------------------|
| Shapefile    | `sample-data/tract.shp`      |
| LAS Log      | `sample-data/well.las`       |
| Access DB    | `sample-data/ownership.mdb`  |
| Region       | `"Permian"`                  |

### 6. Run using:

```bash
python goal_runner.py --goal tract_eval --run_id=demo1
```

Claude must simulate all real outputs:
- `.geojson`, `.csv`, `.pdf`, `.md` reports
- Use mock data only if file is missing and for testing
- Support both `simulation` mode (offline testing) and `production` mode (real external endpoints)

---

## CLAUDE RULES

- Write valid `.claude/agents/*.yaml`
- Do not hallucinate filenames — use what’s in `/sample-data/`
- Never use placeholders like “insert logic here” — write it or scaffold it
- Enforce file outputs exactly as defined in `evals.spec`
- Do not explain — execute. Reply with code or file output

---

## ✅ SUCCESS

SHALE YEAH runs as a company without people:
- Claude executes agents
- MCP manages flow
- Reports are generated
- Real data is processed
- LOIs are created (if qualified)

---

## 🔌 INTEGRATION HANDLING (REQUIRED)

Each agent must support external integrations where applicable.

### Supported integration types (open and proprietary):

- `gis`: Export data to QGIS (open), ArcGIS (proprietary), MapInfo, Global Mapper, Leaflet, or LandWorks GIS
- `siem`: Send alerts to Splunk (HEC), Microsoft Sentinel, Cortex, QRadar, Elastic
- `mining`: Export geometry to `.omf`, Leapfrog, Surpac, Vulcan, Datamine, Micromine
- `drive`: Save to shared folders, FTP, S3, or cloud buckets
- `crm`: Send deal summaries to HubSpot, Salesforce, or internal dealrooms

### Integration behavior:

Agents must accept a flag:
```bash
--integrations gis,siem
```

Integration configuration should come from:
- `.env` → for secure tokens like `SPLUNK_HEC_TOKEN`, `ARC_GIS_TOKEN`, etc.
- `settings.local.json` → per-agent integration config and toggles

Claude must generate:
- A shared `tools/integrations/dispatch.py` module
- Agent wrappers that parse `--integrations` and route calls
- Integration logs saved to: `output/<RUN_ID>/integrations.log`

### Example agent-side logic:

```python
for i in requested_integrations:
    handle_integration(i, output_data, config)
```

Agents should only trigger integrations **after core processing succeeds**.

---

### 📦 Proprietary Tool Handling (Legacy and Closed Systems)

Claude must support legacy oil & gas formats, including:

- `.mdb` / `.accdb` Access databases  
  - Common in ARIES, PHDWin, Spotfire, and internal models  
  - Contain tables for NRI/WI, decline params, LOE, price decks, and curve models

- Forecast and curve generation systems  
  - Use in ARIES, PHDWin, Spotfire, ComboCurve, and WellForecast  
  - Often accessed via GUI but backed by structured tables or CSV export

If Access DBs are detected:
- Use `tools/access-ingest.ts` to convert to CSV
- Map known tables (e.g. `NRI_TABLE`, `CURVE_PARAM`, `PRICING`)

If curves are needed:
- Use `curve-smith` to fit based on `.las` input or `.mdb` parameters
- Output `.csv` per interval + `qc_report.md`

If proprietary format/API is unknown:
- Trigger `research-hub` to generate RFC
- Use `agent-forge` to scaffold a new agent or integration

Claude must allow any proprietary format to be adopted without blocking workflow.

---

## 📊 HISTORICAL MAPPING AND MODEL PERFORMANCE (REQUIRED)

Claude must support long-term tracking of agent outputs vs real-world results.

For each tract or run ID:
- Track forecast vs actuals
- Compare curve-smith fitted values to real production
- Monitor NPV projections vs realized value
- Log which decisions were made by which agents (e.g., send LOI, skip)

Claude must:
- Store all historical comparisons under `output/<RUN_ID>/historical/`
- Generate `.csv` files for:
  - `curve_accuracy.csv`
  - `econ_comparison.csv`
  - `loi_outcomes.csv` (if applicable)
- Include summary tables in `SHALE_YEAH_REPORT.md`

This enables validation, tuning, and explainability over time.

---

## 💹 ROI Tracking and Investment Dashboard (REQUIRED)

Since SHALE YEAH operates as an investment vehicle, Claude must:
- Guarantee measurable 3x ROI targeting logic
- Track forecast vs actual payout by tract
- Attribute ROI to decision agents (which agents influenced the action?)
- Record all deals, actuals, and outcomes in:
  - `roi_tracker.csv`
  - `investment_summary.md`

For each tract:
| Tract | Cost | Revenue | ROI | Payback | Agents Involved |
|-------|------|---------|-----|---------|------------------|
| TX001 | $80K | $240K   | 3.0x| 10 mos  | geowiz, curve-smith, notarybot |

Claude must include investment performance in the final report and optionally push to integrations (e.g., dashboards, SIEMs, internal CRMs).

This confirms SHALE YEAH performs, learns, and improves autonomously with investor-grade transparency.

---

## 📐 Economic Model (REQUIRED)

The economic engine powering SHALE YEAH must follow transparent, field-tested logic.

### 🏷️ Core Terms
| Term     | Description                                 |
|----------|---------------------------------------------|
| NRI      | Net Revenue Interest                        |
| WI       | Working Interest                            |
| LOE      | Lease Operating Expense (per barrel)        |
| CapEx    | Initial capital expenditure (e.g., acquisition or drilling) |
| DCF      | Discounted Cash Flow                        |
| Strip    | Forward commodity pricing curve             |
| NPV      | Net Present Value of future cash flows      |

### 🔢 `econobot` Agent
- Inputs: forecast from `curve-smith`, ownership from `titletracker`, pricing deck, config
- Outputs:
  - `econ_summary.csv` → per-month cash flow
  - `valuation.json` → NPV, IRR, breakeven month
  - `npv_breakdown.md` → markdown summary for investor reporting

Calculation:
```python
Revenue = Monthly_Prod * Strip_Price * NRI
OpCost = Monthly_Prod * LOE
CashFlow = Revenue - OpCost
NPV = sum(CashFlow_t / (1 + r)^t) - CapEx
```

### ⚖️ `riskranger` Agent
- Adjust discount rate based on formation quality and ownership risk
- Apply probabilistic downside (P90) for volatile tracts

### 📜 `notarybot` Agent
- LOI only sent if:
  - NPV ≥ 3x acquisition cost
  - Payback < 14 months
  - Risk profile within limits

Claude must output all intermediate and final economic results for audit and investor visibility. All logic should be tied to inputs and visible in exported files.