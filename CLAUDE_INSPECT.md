You are a seasoned AI agent project planner and architect.

## 1. Project Purpose & Vision
Define a new agent-based toolset named **SHALE YEAH** meant for the oil & gas sector. Its goals are:
- Automate well-log analysis.
- Enable geological data ingestion (LAS, Access databases).
- Support integrations with enterprise GIS systems, mineral modeling tools, and operational security platforms (SIEM/SOAR).
- Offer a research-driven agent system to help iterate and expand functionality.

## 2. Why It’s Important
Explain why SHALE YEAH is needed in the industry:
- O&G teams deal with fragmented data formats and outdated processes.
- Modern workflows demand automation, auditability, and openness.
- Open-sourcing it fosters community contributions and enables innovation.

## 3. How It Works — Architecture
Outline the system design:
- Modular agent framework using Claude agents configured via `.claude-flow`.
- Core agents:
  - `geowiz` for geology summaries.
  - `curve-smith` for curve fitting and QC.
  - `reporter` for executive reports.
  - `research-hub` to gather integration specs.
  - `agent-forge` to materialize those specs.
- Tools for data and format handling:
  - `.claude-flow/tools`: LAS parsing, Access ingest, curve QC, web fetching.
  - `integrations/`: Connectors for SIEM (Splunk, Sentinel, etc.), GIS (ArcGIS, QGIS, MapInfo…), mineral modeling (OMF, Datamine, Leapfrog).
- A `pipelines/shale.yaml` orchestrating stages.
- Strong OSS guardrails:
  - Apache-2.0 licensing, credit footer, citation files.
  - CI workflow with CodeQL, Gitleaks, SLSA, and supply-chain integrity.

## 4. Outputs
Specify what contributors and users should get:
- A fully scaffolded GitHub repo with the above structure.
- Instructions to run demos (`demo.sh`) and add new agents via specs.
- CI checks that ensure crediting, security, and license compliance.
- Example datasets (LAS, Access) and sample outputs (GeoJSON, report).

## 5. Success Criteria
Define signals of success:
- Repo scaffolds correctly and runs end-to-end demo workflow.
- Agents produce output files with credit footer.
- CI pipeline triggers scans, detects violations, signs releases.
- Research-hub produces correctly formatted RFCs; agent-forge creates new agent stubs.
- Core integration tools (LAS, Access ingest, GIS connectors) are testable in CI.

---

This project prompt gives Claude a clear purpose, context, methodology, and output expectations. Let me know if you'd like to refine or add any details!

All set. I put the full repo skeleton in one canvas, and the guardrails CLAUDE.md in its own canvas.
	•	Repo: “SHALE YEAH — Repo Skeleton (OSS)”
	•	Guardrails: “CLAUDE.md — SHALE YEAH Guardrails”

If you want, I can push these to a GitHub repo next.

Sources I used for the integrations and licensing
	•	Apache License 2.0 text, overview.  ￼
	•	CITATION.cff docs and guidance.  ￼ ￼ ￼
	•	Splunk HTTP Event Collector.  ￼ ￼
	•	Azure Logs Ingestion API and DCRs.  ￼
	•	IBM QRadar LEEF format.  ￼
	•	Elasticsearch Bulk API.  ￼
	•	Cortex XSOAR API references.  ￼ ￼
	•	QGIS headless processing.  ￼
	•	GDAL MapInfo TAB driver.
	•	OGC Web Feature Service.
	•	Global Mapper scripting reference.
	•	Open Mining Format, libraries.
	•	lasio and LAS background.

SHALE YEAH — Global Agent Guardrails

OSS and credit
	•	License: Apache-2.0. Respect LICENSE and NOTICE.
	•	Always append this footer on human facing outputs:
“Generated with SHALE YEAH (c) Ryan McDonald / Ascendvent LLC - Apache-2.0”

IO rules
	•	Write artifacts to ./data/outputs/${RUN_ID}
	•	Chunk large files and avoid memory blowups
	•	Prefer open formats: GeoJSON, CSV, OMF, LAS
	•	Declare units for depth, time, SRID when writing data

Truthfulness and sources
	•	Prefer vendor docs and neutral standards
	•	Include two or more URLs in research outputs
	•	Do not invent curves; if missing, state it and propose imputations

Security
	•	Never commit secrets. Use env vars and CI secret store
	•	Respect CI checks: CodeQL, Gitleaks, signed releases, SLSA provenance
	•	Strip PII where not required; redact secrets from logs

Style
	•	Keep outputs short with tables where possible
	•	No em dashes and no Oxford comma in user facing prose
	•	Use clear headings; avoid fluff

GIS integrations
	•	ArcGIS: REST Feature Services for query and edit
	•	QGIS: use qgis_process for headless processing or PyQGIS
	•	MapInfo: read and write via GDAL/OGR drivers (TAB, MIF/MID)
	•	GeoMedia: prefer OGC WFS or OGC API Features endpoints
	•	Global Mapper: batch with .gms scripts or the Python SDK

Mining and resource modeling
	•	Prefer OMF for interchange
	•	Leapfrog import and export OMF
	•	Vulcan SDK supports Python workflows; export to OMF where possible
	•	Surpac and Datamine: build neutral conversions and hand off via OMF
	•	Micromine: use OMF and common mesh formats

Agents
	•	research-hub: produce RFCs with at least two sources and a PoC plan
	•	agent-forge: materialize RFCs into agents or small tool stubs under integrations/

Quality gates
	•	Geowiz: no zones.geojson without declared depth units
	•	Curve-smith: qc_report.md must include per curve RMSE and NRMSE
	•	Reporter: include data provenance and links to artifacts

Human in the loop
	•	When uncertain, ask for a small sample and show a preview diff
	•	Log assumptions in each output file header