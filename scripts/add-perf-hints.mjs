/**
 * One-shot script: add complexity + estimatedLatencyMs to every tool
 * in all 14 agent manifest arrays.
 *
 * Run: node scripts/add-perf-hints.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const FAST = { complexity: "fast", estimatedLatencyMs: { p50: 200, p95: 800 } };
const MODERATE = { complexity: "moderate", estimatedLatencyMs: { p50: 2000, p95: 8000 } };
const SLOW = { complexity: "slow", estimatedLatencyMs: { p50: 8000, p95: 30000 } };

// Full classification for every tool across all 14 agents.
const TOOL_CLASS = new Map([
	// geologist (9 tools)
	["geologist.analyze_formation", MODERATE],
	["geologist.process_gis", MODERATE],
	["geologist.process_well_logs", MODERATE],
	["geologist.assess_quality", FAST],
	["geologist.process_access_database", MODERATE],
	["geologist.process_document", MODERATE],
	["geologist.process_seismic_data", SLOW], // timeoutMs: 120 000
	["geologist.process_aries_database", MODERATE],
	["geologist.save_finding", FAST],

	// development-planner (3 tools)
	["development-planner.create_development_plan", MODERATE],
	["development-planner.estimate_project_timeline", MODERATE],
	["development-planner.monitor_development_progress", FAST],

	// drilling-engineer (3 tools)
	["drilling-engineer.design_drilling_program", MODERATE],
	["drilling-engineer.estimate_well_costs", MODERATE],
	["drilling-engineer.assess_drilling_risks", FAST],

	// economist (3 tools)
	["economist.analyze_economics", MODERATE],
	["economist.calculate_dcf", MODERATE],
	["economist.sensitivity_analysis", MODERATE],

	// infrastructure-planner (4 tools)
	["infrastructure-planner.plan_pipeline", MODERATE],
	["infrastructure-planner.size_facilities", MODERATE],
	["infrastructure-planner.estimate_costs", MODERATE],
	["infrastructure-planner.assess_compliance", FAST],

	// investment-chair (3 tools)
	["investment-chair.make_investment_decision", MODERATE],
	["investment-chair.calculate_bid_strategy", MODERATE],
	["investment-chair.analyze_portfolio_fit", FAST],

	// legal-analyst (3 tools)
	["legal-analyst.analyze_legal_framework", MODERATE],
	["legal-analyst.review_contract", MODERATE],
	["legal-analyst.assess_compliance", FAST],

	// market-analyst (2 tools)
	["market-analyst.analyze_market_conditions", MODERATE],
	["market-analyst.competitive_analysis", MODERATE],

	// quality-assurance (2 tools)
	["quality-assurance.run_quality_tests", FAST],
	["quality-assurance.generate_quality_report", FAST],

	// reporter-agent (3 tools)
	["reporter-agent.generate_investment_decision", MODERATE],
	["reporter-agent.create_executive_report", MODERATE],
	["reporter-agent.synthesize_analysis", MODERATE],

	// research-analyst (2 tools)
	["research-analyst.conduct_market_research", MODERATE],
	["research-analyst.analyze_competition", MODERATE],

	// reservoir-engineer (4 tools)
	["reservoir-engineer.analyze_decline_curve", MODERATE],
	["reservoir-engineer.generate_type_curve", MODERATE],
	["reservoir-engineer.calculate_eur", MODERATE],
	["reservoir-engineer.assess_curve_quality", FAST],

	// risk-analyst (2 tools)
	["risk-analyst.assess_investment_risk", MODERATE],
	["risk-analyst.monte_carlo_simulation", SLOW], // 10 000+ Monte Carlo iterations

	// title-analyst (4 tools)
	["title-analyst.examine_ownership", MODERATE],
	["title-analyst.analyze_lease", MODERATE],
	["title-analyst.check_burdens", FAST],
	["title-analyst.trace_chain_of_title", MODERATE],
]);

const AGENTS_DIR = resolve(process.cwd(), "agents");

/**
 * Insert complexity + estimatedLatencyMs into a single tool object block.
 * Strategy: find the name line, then find the closing `\t\t},` for that object,
 * and splice the two fields in before the closing brace.
 */
function addPerfHintsToFile(filePath) {
	const original = readFileSync(filePath, "utf8");
	const lines = original.split("\n");
	let modified = false;

	// Find every tool name line and insert after the tool object closes.
	for (let i = 0; i < lines.length; i++) {
		const nameLine = lines[i];
		// Match lines like: `			name: "geologist.analyze_formation",`
		const nameMatch = nameLine.match(/^\t{2,3}name:\s+"([^"]+)"/);
		if (!nameMatch) continue;

		const toolName = nameMatch[1];
		const cls = TOOL_CLASS.get(toolName);
		if (!cls) continue;

		// Determine indent level from the name line (2 or 3 tabs → object depth 1 or 2).
		const indentMatch = nameLine.match(/^(\t+)/);
		const innerIndent = indentMatch ? indentMatch[1] : "\t\t\t";
		const outerIndent = innerIndent.slice(0, -1); // one tab less

		// Skip if already has complexity (idempotent).
		// Look ahead up to 40 lines for the closing brace.
		let closeIdx = -1;
		for (let j = i + 1; j < Math.min(i + 60, lines.length); j++) {
			// Check for already-added fields — skip if already present.
			if (lines[j].includes("complexity:") || lines[j].includes("estimatedLatencyMs:")) {
				closeIdx = -2; // sentinel: already patched
				break;
			}
			// The closing line of the tool object: outerIndent + `},`
			if (lines[j] === `${outerIndent}},` || lines[j] === `${outerIndent}}`) {
				closeIdx = j;
				break;
			}
		}

		if (closeIdx < 0) continue; // already patched or not found

		// Build the two field lines.
		const complexityLine = `${innerIndent}complexity: "${cls.complexity}",`;
		const latencyLine = `${innerIndent}estimatedLatencyMs: { p50: ${cls.estimatedLatencyMs.p50}, p95: ${cls.estimatedLatencyMs.p95} },`;

		// Insert before the closing brace.
		lines.splice(closeIdx, 0, latencyLine, complexityLine);
		modified = true;

		// Advance past inserted lines so we don't re-process them.
		i = closeIdx + 2;
	}

	if (modified) {
		writeFileSync(filePath, lines.join("\n"), "utf8");
		return true;
	}
	return false;
}

// Process all 14 agents.
import { readdirSync, existsSync } from "node:fs";
const agentDirs = readdirSync(AGENTS_DIR);
let totalModified = 0;

for (const dir of agentDirs) {
	const agentFile = resolve(AGENTS_DIR, dir, "src", "agent", "index.ts");
	if (!existsSync(agentFile)) continue;

	const changed = addPerfHintsToFile(agentFile);
	if (changed) {
		console.log(`✅ ${dir}`);
		totalModified++;
	} else {
		console.log(`⏭  ${dir} (no changes)`);
	}
}

console.log(`\nDone — modified ${totalModified} agents.`);
