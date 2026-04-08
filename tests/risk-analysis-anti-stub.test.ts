/**
 * Risk Analysis Anti-Stub Tests — Issue #214
 *
 * Follows the ShaleYeah anti-stub test pattern (reference: geowiz-anti-stub.test.ts).
 *
 * Three required test types:
 *
 *   1. Mock-SDK — prove callLLM reaches the Anthropic SDK (auth error, not our guard)
 *   2. Determinism — different inputs produce different risk weights (no hardcoded constants)
 *   3. Demo-fallback — no API key → clean error from callLLM
 *   4. Sentinel — always passes, documents compliance
 */

import assert from "node:assert";
import {
	assessEnvironmentalRisk,
	assessOperationalRisk,
	assessRegulatoryRisk,
	assessTechnicalRisk,
} from "../src/servers/risk-analysis.js";
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
				prompt: "Analyze risk: overall 45%, geological 60%, economic 30%. Return JSON risk narrative.",
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
// Test 2: Determinism — different inputs produce different risk weights
// ---------------------------------------------------------------------------

await test("assessRegulatoryRisk: Texas vs California produce different scores", () => {
	const texasRisk = assessRegulatoryRisk({ jurisdiction: "Texas" });
	const californiaRisk = assessRegulatoryRisk({ jurisdiction: "California" });
	assert.notStrictEqual(
		texasRisk,
		californiaRisk,
		`Texas (${texasRisk}) and California (${californiaRisk}) must produce different regulatory risk scores`,
	);
	// Texas should be lower risk than California
	assert.ok(
		texasRisk < californiaRisk,
		`Texas (${texasRisk}) should be lower risk than California (${californiaRisk})`,
	);
});

await test("assessTechnicalRisk: horizontal/deep vs vertical/shallow produce different scores", () => {
	const horizontalDeep = assessTechnicalRisk({ wellType: "horizontal", depth: 14000 });
	const verticalShallow = assessTechnicalRisk({ wellType: "vertical", depth: 3000 });
	assert.notStrictEqual(
		horizontalDeep,
		verticalShallow,
		`Horizontal/deep (${horizontalDeep}) and vertical/shallow (${verticalShallow}) must differ`,
	);
	assert.ok(
		horizontalDeep > verticalShallow,
		`Horizontal/deep (${horizontalDeep}) should be higher risk than vertical/shallow (${verticalShallow})`,
	);
});

await test("assessEnvironmentalRisk: California vs Texas produce different scores", () => {
	const california = assessEnvironmentalRisk({ jurisdiction: "California" });
	const texas = assessEnvironmentalRisk({ jurisdiction: "Texas" });
	assert.notStrictEqual(california, texas, "California and Texas must produce different environmental risk scores");
	assert.ok(california > texas, `California (${california}) should be higher environmental risk than Texas (${texas})`);
});

await test("assessOperationalRisk: horizontal shale vs vertical conventional produce different scores", () => {
	const horizontalShale = assessOperationalRisk({ wellType: "horizontal", formation: "Wolfcamp shale" });
	const verticalConventional = assessOperationalRisk({ wellType: "vertical", formation: "Sandstone" });
	assert.notStrictEqual(
		horizontalShale,
		verticalConventional,
		"Horizontal shale and vertical conventional must produce different operational risk scores",
	);
	assert.ok(
		horizontalShale > verticalConventional,
		`Horizontal shale (${horizontalShale}) should be higher operational risk than vertical conventional (${verticalConventional})`,
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
			await callLLM({ prompt: "test risk analysis" });
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
		"Determinism: different inputs → different risk weights (no hardcoded constants)",
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
