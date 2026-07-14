/**
 * ADK project-shape tests for issue #587.
 *
 * These tests protect the monorepo boundary: ADK shape belongs in the individual
 * agent project, while repo root remains workspace coordination only.
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
const repoRoot = path.resolve(packageRoot, "../..");

console.log("🧪 Starting Geologist ADK project-shape tests (#587)\n");

await test("ADK manifest exists inside agents/geologist", () => {
	const manifestPath = path.join(packageRoot, "agents-cli-manifest.yaml");
	assert.ok(existsSync(manifestPath), "agents-cli-manifest.yaml should be package-local");

	const manifest = readFileSync(manifestPath, "utf8");
	assert.match(manifest, /name:\s+"geologist"/);
	assert.match(manifest, /agent_directory:\s+"app"/);
	assert.match(manifest, /deployment_target:\s+"none"/);
});

await test("ADK Python entrypoint exists inside agents/geologist", () => {
	const agentPath = path.join(packageRoot, "app", "agent.py");
	assert.ok(existsSync(agentPath), "app/agent.py should be package-local");

	const agent = readFileSync(agentPath, "utf8");
	assert.match(agent, /root_agent\s*=\s*Agent\(/);
	assert.match(agent, /app\s*=\s*App\(/);
	assert.match(agent, /GEOWIZ_MCP_URL/);
	assert.match(agent, /servers\/geowiz remains independently runnable/);
});

await test("ADK project spec records package-local boundaries", () => {
	const specPath = path.join(packageRoot, ".agents-cli-spec.md");
	assert.ok(existsSync(specPath), ".agents-cli-spec.md should live in agents/geologist");

	const spec = readFileSync(specPath, "utf8");
	assert.match(spec, /monorepo root remains workspace coordination only/i);
	assert.match(spec, /servers\/geowiz.*independently runnable MCP backend/is);
	assert.match(spec, /temporary adapter/i);
});

await test("repo root does not become an ADK project", () => {
	const forbiddenRootFiles = ["agents-cli-manifest.yaml", "pyproject.toml", ".agents-cli-spec.md"];
	for (const file of forbiddenRootFiles) {
		assert.ok(!existsSync(path.join(repoRoot, file)), `${file} must not be added at repo root`);
	}
	assert.ok(!existsSync(path.join(repoRoot, "app", "agent.py")), "app/agent.py must not be added at repo root");
});

console.log("\n══════════════════════════════════════════════════════");
console.log(`ADK shape test complete: ${passed} passed, ${failed} failed`);
console.log("══════════════════════════════════════════════════════");

if (failed > 0) process.exit(1);
