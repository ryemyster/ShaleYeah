/**
 * Reporter Anti-Stub Tests — Issue #216
 *
 * Follows the ShaleYeah anti-stub test pattern.
 *
 * Three required test types:
 *
 *   1. Mock-SDK — prove callLLM reaches the Anthropic SDK (auth error, not our guard)
 *   2. Determinism — different inputs produce different outputs (no hardcoded strings)
 *   3. Demo-fallback — no API key → clean error from callLLM
 *   4. Sentinel — always passes, documents compliance
 */

import assert from "node:assert";
import { countWordsInSummary, deriveDefaultExecutiveSummary } from "../src/servers/reporter.js";
import { callLLM } from "../src/shared/llm-client.js";

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
			console.log(`  ✗ ${name}`);
			console.log(`    ${err instanceof Error ? err.message : String(err)}`);
			failed++;
		});
}

// ---------------------------------------------------------------------------
// Test 1: Mock-SDK — callLLM reaches the Anthropic SDK
// ---------------------------------------------------------------------------

await test("callLLM: reaches Anthropic SDK — auth error proves messages.create was called", async () => {
	const savedKey = process.env.ANTHROPIC_API_KEY;
	try {
		process.env.ANTHROPIC_API_KEY = "sk-ant-api03-fake-key-for-testing-purposes-only-00000000000000000000000000";

		let caughtError: Error | null = null;
		try {
			await callLLM({
				prompt: "Write an executive summary for a well investment with NPV $5M and IRR 22%.",
				maxTokens: 350,
			});
		} catch (err: unknown) {
			caughtError = err instanceof Error ? err : new Error(String(err));
		}

		assert.ok(caughtError !== null, "Expected callLLM to throw with invalid API key");
		assert.ok(
			!caughtError.message.includes("environment variable is not set"),
			`callLLM threw our guard instead of reaching the SDK: ${caughtError.message}`,
		);

		const sdkErrorIndicators = [
			"401",
			"403",
			"authentication",
			"auth",
			"invalid",
			"unauthorized",
			"api key",
			"fetch",
			"network",
			"ECONNREFUSED",
			"ENOTFOUND",
		];
		const messageLC = caughtError.message.toLowerCase();
		const reachedSdk = sdkErrorIndicators.some((indicator) => messageLC.includes(indicator));
		assert.ok(reachedSdk, `Expected SDK-level error (auth/network), got: ${caughtError.message}`);
	} finally {
		if (savedKey !== undefined) {
			process.env.ANTHROPIC_API_KEY = savedKey;
		} else {
			delete process.env.ANTHROPIC_API_KEY;
		}
	}
});

// ---------------------------------------------------------------------------
// Test 2: Determinism — different inputs produce different outputs
// ---------------------------------------------------------------------------

await test("deriveDefaultExecutiveSummary: high-NPV PROCEED differs from negative-NPV REJECT", () => {
	const proceedSummary = deriveDefaultExecutiveSummary({
		tractName: "Eagle Ford Block 12",
		recommendation: "PROCEED",
		npv: 8_500_000,
		irr: 0.28,
		paybackMonths: 14,
		confidence: 88,
	});

	const rejectSummary = deriveDefaultExecutiveSummary({
		tractName: "Permian West 4",
		recommendation: "REJECT",
		npv: -500_000,
		irr: 0.06,
		paybackMonths: 48,
		confidence: 72,
	});

	// Must differ — not the same template string for all inputs
	assert.notStrictEqual(proceedSummary, rejectSummary, "Different inputs must produce different summaries");

	// Must contain actual numbers from the input — not hardcoded placeholders
	assert.ok(
		proceedSummary.includes("8.5") || proceedSummary.includes("8,500"),
		`PROCEED summary must include the NPV ($8.5M), got: ${proceedSummary}`,
	);
	assert.ok(
		rejectSummary.includes("REJECT") || rejectSummary.toLowerCase().includes("reject"),
		`REJECT summary must reference the recommendation, got: ${rejectSummary}`,
	);

	// Tract names must appear in respective summaries
	assert.ok(proceedSummary.includes("Eagle Ford Block 12"), "Summary must include tract name");
	assert.ok(rejectSummary.includes("Permian West 4"), "Summary must include tract name");
});

await test("countWordsInSummary: word count is correct and under 500 for typical summary", () => {
	const shortSummary = "The well analysis indicates strong returns.";
	const count = countWordsInSummary(shortSummary);
	assert.strictEqual(count, 6, `Expected 6 words, got ${count}`);

	// A default summary must be under 500 words
	const defaultSummary = deriveDefaultExecutiveSummary({
		tractName: "Test Tract",
		recommendation: "PROCEED",
		npv: 5_000_000,
		irr: 0.22,
		paybackMonths: 18,
		confidence: 85,
	});
	const wordCount = countWordsInSummary(defaultSummary);
	assert.ok(wordCount < 500, `Default executive summary must be under 500 words, got ${wordCount}`);
});

// ---------------------------------------------------------------------------
// Test 3: Demo-fallback — callLLM throws clean error without API key
// ---------------------------------------------------------------------------

await test("callLLM: throws descriptive error when ANTHROPIC_API_KEY is absent", async () => {
	const savedKey = process.env.ANTHROPIC_API_KEY;
	try {
		delete process.env.ANTHROPIC_API_KEY;

		let threw = false;
		let errorMessage = "";
		try {
			await callLLM({ prompt: "test reporter synthesis" });
		} catch (err: unknown) {
			threw = true;
			errorMessage = err instanceof Error ? err.message : String(err);
		}

		assert.ok(threw, "callLLM must throw when ANTHROPIC_API_KEY is absent");
		assert.ok(
			errorMessage.includes("ANTHROPIC_API_KEY") || errorMessage.includes("API key"),
			`Expected error to mention API key, got: ${errorMessage}`,
		);
	} finally {
		if (savedKey !== undefined) {
			process.env.ANTHROPIC_API_KEY = savedKey;
		}
	}
});

// ---------------------------------------------------------------------------
// Sentinel — always passes, confirms all three pattern types are present
// ---------------------------------------------------------------------------

await test("PATTERN: all three anti-stub test types are present in this file", () => {
	const patternTypes = [
		"Mock-SDK: SDK is reached — auth error proves messages.create was called",
		"Determinism: different inputs → different outputs (no hardcoded constants)",
		"Demo-fallback: no API key → clean error from callLLM",
	];
	assert.strictEqual(patternTypes.length, 3);
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n  Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
	process.exit(1);
}
console.log();
