/**
 * ADK eval harness tests for issue #596's retrospective audit of #580/#587/#589.
 *
 * These tests keep the package-local eval harness present in CI without requiring
 * live model credentials or an active Geowiz MCP server.
 */

import assert from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
	try {
		await fn();
		console.log(`  ✅ ${name}`);
		passed++;
	} catch (err) {
		console.error(`  ❌ ${name}`);
		console.error(err);
		failed++;
	}
}

const packageRoot = process.cwd();

console.log("🧪 Starting Geologist ADK eval harness tests (#596)\n");

await test("ADK eval dataset contains control, edge, and boundary cases", () => {
	const datasetPath = path.join(packageRoot, "tests", "eval", "datasets", "geologist-adk-reference.json");
	assert.ok(existsSync(datasetPath), "geologist ADK eval dataset should exist");

	const dataset = JSON.parse(readFileSync(datasetPath, "utf8")) as {
		eval_cases: Array<{ eval_case_id: string; reference?: { case_type?: string } }>;
	};
	const caseTypes = new Set(dataset.eval_cases.map((testCase) => testCase.reference?.case_type));
	const caseIds = new Set(dataset.eval_cases.map((testCase) => testCase.eval_case_id));

	assert.ok(caseTypes.has("control"), "dataset should include a control case");
	assert.ok(caseTypes.has("edge"), "dataset should include an edge case");
	assert.ok(caseTypes.has("capability_boundary"), "dataset should include a capability-boundary case");
	assert.ok(caseIds.has("control_assess_las_quality"));
	assert.ok(caseIds.has("edge_sparse_history_missing_context"));
	assert.ok(caseIds.has("boundary_save_without_approval"));
});

await test("ADK eval config separates deterministic checks from LLM judge", () => {
	const configPath = path.join(packageRoot, "tests", "eval", "eval_config.yaml");
	assert.ok(existsSync(configPath), "ADK eval config should exist");

	const config = readFileSync(configPath, "utf8");
	assert.match(config, /metrics_to_run:/);
	assert.match(config, /geologist_tool_boundary/);
	assert.match(config, /geologist_no_unapproved_persistence/);
	assert.match(config, /custom_function:/);
	assert.match(config, /geologist_final_response_quality/);
	assert.match(config, /prompt_template:/);
});

await test("ADK App name matches the app directory for eval sessions", () => {
	const agentPath = path.join(packageRoot, "app", "agent.py");
	const agent = readFileSync(agentPath, "utf8");

	assert.match(agent, /app = App\(root_agent=root_agent, name="app"\)/);
	assert.doesNotMatch(agent, /app = App\(root_agent=root_agent, name="geologist"\)/);
});

await test("package exposes an ADK eval command", () => {
	const packageJsonPath = path.join(packageRoot, "package.json");
	const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { scripts: Record<string, string> };

	assert.equal(packageJson.scripts["adk:eval"], "agents-cli eval run");
});

console.log("\n══════════════════════════════════════════════════════");
console.log(`ADK eval harness test complete: ${passed} passed, ${failed} failed`);
console.log("══════════════════════════════════════════════════════");

if (failed > 0) process.exit(1);
