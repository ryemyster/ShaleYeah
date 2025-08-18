SHALE YEAH – Agent Orchestration Spec

🧠 Purpose

This spec defines how SHALE YEAH agents coordinate to evaluate tracts, make investment decisions, and trigger downstream actions. It outlines decision flow logic, execution order, conditional triggers, and output expectations.

⸻

⚙️ Orchestration Modes

tract_eval

Evaluate a single tract and decide whether to send an LOI.

workflow_id: tract_eval
input: tract.shp
run_id: auto
steps:
  - agent: geowiz
    input: tract.shp
    output: zones.geojson

  - agent: drillcast
    input: zones.geojson
    output: drill_forecast.json

  - agent: titletracker
    input: mor.pdf
    output: ownership.json

  - agent: econobot
    input:
      zones: zones.geojson
      ownership: ownership.json
    output: valuation.json

  - agent: riskranger
    input:
      geo: zones.geojson
      econ: valuation.json
    output: risk_score.json

  - agent: the-core
    decision:
      if: risk_score.json.risk_pct < 35 and valuation.json.ppa > 5500
      then: notarybot
      else: halt

  - agent: notarybot
    input: valuation.json, ownership.json
    output: loi.pdf


⸻

investment_batch

Rank multiple tracts and select top candidates for LOI.

workflow_id: investment_batch
input_dir: ./tracts_pending/
run_id: batch_$(date)
steps:
  - foreach: ./tracts_pending/*.shp
    do:
      include: tract_eval
      save_outputs: true

  - agent: the-core
    task: rank_tracts_by(roi, payout_time)
    filter: top 3
    output: shortlist.csv


⸻

research_and_expand

Run research and stub a new agent.

workflow_id: research_and_expand
input: target_product_name
steps:
  - agent: research-hub
    input: "Leapfrog Geo"
    output: rfcs/leapfrog.md

  - agent: agent-forge
    input: rfcs/leapfrog.md
    output: agents/leapfrog.yaml


⸻

✅ Orchestration Conventions
	•	Use run_id to isolate outputs
	•	Pass inputs by file reference or known agent output
	•	Trigger conditional logic in the-core
	•	All outputs written under OUT_DIR/${run_id}/

⸻

🔒 Safety and Guardrails
	•	Validate required inputs before agent start
	•	Stop workflow if any step throws exit 1
	•	Always emit a summary.json with:
	•	status: success/fail
	•	steps_run
	•	outputs and their file paths

⸻

📤 Reporting Agents

reporter

Always runs at the end of a workflow to generate a human-readable report.

- agent: reporter
  input:
    - zones.geojson
    - valuation.json
    - risk_score.json
    - loi.pdf (if available)
  output: SHALE_YEAH_REPORT.md

investor-notifier

Generates and optionally sends summary memos for batch evaluations.

- agent: investor-notifier
  input: shortlist.csv
  output: investor_memo.pdf
  method:
    - Format top tract summary
    - Include key charts and scores
    - Attach LOIs if present

🧠 Future Additions
	•	parallel: true support for curve fitting agents
	•	Slack/email notification hooks on complete/fail
	•	Cost/time estimation per step
	•	Configurable thresholds per user or team profile

⸻

SHALE YEAH orchestration keeps agents autonomous, decisions clear, and workflows auditable.