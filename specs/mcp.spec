SHALE YEAH – Multi-Agent Control Plane (MCP) Spec

🎯 Purpose

Enable smart, dynamic coordination between agents in SHALE YEAH. The MCP governs which agents to run, in what order, with what data, and when to stop or escalate.

This replaces rigid workflows with runtime decision logic, allowing agents to swarm, fail gracefully, and propose next actions based on outcomes.

⸻

🧠 Core Functions

1. Agent Routing
	•	Dynamically determine which agents to run next based on:
	•	Output presence or structure
	•	Thresholds (e.g. risk %, valuation)
	•	Agent success/failure status

2. State Memory
	•	Track:
	•	RUN_ID
	•	Files produced per agent
	•	Agent exit codes / status
	•	Output metadata (e.g. NPV, risk score)

3. Goal-Based Execution
	•	Define goal=LOI, goal=report_only, goal=rank_batch
	•	MCP builds agent execution plan to match goal

4. Observability Hooks
	•	Log each agent’s:
	•	Inputs used
	•	Runtime and memory
	•	Output file(s)
	•	Pass/fail status

⸻

⚙️ Agent Registry

agents:
  geowiz:
    description: Geologic parser + scorer
    inputs: [shapefile, region]
    outputs: [zones.geojson, geology_summary.md]
    next_if_success: drillcast

  drillcast:
    inputs: [zones.geojson]
    outputs: [drill_forecast.json]
    next_if_success: titletracker

  titletracker:
    inputs: [mor.pdf]
    outputs: [ownership.json]
    next_if_success: econobot

  econobot:
    inputs: [zones.geojson, ownership.json]
    outputs: [valuation.json]
    next_if: riskranger

  riskranger:
    inputs: [valuation.json]
    outputs: [risk_score.json]
    next_if: the-core

  the-core:
    logic:
      if risk < 35 and ppa > 5000: notarybot
      else: halt

  notarybot:
    inputs: [valuation.json, ownership.json]
    outputs: [loi.pdf]

  reporter:
    always_run: true
    inputs: all
    outputs: [SHALE_YEAH_REPORT.md]


⸻

🛠 Architecture

Component	Role
mcp.yaml	Agent registry + rules
mcp.py	Execution controller script
state.json	Track outputs + metadata
goal_runner.py	Entry point: --goal tract_eval


⸻

🧪 Sample Invocation

python goal_runner.py --goal tract_eval --run_id test123 --shapefile mytract.shp --region Permian

Output:
	•	LOI (if qualified)
	•	SHALE_YEAH_REPORT.md
	•	state.json with all metadata

⸻

🔐 Fail-Safe Rules
	•	Agent fails → MCP skips or reorders if fallback defined
	•	Max runtime per agent
	•	Safe log of all exceptions

⸻

🌍 Why This Matters

You don’t just run pipelines — you run decisions.
This lets SHALE YEAH behave like a thinking team, not a static script.

MCP = the boss. Agents = the crew.