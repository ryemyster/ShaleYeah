import assert from "node:assert";
import { callLLM } from "@shaleyeah/sdk";
import { deriveDefaultRegulatoryRisk } from "../src/index.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
	return Promise.resolve()
		.then(fn)
		.then(() => {
			console.log(`  ✓ ${name}`);
			passed++;
		})
		.catch((err: unknown) => {
			console.log(`  ✗ ${name}\n    ${err instanceof Error ? err.message : String(err)}`);
			failed++;
		});
}

await test("callLLM: reaches Anthropic SDK — auth error proves messages.create was called", async () => {
	const savedKey = process.env.ANTHROPIC_API_KEY;
	try {
		process.env.ANTHROPIC_API_KEY = "sk-ant-api03-fake-key-for-testing-purposes-only-00000000000000000000000000";
		let caughtError: Error | null = null;
		try {
			await callLLM({ prompt: "Analyze regulatory risk for a drilling project in Texas.", maxTokens: 200 });
		} catch (err: unknown) {
			caughtError = err instanceof Error ? err : new Error(String(err));
		}
		assert.ok(caughtError !== null, "Expected callLLM to throw");
		assert.ok(
			!caughtError.message.includes("environment variable is not set"),
			`Guard fired instead of SDK: ${caughtError.message}`,
		);
	} finally {
		if (savedKey !== undefined) {
			process.env.ANTHROPIC_API_KEY = savedKey;
		} else {
			delete process.env.ANTHROPIC_API_KEY;
		}
	}
});

await test("legal: high-risk California exploration differs from low-risk Texas production", () => {
	const caExploration = deriveDefaultRegulatoryRisk("California", "exploration");
	const txProduction = deriveDefaultRegulatoryRisk("Texas", "production");
	assert.notStrictEqual(caExploration, txProduction);
	assert.strictEqual(caExploration, "High");
	assert.strictEqual(txProduction, "Low");
});

await test("callLLM: throws descriptive error when ANTHROPIC_API_KEY is absent", async () => {
	const savedKey = process.env.ANTHROPIC_API_KEY;
	try {
		delete process.env.ANTHROPIC_API_KEY;
		let threw = false;
		let errorMessage = "";
		try {
			await callLLM({ prompt: "test" });
		} catch (err: unknown) {
			threw = true;
			errorMessage = err instanceof Error ? err.message : String(err);
		}
		assert.ok(threw);
		assert.ok(errorMessage.includes("ANTHROPIC_API_KEY") || errorMessage.includes("API key"));
	} finally {
		if (savedKey !== undefined) {
			process.env.ANTHROPIC_API_KEY = savedKey;
		}
	}
});

console.log(`\n  Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
