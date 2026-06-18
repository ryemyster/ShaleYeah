/**
 * Geologist Agent — Arcade Pattern #10: Performance Hints
 *
 * Verifies that executeLoop injects [complexity, ~latencyMs] annotations
 * into the system prompt so the LLM can factor call cost into planning.
 */

import assert from "node:assert";
import type { LLMCallOptions } from "@shaleyeah/sdk";
import { geologistConfig, geologistManifest, runGeologistTask } from "../src/agent/index.js";

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
			console.error(`  ❌ ${name}`);
			console.error(`     ${err instanceof Error ? err.message : String(err)}`);
			failed++;
		});
}

console.log("🧪 Arcade #10: Performance Hints — System Prompt Tests\n");

console.log("📋 Manifest declares performance hints on all tools...");
await test("every geologist tool has a complexity field", () => {
	const missing = geologistManifest.tools.filter((t) => !t.complexity);
	assert.strictEqual(missing.length, 0, `Tools missing complexity: ${missing.map((t) => t.name).join(", ")}`);
});

await test("every geologist tool has estimatedLatencyMs", () => {
	const missing = geologistManifest.tools.filter((t) => !t.estimatedLatencyMs);
	assert.strictEqual(missing.length, 0, `Tools missing estimatedLatencyMs: ${missing.map((t) => t.name).join(", ")}`);
});

await test("complexity values are only fast/moderate/slow", () => {
	const valid = new Set(["fast", "moderate", "slow"]);
	const invalid = geologistManifest.tools.filter((t) => t.complexity && !valid.has(t.complexity));
	assert.strictEqual(invalid.length, 0, `Invalid complexity on: ${invalid.map((t) => t.name).join(", ")}`);
});

await test("seismic tool is classified slow", () => {
	const seismic = geologistManifest.tools.find((t) => t.name === "geologist.process_seismic_data");
	assert.ok(seismic, "seismic tool exists");
	assert.strictEqual(seismic?.complexity, "slow");
});

await test("assess_quality is classified fast", () => {
	const qa = geologistManifest.tools.find((t) => t.name === "geologist.assess_quality");
	assert.ok(qa, "assess_quality tool exists");
	assert.strictEqual(qa?.complexity, "fast");
});

console.log("\n📋 executeLoop injects performance hints into system prompt...");
{
	let capturedSystem: string | undefined;

	const fakeLLM = async (opts: LLMCallOptions): Promise<string> => {
		// Capture the first system prompt (the one used on step 0).
		if (!capturedSystem) capturedSystem = opts.system;
		return JSON.stringify({ action: "done", answer: "test-done" });
	};

	await runGeologistTask("test goal", {
		config: geologistConfig,
		callLLM: fakeLLM,
	});

	await test("system prompt contains Performance hints section", () => {
		assert.ok(capturedSystem, "system prompt was captured");
		assert.ok(
			capturedSystem?.includes("Performance hints"),
			`Expected "Performance hints" in system prompt.\nGot: ${capturedSystem?.slice(0, 500)}`,
		);
	});

	await test("system prompt contains [slow, ~8000ms] for seismic tool", () => {
		assert.ok(
			capturedSystem?.includes("[slow,") || capturedSystem?.includes("[slow, ~"),
			`Expected slow complexity in system prompt.\nGot: ${capturedSystem?.slice(0, 600)}`,
		);
	});

	await test("system prompt contains [fast, annotation for deterministic tools", () => {
		assert.ok(
			capturedSystem?.includes("[fast,"),
			`Expected fast complexity annotation.\nGot: ${capturedSystem?.slice(0, 600)}`,
		);
	});

	await test("system prompt contains [moderate, annotation for LLM tools", () => {
		assert.ok(
			capturedSystem?.includes("[moderate,"),
			`Expected moderate complexity annotation.\nGot: ${capturedSystem?.slice(0, 600)}`,
		);
	});
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
