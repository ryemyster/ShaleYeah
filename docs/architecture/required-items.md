Perfect — here’s a checklist-style bullet list of what must be supported or processed by ShaleYeah to fully simulate a mineral acquisition workflow. This covers everything typically included in O&G model decks exchanged between operators, buyers, and investors:

⸻

✅ ShaleYeah Input Coverage: Mineral Deal Evaluation Files

🔩 Type Curve / Engineering Models
	•	Type curve summary (per formation or operator)
	•	Decline curve model (exponential, harmonic, or hybrid)
	•	EUR (Estimated Ultimate Recovery) per well / per zone
	•	Initial production (IP30/IP90) assumptions
	•	Well spacing and lateral length assumptions

📊 Economic Forecasts & Assumptions
	•	NPV10, IRR, and payback period metrics
	•	Flat vs. escalated commodity pricing scenarios (e.g. WTI $60/$75/$90)
	•	Capex and Opex per well assumptions
	•	Sensitivity analysis (price, cost, performance)
	•	Cash flow forecast per DSU or unit

🧾 Production Profiles
	•	Monthly forecasted production (Oil/NG/NGL)
	•	Historical PDP (producing wells) performance
	•	Development schedule (drill/completion timing)
	•	DSU-level or lease-level roll-up support

🗺️ Geospatial & Lease Information
	•	Shapefile / GeoJSON / KMZ support for:
	•	Tract boundaries
	•	Drilling units (DSUs)
	•	Wellbores & pads
	•	Target formations/benches (e.g. Wolfcamp A)
	•	Mapping overlays for:
	•	Nearby comps
	•	Permit activity
	•	Production heatmaps

📚 Well Log / Subsurface Data
	•	LAS file ingestion (Gamma Ray, RHOB, NPHI, DT, etc.)
	•	Formation tops & depth markers
	•	Reservoir properties: porosity, saturation, thickness
	•	Bench targeting logic for geowiz agent

👩‍💼 Land & Title Data
	•	Net Revenue Interest (NRI) and Lease Net Acres
	•	Working Interest (WI), Royalty Interest (RI), ORRI
	•	Lease terms (HBP, expiration, etc.)
	•	Chain of title or ownership verification

📑 Legal & Commercial Documentation
	•	PSA terms, NDAs, and bid instructions
	•	Deal structure: PDP vs PUD vs exploratory
	•	Entity ownership structure if relevant

⸻

🎯 Recommended ShaleYeah Enhancements
	•	Agent: deckparser
→ Parses Excel/PHDWin/ARIES exports into normalized data structures
	•	Agent: valuer or bidbot
→ Recommends bid price per net mineral acre based on modeled value
	•	UI Integration
→ Upload & auto-ingest zip folder containing .las, .shp, .xlsx, and .pdf
	•	Comps Engine
→ Pull offset well data from public APIs (Enverus, TX RRC, NDIC)

⸻

Let me know if you want a checklist.md output, a structured YAML spec for this ingestion pipeline, or a sample folder of mocked files for dev and testing.


# ShaleYeah Agent Input/Output Reference (O&G Focused)

| Agent              | Inputs                                                                 | Outputs                                                            |
|--------------------|------------------------------------------------------------------------|---------------------------------------------------------------------|
| **build-monitor**      | Build configs, CI/CD environment vars, pipeline state                              | Build status, error logs, test results                              |
| **curve-smith**        | Type curve parameters, historical production (monthly), EUR inputs, decline model config | Type curve fit, forecast profile, DCA visual, error metrics         |
| **curve-smith-mcp**    | Curve-smith orchestration config, run trigger                                     | Curve-smith execution output, logs                                  |
| **drillcast**          | Lateral length, depth, spacing, zone, formation target, rig spec                  | CapEx breakdown, drill time, well complexity score                  |
| **econobot**           | Type curves, CapEx, OpEx, NRI, WTI price deck, escalation curve, taxes, WI        | NPV10, IRR, payback, breakeven price, cash flow tables              |
| **econobot-mcp**       | Econobot execution config, dependency chain                                       | Result routing, econ state payload                                  |
| **geowiz**             | LAS logs (GR, RHOB, NPHI, DT), shapefiles, formation tops, petrophysical hints    | Formation summary, porosity, thickness, pay zone tags, risk score  |
| **notarybot**          | Legal doc metadata, title memos, PSA clauses, jurisdiction                        | Redlines summary, compliance checklist, risk memo                   |
| **reporter**           | All agent outputs, investment scores, tract metadata                              | Markdown investment memo, executive summary, CSV export             |
| **reporter-mcp**       | Coordination config, styling options                                              | Hand-off to reporter, render config                                 |
| **research-agent**     | Query string, URL, fetch config                                                   | Cleaned content, stripped HTML, metadata                            |
| **research-hub**       | Set of URLs, classification goals, query topics                                   | Ranked research content, grouped insights                           |
| **riskranger**         | Cash flow outputs, type curve variability, pricing scenarios                      | Risk classification (Low/Med/High), P10/P50/P90 forecasts           |
| **riskranger-mcp**     | Trigger conditions, uncertainty config                                            | Risk agent execution routing                                        |
| **test-agent**         | Mocked agent input data, CLI args                                                 | Debug logs, mocked outputs, test pass/fail                          |
| **the-core**           | All upstream agent outputs, gating thresholds, valuation targets                  | Final investment decision (Buy/Hold/Reject), key driver summary     |
| **the-core-mcp**       | Orchestration state, override logic                                               | Agent routing config, final run output                             |
| **titletracker**       | Lease packet, NRI/RI/WI info, mineral ownership, entity records, plat maps       | Ownership breakdown, net acres, red flags, deal blockers            |

---

## Strategic Coverage for Mineral Acquisition

Each agent aligns with typical files in mineral deck submissions:

- **Type curves →** curve-smith  
- **Economics →** econobot  
- **Geology/LAS →** geowiz  
- **CapEx →** drillcast  
- **Risk →** riskranger  
- **Title →** titletracker  
- **Legal →** notarybot  
- **Summary decks →** reporter  
- **Decision logic →** the-core  

## 💡 What Would Make It Even More Useful?

Here’s what real-world operators, buyers, and analysts might want next:

| **Need**                         | **Solution Direction**                                                                 |
|----------------------------------|----------------------------------------------------------------------------------------|
| 📥 Easier UI for non-technical users | Web-based front end, or Zapier/Notion/GIS integration                                 |
| 📈 More economic levers          | Add support for different type curves, cost models, strip pricing                     |
| 🛢️ Cross-well benchmarking       | Load multiple LAS files and produce portfolio-level roll-ups                          |
| 📍 Location-based insights       | Integrate state regulatory data, offset performance, and public wells                 |
| 🏦 Reserve classification        | Tie outputs to PRMS categories (1P/2P/3P) for investor alignment                       |
| 📤 Export for exec decks         | PDF/PowerPoint export of summary, graphs, and heatmaps                                |
| ⚠️ Decision audits               | Built-in traceability of which data/assumptions drove the outcome                     |
| 🔐 More robust access to vendors | Plugins for Enverus, IHS, geo-spatial overlays                                        |

---

## 🧭 The Real Opportunity

SHALE YEAH isn’t just a one-off tool — it’s a **new layer of industry infrastructure**:

- 🔄 **Loop**: Run investment-grade analysis at the speed of deal flow  
- ⚙️ **Scale**: Automate multi-basin screening with agent-driven intelligence  
- 🛠️ **Build**: Extend and improve it as a *community-owned O&G analysis stack*  
- 📚 **Teach**: Make O&G analysis legible to new entrants, investors, and regulators