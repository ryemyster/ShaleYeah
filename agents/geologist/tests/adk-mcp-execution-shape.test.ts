/**
 * ADK MCP execution tests for issue #589.
 *
 * These tests verify that the Python ADK path owns the first real Geowiz MCP
 * execution boundary instead of remaining planned-only.
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

console.log("🧪 Starting Geologist ADK MCP execution tests (#589)\n");

await test("Python MCP client module exists for Geowiz execution", () => {
	const clientPath = path.join(packageRoot, "app", "geowiz_mcp.py");
	assert.ok(existsSync(clientPath), "app/geowiz_mcp.py should be package-local");

	const client = readFileSync(clientPath, "utf8");
	assert.match(client, /from mcp import ClientSession/);
	assert.match(client, /streamablehttp_client/);
	assert.match(client, /async def call_geowiz_tool/);
	assert.match(client, /async def assess_geowiz_quality/);
	assert.match(client, /"assess_quality"/);
	assert.match(client, /GEOWIZ_MCP_URL/);
});

await test("ADK root agent exposes assess_geowiz_quality as an execution tool", () => {
	const agentPath = path.join(packageRoot, "app", "agent.py");
	const agent = readFileSync(agentPath, "utf8");

	assert.match(agent, /from app\.geowiz_mcp import .*assess_geowiz_quality/);
	assert.match(agent, /tools=\[geowiz_backend_status, plan_geowiz_tool_call, assess_geowiz_quality\]/);
	assert.doesNotMatch(agent, /planned-only/);
	assert.match(agent, /"executionBoundary": "adk-mcp"/);
});

await test("Python project declares MCP client dependency", () => {
	const pyprojectPath = path.join(packageRoot, "pyproject.toml");
	const pyproject = readFileSync(pyprojectPath, "utf8");

	assert.match(pyproject, /"mcp>=/);
	assert.match(pyproject, /"google-adk\[gcp\]>=/);
});

await test("ADK spec identifies assess_quality as the first execution slice", () => {
	const specPath = path.join(packageRoot, ".agents-cli-spec.md");
	const spec = readFileSync(specPath, "utf8");

	assert.match(spec, /assess_quality/);
	assert.match(spec, /ADK MCP execution/i);
	assert.match(spec, /TypeScript adapter/i);
});

console.log("\n══════════════════════════════════════════════════════");
console.log(`ADK MCP execution test complete: ${passed} passed, ${failed} failed`);
console.log("══════════════════════════════════════════════════════");

if (failed > 0) process.exit(1);
