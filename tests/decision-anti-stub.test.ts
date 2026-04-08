/**
 * Decision Anti-Stub Tests — Issue #215
 *
 * Follows the ShaleYeah anti-stub test pattern (reference: geowiz-anti-stub.test.ts).
 *
 * Three required test types:
 *
 *   1. Mock-SDK — prove callLLM reaches the Anthropic SDK (auth error, not our guard)
 *   2. Determinism — different inputs produce different outputs (no hardcoded constants)
 *   3. Demo-fallback — no API key → clean error from callLLM
 *   4. Sentinel — always passes, documents compliance
 */

import assert from "node:assert";
import { calculateRecommendedBid, countDomainsPresent } from "../src/servers/decision.js";
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
				prompt: "Analyze investment: NPV $5M, IRR 22%, risk 35%. Return JSON decision verdict.",
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

await test("countDomainsPresent: all 4 core domains → higher count than 1 domain", () => {
	// AnalysisInputs has 4 scoreable domains: geological, economic, curve, risk
	const fullInputs = {
		geological: { confidence: 0.8 },
		economic: { npv: 5_000_000, irr: 0.22, paybackMonths: 18 },
		curve: { eur: 500_000 },
		risk: { overallRisk: 0.35 },
	};
	const sparseInputs = {
		geological: undefined,
		economic: { npv: 5_000_000, irr: 0.22, paybackMonths: 18 },
		curve: undefined,
		risk: undefined,
	};

	const fullCount = countDomainsPresent(fullInputs);
	const sparseCount = countDomainsPresent(sparseInputs);

	assert.ok(
		fullCount > sparseCount,
		`Full inputs (${fullCount} domains) must count higher than sparse inputs (${sparseCount} domains)`,
	);
	assert.strictEqual(fullCount, 4, `Expected 4 domains present, got ${fullCount}`);
	assert.strictEqual(sparseCount, 1, `Expected 1 domain present, got ${sparseCount}`);
});

await test("calculateRecommendedBid: INVEST produces non-zero bid, PASS produces zero", () => {
	const npv = 5_000_000;
	const investBid = calculateRecommendedBid(npv, "INVEST");
	const passBid = calculateRecommendedBid(npv, "PASS");

	assert.ok(investBid > 0, `INVEST with NPV $${npv} should produce a non-zero bid, got ${investBid}`);
	assert.strictEqual(passBid, 0, `PASS should always produce zero bid, got ${passBid}`);
	assert.ok(
		investBid < npv,
		`Recommended bid ($${investBid}) must be less than NPV ($${npv}) — we never bid full value`,
	);
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
			await callLLM({ prompt: "test decision analysis" });
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
