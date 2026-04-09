# research

Conduct focused technical or market research scoped to ShaleYeah's domain — oil & gas investment
analysis, the 14 MCP servers, open-source integrations, industry data standards, and agentic
architecture patterns. Output goes into GitHub issues, integration specs, or architectural decisions.

## Usage

`/research <topic>`

Examples:

- `/research "open-source petrophysics libraries for curve-smith"`
- `/research "WITSML real-time drilling data integration"`
- `/research "Permian Basin production decline benchmarks for econobot"`
- `/research "OSDU schema for formation tops — geowiz compatibility"`
- `/research "commodity price APIs — free tiers and rate limits"`
- `/research "Karpathy loop implementations for geologic uncertainty"`

---

## Domain Context (read before every research run)

ShaleYeah is a **14-server MCP-based agent OS for oil & gas investment analysis**. Every research
output should be grounded in this context:

**The 14 servers and their domains:**

| Server | Domain | Key Data Needs |
|---|---|---|
| `geowiz` | Geological formation analysis, LAS parsing | LAS/DLIS files, formation tops, USGS, OSDU |
| `econobot` | NPV/IRR, DCF, production forecasting | EIA production data, decline curves, commodity prices |
| `curve-smith` | Petrophysics, well engineering | LAS curves, petrophysical models, WITSML |
| `decision` | Investment decision synthesis | All upstream results, market context, risk scores |
| `reporter` | Executive report generation | Structured JSON from all servers → Markdown/PDF |
| `risk-analysis` | Geological + financial risk scoring | USGS geochemistry, Monte Carlo, EIA price history |
| `research` | Market intelligence, web research | EIA API, state OCC portals, commodity feeds |
| `legal` | Regulatory compliance, permitting | BLM, state OCC/OCD, FERC, FracFocus, TX RRC |
| `market` | Commodity prices, market data | EIA, Oil Price API, NYMEX futures, CME Group |
| `title` | Land ownership, title chains | BLM lease dataset, state land offices, PPDM |
| `drilling` | Drilling engineering, costs, AFEs | WITSML, Volve dataset, SPE/IADC benchmarks |
| `infrastructure` | Pipeline, facilities, takeaway | FERC, BLM ROW, state GIS portals |
| `development` | Field development planning | OSDU, OPM Flow, EIA forecasts, PPDM |
| `test` | QA/validation | Volve dataset, USGS public logs, EIA production data |

**Key industry standards to know:**
- **LAS / DLIS** — well log file formats (ASCII vs. binary)
- **WITSML** — real-time wellsite data (XML/SOAP, Energistics)
- **OSDU** — Open Subsurface Data Universe (emerging JSON/REST standard)
- **PPDM** — Professional Petroleum Data Management (relational model, 1,238 tables)
- **ARIES** — common A&D economics database (XML/CSV export, widely used)
- **Volve** — Equinor's 5TB open field dataset (gold-standard free test data)
- **EIA** — U.S. Energy Information Administration (authoritative free API)
- **FracFocus** — hydraulic fracturing chemical disclosure registry (240K+ completions)

**Architectural constraints:**
- All LLM calls go through `src/shared/llm-client.ts` (no direct SDK calls in servers)
- Integrations must be config-driven (`integrations.config.json`) and pluggable
- CI has no API key — integrations must have free-tier or mock support
- No `Math.random()` in business logic — deterministic fallbacks required
- TypeScript strict mode — every integration needs a typed adapter interface

---

## Steps

1. **Clarify scope** — Identify which server(s) the research affects, what decision it informs
   (issue creation, integration spec, architecture choice), and what "done" looks like.

2. **Ground in domain** — Before fetching, state what a real O&G professional would use for
   this problem. Name the tools/datasets they reach for first (e.g., "a petrophysicist would
   use lasio + PetroPy before writing custom LAS parsing").

3. **Research** — Fetch relevant sources. Prioritize in this order:
   - Open-source libraries (GitHub, PyPI, npm) — free, auditable, CI-safe
   - Government data portals (EIA, USGS, BLM, state OCCs) — authoritative, free
   - Industry standards bodies (Energistics/WITSML, OSDU, PPDM) — interoperability
   - Academic / consortium datasets (Volve, Kansas GS, USGS well logs) — real test data
   - Paid/commercial sources — document but do NOT implement (flag as user-supplied integration)

4. **Evaluate against ShaleYeah constraints** — For each finding, answer:
   - Can this run in CI without an API key? (If no: document how to mock it)
   - What TypeScript interface would wrap this data source?
   - Which server(s) consume it and how?
   - What data format does it produce (LAS, JSON, CSV, XML, DLIS)?
   - Is there an existing open-source parser/adapter (lasio, dlisio, PetroPy)?

5. **Structure the output** — Return findings as:

   ```
   ## Finding: <name>
   - **Source**: <URL>
   - **Format**: <LAS / JSON / CSV / XML / DLIS / WITSML>
   - **Servers affected**: <geowiz, curve-smith, ...>
   - **What it provides**: <one sentence>
   - **How to integrate**: <adapter interface sketch or library to use>
   - **CI-safe**: Yes / No (mock required)
   - **License**: <MIT / Apache / Public Domain / Commercial>
   ```

6. **Produce actionable outputs** — Every research run should end with one of:
   - A list of issues to create (use `/create-issue` for each)
   - An update to an existing research issue (use `gh issue edit`)
   - A recommendation decision (architecture choice, library selection, data source ranking)

---

## Research Quality Standards

- **Cite real URLs** — no invented sources. If uncertain, say so.
- **Prefer depth over breadth** — 3 well-understood integrations beat 10 shallow ones.
- **Name the real O&G tools** — Petrophysicists use `lasio` and `welly`. Drilling engineers
  use WITSML. Land teams use Quorum or P2 (paid). Economists use ARIES or PHDWin (paid).
  Researchers use EIA, Texas RRC, and state OCC portals. Name these even when we can't
  implement them — it shows the integration gap.
- **Flag paid/proprietary sources explicitly** — ARIES, Enverus/DrillingInfo, IHS Markit,
  PHDWin, Quorum Land are real-world tools. Document them under "User-supplied integrations"
  so operators can wire them in via the integration framework.
- **Don't hallucinate APIs** — If an API requires sign-up, a paid tier, or has been
  discontinued, say so. Real EIA base URL: `https://api.eia.gov/v2/`. Real lasio: PyPI.

---

## Common Research Patterns for This Project

### Integration research
Identify open-source libraries or free APIs for a specific server. Output: list of adapters
to build, typed interface sketch, license check.

### Data format research
Understand a new file format (DLIS, WITSML, ARIES XML) before building a parser adapter.
Output: format spec summary, existing parsers, edge cases to handle.

### Industry benchmark research
Find real-world benchmarks (Permian Basin decline curves, typical AFE costs, EIA price ranges)
to use as deterministic fallback values in `deriveDefault*()` functions. Output: real numbers
with citations to replace magic constants.

### Architecture research
Evaluate patterns (Karpathy loops, RAG, tool chaining) for applicability to specific ShaleYeah
servers. Output: feasibility assessment, which servers benefit most, implementation sketch.

### Market/regulatory research
Understand state-specific regulations, basin-specific market dynamics, or commodity market
structure for context in `legal`, `market`, or `decision` server prompts. Output: facts
and citations to embed in server prompts or documentation.

---

## O&G Professional Workflows by Role

Research must be grounded in how real professionals work. For each role below: understand their
daily sequence, their software stack, and what artifact they hand off — then ask whether
ShaleYeah makes that workflow faster, cheaper, or less error-prone.

---

### Geologist / Petrophysicist
**Servers: `geowiz`, `curve-smith`**

**What they own:** Formation evaluation, well log interpretation, net pay determination,
reservoir characterization. The geological model that everything else depends on.

**Daily workflow:**
1. Pull LAS/DLIS files from the company data store (often a shared drive, ARIES, or OSDU)
2. Load into Petrel, Kingdom, or open-source tools (lasio + Jupyter)
3. Run curve QC — check for bad hole, tool failures, depth shifts
4. Pick formation tops by correlating GR, resistivity, and density across offset wells
5. Calculate porosity (density, neutron, sonic), water saturation (Archie or Simandoux), net pay
6. Build a formation summary table (tops, thickness, average phi, Sw, net pay per zone)
7. Hand off: formation summary CSV or Petrel project to reservoir engineer and drilling engineer

**Key software:** Petrel (SLB), Kingdom (IHS), Techlog (SLB), OpenDTect (open source),
Geolog (Halliburton), Jupyter + lasio + welly + PetroPy (open source)

**Data inputs:** LAS/DLIS well logs, core analysis reports (porosity/perm plug data),
mud log lithology, seismic interpretation, offset well reports

**Outputs / handoffs:** Formation evaluation report (PDF), petrophysical parameter table (CSV),
net pay summary, Petrel/Kingdom project for reservoir team

**Where ShaleYeah fits:** `geowiz` automates the formation top picking and net pay calculation
from LAS input. `curve-smith` automates petrophysical curve processing (phi, Sw, net pay flags).
Augments a petrophysicist's QC step — doesn't replace Petrel but gets to a first-pass answer fast.

**Research questions:**
- What Archie parameters are typical for Wolfcamp/Permian vs. Eagle Ford vs. Bakken?
- How do petrophysicists handle bad-hole intervals (caliper washout) in net pay calculations?
- What are the standard cutoffs (GR, phi, Sw) for Permian Basin net pay determination?
- How is DLIS different from LAS and which fields use it most?

---

### Reservoir Engineer
**Servers: `econobot`, `curve-smith`, `development`**

**What they own:** Production forecasting, decline curve analysis, reserve estimation (1P/2P/3P),
EUR per well, and field development optimization. The number that drives the economics.

**Daily workflow:**
1. Pull historical production data from ARIES, Enverus, or state OCC portals (monthly volumes)
2. Run decline curve analysis (DCA) in ARIES, PHDWin, or Spotfire — fit Arps parameters (b, Di)
3. Build type curve from analog wells grouped by zone, lateral length, and completion design
4. Calculate EUR (estimated ultimate recovery) per well — the key input to econobot
5. Model development scenarios: spacing, stacking, cube development, inventory count
6. Run reserve booking (SEC PDP/PDNP/PUD classification) annually or pre-acquisition
7. Hand off: EUR assumptions and type curve to A&D analyst; reserve report to management

**Key software:** ARIES (Halliburton), PHDWin (TRC), Enverus/DrillingInfo, Spotfire, Excel,
IHS Harmony, decline-curve Python libraries (open source)

**Data inputs:** Monthly production volumes (oil, gas, water) by well from state OCC or ARIES,
completion parameters (lateral length, proppant, stages), petrophysical model from geologist

**Outputs / handoffs:** Type curve (Mboe/month vs. time), EUR estimate per well, reserve report,
development inventory count (number of economic drilling locations)

**Where ShaleYeah fits:** `econobot` runs the DCF model using EUR and commodity price inputs.
`curve-smith` builds the decline curve. `development` models inventory and development schedule.
The trio replicates what a reservoir engineer does across multiple tools in one pipeline.

**Research questions:**
- What are typical Permian Basin Wolfcamp Arps decline parameters (b factor, initial Di)?
- How does lateral length scaling affect EUR in the Midland vs. Delaware Basin?
- What is the standard SEC reserve booking methodology for unconventional wells?
- How do reservoir engineers handle parent-child well interference in spacing decisions?

---

### Drilling Engineer
**Servers: `drilling`, `infrastructure`**

**What they own:** Well design, AFE (Authorization for Expenditure) preparation, drilling program
execution, cost tracking, and post-well analysis. Owns the largest single line item in capex.

**Daily workflow:**
1. Design wellbore trajectory (KOP, build rate, landing zone) using offset well data
2. Select casing program, bit selection, drilling fluid system based on offset performance
3. Build AFE: estimate drilling days per section (surface, intermediate, lateral), rig rate,
   mud costs, directional costs, casing/cement costs, completion costs
4. Issue AFE for approval (usually VP or SVP sign-off above $5M)
5. Monitor real-time drilling via WITSML feed: ROP, WOB, torque, ECD, gas shows
6. Track actual vs. AFE daily — flag cost overruns immediately
7. Post-well: write drilling report, update offset well database for future AFE calibration

**Key software:** WITSML client (NOV WellData, Pason, TOTCO), Landmark COMPASS (wellbore design),
DrillPlan (SLB), Excel (AFE), company ERP for cost coding

**Data inputs:** Offset well reports (days/depth curves), mud logs (lithology, gas shows),
WITSML real-time stream during drilling, formation tops from geologist, rig day rates

**Outputs / handoffs:** AFE document (Excel/PDF), drilling program (Word), daily drilling report
(DDR), post-well cost summary vs. AFE

**Where ShaleYeah fits:** `drilling` automates AFE cost estimation from well parameters and
offset benchmarks. `infrastructure` models surface facility requirements once wells are drilled.
Helps a drilling engineer build a preliminary AFE faster before committing to a formal program.

**Research questions:**
- What are current Permian Basin rig day rates and total well costs per lateral foot (2024)?
- How do drilling engineers structure a days-vs-depth curve for AFE estimation?
- What WITSML channels are most commonly used for real-time drilling monitoring?
- How does directional drilling complexity (S-curve vs. straight lateral) affect AFE?

---

### Land Man (Land Professional)
**Servers: `title`, `legal`**

**What they own:** Mineral rights ownership, lease acquisition, title chain verification, royalty
obligation tracking, and acreage position management. The legal foundation for any drilling.

**Daily workflow:**
1. Pull county recorder records (deeds, assignments, probate) to build a chain of title —
   often done via courthouse visit or online portals (varies enormously by county/state)
2. Examine title for gaps, breaks, adverse claims, outstanding liens, or expired leases
3. Prepare title opinion (attorney-reviewed) or runsheet (paralegal-level) summarizing ownership
4. Negotiate lease terms with mineral owners (royalty rate, primary term, depth clause, PSA)
5. Track lease expirations, production-holding clauses, and continuous drilling obligations
6. Manage acreage in land management software (Quorum Land, P2, OGsys)
7. Hand off: title opinion to management and legal; lease data to royalty accounting

**Key software:** Quorum Land (industry standard), P2 Land, OGsys, county recorder web portals,
BLM LR2000 (federal leases), state land office portals (NM, WY, CO), Excel for runsheets

**Data inputs:** County deed records, BLM lease database, state land office data,
probate records, corporate assignment records, existing lease files

**Outputs / handoffs:** Title opinion (PDF), runsheet, lease abstract, acreage map (GIS),
net acres position summary for A&D or management

**Where ShaleYeah fits:** `title` automates preliminary title risk assessment — not a full title
opinion (that requires an attorney), but a fast flag of known encumbrances, ownership complexity,
and exam period requirements. `legal` handles the regulatory compliance layer (permits, spacing).

**Research questions:**
- What are the standard clauses land men look for in an oil and gas lease (depth, Pugh, pooling)?
- How does federal (BLM) title examination differ from state or fee title examination?
- What makes a "broken" chain of title and how is it cured (quiet title, affidavit of heirship)?
- Which states have online county recorder portals vs. requiring courthouse visits?

---

### Regulatory / Compliance Analyst
**Servers: `legal`, `drilling`**

**What they own:** Permit applications, regulatory filings, environmental compliance, spill
reporting, and ensuring the company is in good standing with state and federal regulators.

**Daily workflow:**
1. File drilling permit applications with state OCC (TX RRC, NM OCD, WY WOGCC, OK OCC)
   — submit well plat, casing design, surface use agreement, and fees
2. Track permit approval timelines — state review averages 2–8 weeks depending on state
3. File completion reports after drilling: perforations, cement tops, casing test results
4. Submit production reports monthly to state OCC (W-10 in Texas, Form C-115 in NM)
5. Manage FracFocus chemical disclosure filings within 60 days of completion
6. Respond to regulatory violations or show-cause orders
7. Track BLM APD (Application to Permit to Drill) for federal acreage — longer lead time (90+ days)

**Key software:** State OCC online portals (RRC Online, OCD Online, WOGCC Online),
BLM ePlanning / NEPA Online, FracFocus, company ERP for compliance tracking, Excel

**Data inputs:** Well permit applications from drilling engineer, completion reports from field,
monthly production data from operations, chemical disclosure data from completion crew

**Outputs / handoffs:** Filed permits (PDF), compliance status dashboard, violation response letters,
monthly/annual regulatory reports

**Where ShaleYeah fits:** `legal` tracks regulatory requirements by state and project type,
flags compliance risks, and identifies permit lead times that affect development schedules.
`drilling` AFE costs should include permit fees and regulatory compliance costs.

**Research questions:**
- What are the permit application requirements and timelines for TX, NM, WY, OK, ND, CO?
- How does BLM NEPA review differ from state-level permitting, and what triggers full EIS?
- What are the common compliance violations in Permian Basin operations and their penalties?
- How is FracFocus chemical disclosure structured and what are the deadline requirements?

---

### A&D Analyst (Acquisitions & Divestitures)
**Servers: `decision`, `risk-analysis`, `econobot`**

**What they own:** Deal screening, valuation modeling, bid recommendation, and transaction
execution for buying or selling oil and gas assets. The highest-stakes analytical role.

**Daily workflow:**
1. Receive a data room package from a seller: production history, reserve report, land files,
   geological interpretation, well logs, environmental assessments
2. Load production data into ARIES or PHDWin — run their own independent decline curve analysis
3. Build a DCF model in Excel: type curve × well count × price deck × royalty/tax burden
4. Run sensitivity analysis: price, EUR, capex, and timing scenarios
5. Build risk matrix: geological risk, regulatory risk, infrastructure risk, market risk
6. Prepare bid recommendation memo for investment committee: INVEST/PASS/CONDITIONAL with price range
7. If bid wins: lead due diligence, manage third-party title and environmental consultants
8. Hand off: executed PSA to land and legal; asset data to operations team

**Key software:** ARIES (economics), Excel (DCF models), Enverus/DrillingInfo (production data),
IHS Markit (production and well data), Petrel (geological review), PowerPoint (IC memo)

**Data inputs:** Seller data room (PDFs, LAS files, production CSVs, reserve report),
EIA commodity price decks, company-approved pricing assumptions, offset well database

**Outputs / handoffs:** Bid recommendation memo (PDF), DCF model (Excel), risk matrix (Excel),
IC presentation (PowerPoint), signed PSA (legal)

**Where ShaleYeah fits:** `decision` is the core A&D tool — synthesizes upstream geological,
economic, engineering, and risk inputs into a structured INVEST/PASS/CONDITIONAL verdict.
`risk-analysis` quantifies the risk matrix. `econobot` runs the DCF. Together they replicate
the analyst's 2–3 week deal screen in minutes.

**Research questions:**
- What are the standard price deck assumptions used in Permian Basin A&D (strip vs. flat deck)?
- How do A&D analysts handle PUD (proved undeveloped) locations in a DCF — what risking factors?
- What is a typical bid-to-ask spread in current Permian Basin deals?
- How do sellers structure a data room and what are the most common data quality issues?

---

### Market / Commodity Analyst
**Servers: `market`, `research`**

**What they own:** Commodity price forecasting, supply/demand analysis, basis differentials,
hedging strategy input, and market intelligence reporting. Informs every economic assumption.

**Daily workflow:**
1. Pull EIA Weekly Petroleum Status Report (Wednesday AM) — crude inventories, refinery runs,
   imports/exports, production
2. Check NYMEX crude (CL) and natural gas (NG) futures curves — note contango/backwardation
3. Track Midland-Cushing and Waha basis differentials (critical for Permian economics)
4. Monitor rig count (Baker Hughes weekly, Thursday AM) — leading indicator for supply growth
5. Review sell-side price decks (Goldman, Morgan Stanley) and EIA Short-Term Energy Outlook
6. Write weekly market update for internal distribution
7. Advise hedging desk on price exposure and recommend collar/swap structures

**Key software:** Bloomberg Terminal (industry standard, expensive), Refinitiv Eikon,
EIA web portal (free), CME Group data, Baker Hughes rig count portal (free), Excel

**Data inputs:** EIA weekly reports, NYMEX futures prices, Baker Hughes rig count,
pipeline capacity and flow data (FERC), state production data (monthly lag)

**Outputs / handoffs:** Weekly market update (PDF/email), price deck for economic models (Excel),
hedging recommendation memo, quarterly market outlook presentation

**Where ShaleYeah fits:** `market` automates the weekly data pull and summarization — EIA data,
commodity prices, rig count context. `research` synthesizes web-sourced market intelligence.
Replaces the manual aggregation step; analyst focuses on interpretation and hedging strategy.

**Research questions:**
- What are the current Midland-Cushing and Waha basis differentials and what drives them?
- How does the EIA Short-Term Energy Outlook model US production growth?
- What are the free alternatives to Bloomberg for commodity price data in CI?
- How do market analysts build a multi-scenario price deck (base/bull/bear)?

---

### Field Development Planner
**Servers: `development`, `infrastructure`, `drilling`**

**What they own:** Multi-year drilling schedule, pad design, infrastructure buildout sequence,
and capital allocation across a field. Connects geology to execution.

**Daily workflow:**
1. Take petrophysical model (net pay maps) and reservoir simulation output as inputs
2. Design well spacing and stacking (which zones, how many wells per DSU, vertical vs. lateral)
3. Build multi-year drilling schedule: pad sequence, rig utilization, first production timing
4. Design gathering infrastructure: flowlines, compressors, gas lift, water disposal
5. Model infrastructure capital requirements and phasing against production ramp
6. Optimize drilling order for infrastructure efficiency (minimize flowline length)
7. Hand off: development plan to drilling engineer (well designs), to finance (capex schedule),
   to operations (infrastructure build requirements)

**Key software:** Petrel (well placement), Aucerna/Quorum (schedule optimization),
Excel (capital schedule), OPM Flow (reservoir simulation, open source), GIS tools (ArcGIS, QGIS)

**Data inputs:** Net pay maps from geologist, EUR per zone from reservoir engineer,
rig availability and day rates from drilling, infrastructure costs from construction team

**Outputs / handoffs:** Development plan (PDF), drilling schedule (Excel/Gantt), capital budget
by year (Excel), infrastructure design drawings (AutoCAD), DSU plat maps (GIS)

**Where ShaleYeah fits:** `development` models the multi-well program parameters, well count,
and capital requirements. `infrastructure` assesses takeaway capacity and facility costs.
`drilling` provides cost and time estimates per well. Together they automate the initial
development plan framing that takes a planner days in Petrel and Excel.

**Research questions:**
- What is the standard DSU (drilling spacing unit) size in the Permian Basin by zone?
- How do operators decide between cube development (all zones at once) vs. sequential?
- What are typical gathering infrastructure costs per well in the Permian Basin ($/Boe)?
- How does parent-child well interference affect development plan spacing decisions?

---

### QA / Data Engineer
**Servers: `test`, all servers**

**What they own:** Data pipeline integrity, model validation, test coverage, and ensuring all
server outputs are internally consistent, reproducible, and match real-world ranges.

**Daily workflow:**
1. Monitor CI pipeline — ensure all 14 servers pass build, type-check, lint, test, and demo
2. Validate new server outputs against known benchmarks (Volve dataset, EIA production data)
3. Write anti-stub tests when a new `callLLM` integration lands — confirm LLM is actually called
4. Run regression tests when LAS parsing or petrophysical logic changes
5. Audit `deriveDefault*()` fallback values against published industry data — replace magic numbers
6. Validate integration adapters: confirm EIA API responses parse correctly, LAS edge cases handled
7. Document data quality issues: null values in LAS, bad-hole intervals, missing economic inputs

**Key software:** TypeScript + Node.js test runner (npx tsx), CI/CD (GitHub Actions),
Volve dataset (5TB reference), USGS public well logs, EIA API (for regression fixtures)

**Data inputs:** All 14 server outputs, LAS/DLIS files (various quality levels), EIA API
responses, state OCC production data, integration adapter responses

**Outputs / handoffs:** Test reports, CI status, data quality flags, regression baseline updates,
integration validation reports

**Where ShaleYeah fits:** `test` is the QA server itself — it validates analysis quality and
flags inconsistencies across the pipeline. The QA engineer's job is to make sure `test` actually
catches real problems, not just confirms inputs.

**Research questions:**
- What are the most common LAS file quality issues in real-world datasets (bad hole, depth errors)?
- What published production decline benchmarks exist for Permian Basin analog validation?
- How do O&G data engineers handle unit normalization (ft vs. m, bbl vs. m³) in pipelines?
- What is the Volve dataset's known production profile and how can it serve as a regression baseline?
