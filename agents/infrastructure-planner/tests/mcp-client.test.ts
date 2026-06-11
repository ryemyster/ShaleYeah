/**
 * Infrastructure Planner MCP Client Tests — Issue #375
 *
 * Layer 1: callInfrastructureTool export, config shape, tool manifest declarations.
 * Layer 2: runInfrastructurePlannerTask export, callLLM wiring, HITL contract.
 */

import assert from "node:assert";
import { PermanentToolError, RetryableToolError } from "@shaleyeah/sdk";
import {
	callInfrastructureTool,
	createInfrastructurePlannerRuntime,
	infrastructurePlannerConfig,
	infrastructurePlannerManifest,
	runInfrastructurePlannerTask,
} from "../src/agent/index.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
	return Promise.resolve()
		.then(() => fn())
		.then(() => {
			console.log(`  ✅ ${name}`);
			passed++;
		})
		.catch((err) => {
			console.error(
				`  ❌ ${name}: ${err instanceof Error ? err.message : err}`,
			);
			failed++;
		});
}

const LIVE_SERVER = await (async () => {
	try {
		const url =
			infrastructurePlannerConfig.mcpServers?.infrastructure?.url ??
			"http://localhost:3012";
		const ctrl = new AbortController();
		const timer = setTimeout(() => ctrl.abort(), 500);
		await fetch(url, { method: "HEAD", signal: ctrl.signal });
		clearTimeout(timer);
		return true;
	} catch {
		return false;
	}
})();

console.log("🧪 Starting Infrastructure Planner MCP Client Tests (#375)\n");

console.log("📦 Layer 1 — callInfrastructureTool export and config...");
await test("callInfrastructureTool is exported", () => {
	assert.strictEqual(typeof callInfrastructureTool, "function");
});

await test("infrastructure server URL defaults to localhost:3012", () => {
	const url = infrastructurePlannerConfig.mcpServers?.infrastructure?.url;
	assert.strictEqual(url, "http://localhost:3012");
});

await test("infrastructure server transport is http", () => {
	const transport =
		infrastructurePlannerConfig.mcpServers?.infrastructure?.transport;
	assert.strictEqual(transport, "http");
});

await test("all 4 infrastructure-planner tools declare mcpServer: 'infrastructure'", () => {
	const all = infrastructurePlannerManifest.tools.every(
		(t) => t.mcpServer === "infrastructure",
	);
	assert.ok(all, "Every tool must point to the infrastructure server");
});

await test("standard-analysis model requirement uses real model", () => {
	const binding = infrastructurePlannerConfig.modelRouting["standard-analysis"];
	assert.ok(
		binding?.model.includes("claude"),
		"Must reference a real Claude model",
	);
});

await test("callInfrastructureTool throws RetryableToolError for unreachable server", async () => {
	try {
		await callInfrastructureTool(
			"http://localhost:19999/transport",
			"plan_pipeline",
			{
				wellCount: 10,
				expectedProduction: 5000,
				location: "Reeves County, Texas",
			},
		);
		assert.fail("Should have thrown");
	} catch (err) {
		assert.ok(
			err instanceof RetryableToolError,
			`Expected RetryableToolError, got: ${err instanceof Error ? err.constructor.name : err}`,
		);
	}
});

console.log(
	"\n🔄 Layer 2 — runInfrastructurePlannerTask export and LLM wiring...",
);
await test("runInfrastructurePlannerTask is exported", () => {
	assert.strictEqual(typeof runInfrastructurePlannerTask, "function");
});

await test("runInfrastructurePlannerTask throws without API key", async () => {
	const origKey = process.env.ANTHROPIC_API_KEY;
	process.env.ANTHROPIC_API_KEY = "";
	try {
		await runInfrastructurePlannerTask(
			"Plan pipeline for 10 wells in Reeves County, Texas",
		);
		assert.fail("Should have thrown");
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		assert.ok(
			msg.toLowerCase().includes("anthropic_api_key") ||
				msg.toLowerCase().includes("api key") ||
				msg.toLowerCase().includes("api_key") ||
				msg.toLowerCase().includes("authentication") ||
				msg.toLowerCase().includes("unauthorized"),
			`Expected auth-related error, got: ${msg}`,
		);
	} finally {
		if (origKey !== undefined) process.env.ANTHROPIC_API_KEY = origKey;
	}
});

await test("runInfrastructurePlannerTask with invalid key hits callLLM (auth error)", async () => {
	try {
		await runInfrastructurePlannerTask(
			"Plan pipeline for 5 wells in Midland, Texas",
			{
				apiKey: "sk-ant-invalid-key-for-test",
			},
		);
		assert.fail("Should have thrown with auth error");
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		assert.ok(
			msg.toLowerCase().includes("auth") ||
				msg.toLowerCase().includes("unauthorized") ||
				msg.toLowerCase().includes("invalid") ||
				msg.toLowerCase().includes("api"),
			`Expected auth error from callLLM, got: ${msg}`,
		);
	}
});

console.log("\n🔒 Error classification exports...");
await test("RetryableToolError is importable from sdk", () => {
	assert.ok(
		RetryableToolError,
		"RetryableToolError must be exported from @shaleyeah/sdk",
	);
});

await test("PermanentToolError is importable from sdk", () => {
	assert.ok(
		PermanentToolError,
		"PermanentToolError must be exported from @shaleyeah/sdk",
	);
});

console.log("\n🙋 HITL approval_required contract (no live server needed)...");
await test("approvalMode: 'always' returns approval_required before calling handler", async () => {
	const strictRuntime = createInfrastructurePlannerRuntime({
		...infrastructurePlannerConfig,
		hitl: { ...infrastructurePlannerConfig.hitl, approvalMode: "always" },
	});
	await strictRuntime.initialize();
	const result = await strictRuntime.execute({
		toolName: "infrastructure-planner.plan_pipeline",
		args: {
			wellCount: 10,
			expectedProduction: 5000,
			location: "Reeves County, Texas",
		},
	});
	assert.strictEqual(result.status, "approval_required");
	await strictRuntime.shutdown();
});

console.log("\n🌐 Integration tests (live infrastructure server required)...");
if (!LIVE_SERVER) {
	console.log(
		"  ⚠️  [skipped] infrastructure server not reachable at localhost:3012",
	);
} else {
	await test("plan_pipeline returns pipeline plan via live server", async () => {
		const result = await callInfrastructureTool(
			infrastructurePlannerConfig.mcpServers?.infrastructure?.url,
			"plan_pipeline",
			{
				wellCount: 10,
				expectedProduction: 5000,
				location: "Reeves County, Texas",
			},
		);
		assert.ok(result, "Must return a result");
	});
}

console.log("\n══════════════════════════════════════════════");
console.log(
	`Infrastructure Planner MCP Client Tests: ${passed} passed, ${failed} failed`,
);
console.log("══════════════════════════════════════════════");

if (failed > 0) process.exit(1);
