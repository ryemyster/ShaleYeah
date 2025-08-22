# SHALE YEAH — CLAUDE Execution Spec (Project System File)

> This file tells Claude how to run the project end to end. It defines goals, constraints, run modes, agent roles, tool usage, and success checks. Keep this in `.claude-flow/CLAUDE.md`.

## Mission

Build and run a working multi agent project for oil and gas data. Prove that a small team can ship fast. Produce clean outputs that engineers can use the same day.

## Goals

* Ingest legacy data (LAS logs and Access DBs)
* Generate fitted curves with basic QC
* Write a single engineer friendly report
* Provide hooks for GIS and mineral tools
* Provide SIEM and SOAR hooks for ops visibility
* Auto expand the repo with a research agent and a forge agent

## Non goals

* No heavy vendor SDKs in the default path
* No giant models or data files in repo
* No secret material in code or outputs

## License and credit

* License: Apache 2.0. Respect LICENSE and NOTICE
* Footer for all human facing outputs: `Generated with SHALE YEAH 2025 Ryan McDonald / Ascendvent LLC - Apache-2.0`

## Run modes

* **Demo**: smoke test with sample LAS and Access
* **Batch**: run on a folder and produce a report per run id
* **Research**: scan a target product, create an RFC, then generate a new agent stub

Select mode via environment or pipeline vars.

## Environment

* `RUN_ID` required for all runs
* `OUT_DIR=./data/outputs/${RUN_ID}`
* Optional tokens read from env only: `SPLUNK_HEC_TOKEN`, `SENTINEL_BEARER`, `ELASTIC_API_KEY`, `CORTEX_API_KEY`

## File IO rules

* Write all artifacts under `OUT_DIR`
* Use open formats: CSV, GeoJSON, OMF, LAS
* Always declare units for depth, time, SRID
* Never invent curves. If missing, say so and propose imputations

## Safety and security

* No secrets in YAML or code. Only env
* Keep logs concise. Redact tokens. Do not write Access PII if present
* CI must pass CodeQL, Gitleaks, signed release, SLSA provenance

## Quality gates

* `geowiz`: zones.geojson must declare depth units
* `curve-smith`: qc\_report.md must include per curve RMSE and NRMSE
* `reporter`: include data provenance with file paths and counts
* `research-hub`: include two or more URLs and a PoC plan
* `agent-forge`: generated agent YAML must parse and include outputs

## Agents

### geowiz (analyst)

**Inputs**: `data/samples/**/*.*` or user folder
**Outputs**: `${OUT_DIR}/geology_summary.md`, `${OUT_DIR}/zones.geojson`
**Method**:

1. Read LAS with `las-parse.ts` or `lasio` if available
2. Summarize formations and data gaps. Keep it short and tabular
3. Create zones.geojson with depth intervals. Include `depth_unit`

### curve-smith (compute)

**Inputs**: LAS files, `${OUT_DIR}/zones.geojson`
**Outputs**: `${OUT_DIR}/curves/*.csv`, `${OUT_DIR}/qc_report.md`
**Method**:

1. For each interval in zones, fit simple baseline curves with `curve-fit.ts`
2. Compute RMSE and NRMSE with `curve-qc.py`
3. Write per curve CSVs and a tight QC table

### reporter (writer)

**Inputs**: all prior outputs
**Output**: `${OUT_DIR}/SHALE_YEAH_REPORT.md`
**Method**:

* Executive summary
* Data provenance with counts and file list
* Curves table: name, rows, RMSE, NRMSE, file path
* Next steps
* Footer credit line

### research-hub (analyst)

**Input**: a product or standard name
**Output**: `${OUT_DIR}/research/rfcs/<slug>.md`
**Method**:

* Fetch vendor docs and neutral sources with `web-fetch.ts`
* Extract API or format, auth model, minimal request, rate limits, license notes
* Add a mini PoC plan. Include two or more URLs

### agent-forge (builder)

**Inputs**: RFCs from research hub
**Outputs**: `.claude-flow/agents/generated/<name>.yaml` or `integrations/*` stubs
**Method**:

* Convert one RFC into a working agent YAML or small tool file
* Reference our IO rules and footer policy

## Tools and commands

* `access-ingest.ts <db.mdb|db.accdb>` → write CSV per table under `${OUT_DIR}/access`
* `las-parse.ts <file.las>` → print light JSON metadata
* `curve-fit.ts input.csv target=GR order=2 > out.csv` → append `<target>_fit`
* `curve-qc.py input.las CURVE=GR` → print JSON with RMSE and NRMSE
* `web-fetch.ts <url>` → JSON with cleaned text for research

## Integrations

Keep default path simple. Expose hooks behind env checks.

* **SIEM**: Splunk HEC, Sentinel Logs Ingestion, QRadar LEEF, Elastic Bulk, Cortex incident POST
* **GIS**: ArcGIS REST, QGIS headless, MapInfo via GDAL, GeoMedia WFS, Global Mapper script
* **Mining**: OMF read or write first. Stubs for Leapfrog, Surpac, Vulcan, Datamine, Micromine

## Pipelines

### `pipelines/shale.yaml`

Stages:

1. geowiz
2. run `access-ingest.ts` on `./data/samples/demo.accdb`
3. run `curve-qc.py` on `./data/samples/demo.las` `CURVE=GR`
4. curve-smith
5. reporter
   Artifacts saved to `${OUT_DIR}`

## Execution checklist

1. `npm i` then `npm run init`
2. `export RUN_ID=$(date +%Y%m%d-%H%M%S)`
3. `npm run start` in one shell
4. In another shell run the pipeline with `npx claude-flow@alpha run pipelines/shale.yaml --vars RUN_ID=$RUN_ID`
5. Confirm `${OUT_DIR}/SHALE_YEAH_REPORT.md` exists and has the footer
6. Run `bash scripts/verify-branding.sh` to enforce credit and NOTICE

## Failure handling

* If a tool fails, write a short error note to `${OUT_DIR}/errors.log`
* If a gate fails, stop the stage and emit a human readable reason
* Never delete inputs. Keep partial outputs with a clear header

## Style

* Short sentences
* No em dashes and no Oxford comma
* Use tables for stats and lists

## Examples to follow

* Geology summary: 1 page with a table of formations, a bullet list of gaps
* QC report: one table with curve, rows, rmse, nrmse
* Research RFC: title, two or more links, auth notes, curl or python PoC

## Done criteria

* Demo pipeline finishes with a report and per curve CSVs
* QC report lists RMSE and NRMSE per curve
* Research hub yields at least one RFC with two URLs
* Agent forge emits a valid agent YAML
* CI green on CodeQL and Gitleaks

## Closing note

Ship small. Prove value fast. Expand with research and forge. Keep credit and safety on by default.
