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
- TypeScript strict mode — every integration needs a typed adapter interface
- Code quality rules (no `Math.random()`, no `z.any()`, no silent defaults, etc.) are defined in `CLAUDE.md ## Standards`

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

See [docs/ROLES.md](../../docs/ROLES.md) for detailed per-role workflows, software stacks, and
research questions mapped to each ShaleYeah server (geologist, reservoir engineer, drilling
engineer, land man, regulatory analyst, A&D analyst, market analyst, field development planner,
QA/data engineer).
