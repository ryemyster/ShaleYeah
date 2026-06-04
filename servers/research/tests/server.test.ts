import assert from "node:assert";
import { deriveDefaultCompetitorEntry, deriveDefaultResearchSummary } from "../src/index.js";
import { callLLM } from "@shaleyeah/sdk";

let passed = 0; let failed = 0;
function test(name: string, fn: () => void | Promise<void>): Promise<void> {
	return Promise.resolve().then(fn).then(() => { console.log(`  ✓ ${name}`); passed++; })
		.catch((err: unknown) => { console.log(`  ✗ ${name}\n    ${err instanceof Error ? err.message : String(err)}`); failed++; });
}

await test("callLLM: reaches Anthropic SDK", async () => {
	const saved = process.env.ANTHROPIC_API_KEY;
	try {
		process.env.ANTHROPIC_API_KEY = "sk-ant-api03-fake-key-for-testing-purposes-only-00000000000000000000000000";
		let err: Error | null = null;
		try { await callLLM({ prompt: "Research Permian Basin activity.", maxTokens: 200 }); } catch (e: unknown) { err = e instanceof Error ? e : new Error(String(e)); }
		assert.ok(err !== null); assert.ok(!err.message.includes("environment variable is not set"));
	} finally { if (saved !== undefined) { process.env.ANTHROPIC_API_KEY = saved; } else { delete process.env.ANTHROPIC_API_KEY; } }
});

await test("research: different topics and source counts produce different summaries", () => {
	const drillingMulti = deriveDefaultResearchSummary("Permian Basin drilling activity", "regional", 3);
	const gasZero = deriveDefaultResearchSummary("Henry Hub gas prices", "national", 0);
	assert.notStrictEqual(drillingMulti, gasZero);
	assert.ok(drillingMulti.includes("multiple sources"));
	assert.ok(gasZero.includes("limited sources"));
	assert.ok(drillingMulti.includes("Permian Basin drilling activity"));
});

await test("research: competitive analysis fallback varies by region and competitor list", () => {
	const permian = deriveDefaultCompetitorEntry("Pioneer Natural Resources", "Permian Basin", 0);
	const appalachia = deriveDefaultCompetitorEntry("EQT Corporation", "Appalachia", 1);
	assert.ok(String(permian.activities).toLowerCase().includes("permian"));
	assert.ok(String(appalachia.activities).toLowerCase().includes("appalachia"));
	assert.strictEqual(permian.threatLevel, "HIGH");
	assert.strictEqual(appalachia.threatLevel, "MEDIUM");
	assert.strictEqual(permian.dataSource, "llm-fallback");
});

await test("callLLM: throws when ANTHROPIC_API_KEY absent", async () => {
	const saved = process.env.ANTHROPIC_API_KEY;
	try {
		delete process.env.ANTHROPIC_API_KEY;
		let threw = false;
		try { await callLLM({ prompt: "test" }); } catch { threw = true; }
		assert.ok(threw);
	} finally { if (saved !== undefined) { process.env.ANTHROPIC_API_KEY = saved; } }
});

console.log(`\n  Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
