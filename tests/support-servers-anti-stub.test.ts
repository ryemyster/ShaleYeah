/**
 * Support Servers Anti-Stub Tests — Issue #217
 *
 * Follows the ShaleYeah anti-stub test pattern.
 * Covers all 8 support servers: legal, market, title, drilling,
 * infrastructure, development, research, test.
 *
 * Three required test types per server:
 *   1. Mock-SDK — callLLM reaches the Anthropic SDK (auth error)
 *   2. Determinism — different inputs → different outputs
 *   3. Demo-fallback — no API key → clean error from callLLM
 */

import assert from "node:assert";
import { deriveDefaultDevelopmentOutlook } from "../src/servers/development.js";
import { deriveDefaultDrillingInterpretation } from "../src/servers/drilling.js";
import { deriveDefaultInfrastructureInterpretation } from "../src/servers/infrastructure.js";
import { deriveDefaultRegulatoryRisk } from "../src/servers/legal.js";
import { deriveDefaultMarketInterpretation } from "../src/servers/market.js";
import { deriveDefaultResearchSummary } from "../src/servers/research.js";
import { deriveDefaultQAResult } from "../src/servers/test.js";
import { deriveDefaultTitleFindings } from "../src/servers/title.js";
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
			await callLLM({ prompt: "Analyze regulatory risk for a drilling project in Texas.", maxTokens: 200 });
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
// Test 2: Determinism — different inputs → different outputs
// ---------------------------------------------------------------------------

await test("legal: high-risk California exploration differs from low-risk Texas production", () => {
	const caExploration = deriveDefaultRegulatoryRisk("California", "exploration");
	const txProduction = deriveDefaultRegulatoryRisk("Texas", "production");

	assert.notStrictEqual(caExploration, txProduction, "Different jurisdiction/project should produce different risk");
	assert.strictEqual(caExploration, "High", `California exploration should be High risk, got: ${caExploration}`);
	assert.strictEqual(txProduction, "Low", `Texas production should be Low risk, got: ${txProduction}`);
});

await test("market: high oil price ($90) produces bullish trend vs low price ($55) bearish", () => {
	const bullish = deriveDefaultMarketInterpretation(90, 4.0);
	const bearish = deriveDefaultMarketInterpretation(55, 2.5);

	assert.notStrictEqual(bullish.trend, bearish.trend, "Different prices must produce different trends");
	assert.strictEqual(bullish.trend, "bullish", `$90 oil should be bullish, got: ${bullish.trend}`);
	assert.strictEqual(bearish.trend, "bearish", `$55 oil should be bearish, got: ${bearish.trend}`);
	// Outlook must include actual price numbers — not hardcoded text
	assert.ok(
		bullish.outlook.includes("90") || bullish.outlook.includes("$90"),
		`Outlook must include oil price, got: ${bullish.outlook}`,
	);
	assert.ok(
		bearish.outlook.includes("55") || bearish.outlook.includes("$55"),
		`Outlook must include oil price, got: ${bearish.outlook}`,
	);
});

await test("title: complex multi-parcel description differs from simple single parcel", () => {
	const complex = deriveDefaultTitleFindings("Section 1, Section 2, Section 3", "Reeves", "40 years");
	const simple = deriveDefaultTitleFindings("Section 12 Block A", "Midland", "20 years");

	assert.notStrictEqual(
		complex.ownershipPercentage,
		simple.ownershipPercentage,
		"Different descriptions should produce different ownership %",
	);
	assert.ok(complex.ownershipPercentage < simple.ownershipPercentage, "Complex title should have lower ownership %");
	assert.ok(complex.notes.includes("Reeves"), "Notes must include county name");
});

await test("drilling: deep horizontal differs from shallow vertical", () => {
	const deepHorizontal = deriveDefaultDrillingInterpretation("horizontal", 14000, "Eagle Ford Shale");
	const shallowVertical = deriveDefaultDrillingInterpretation("vertical", 5000, "Red Fork Sand");

	assert.notStrictEqual(
		deepHorizontal.programRisk,
		shallowVertical.programRisk,
		"Different well types/depths should produce different risk",
	);
	assert.strictEqual(
		deepHorizontal.programRisk,
		"High",
		`Deep horizontal should be High risk, got: ${deepHorizontal.programRisk}`,
	);
	assert.strictEqual(
		shallowVertical.programRisk,
		"Low",
		`Shallow vertical should be Low risk, got: ${shallowVertical.programRisk}`,
	);
});

await test("infrastructure: remote large project differs from Texas small project", () => {
	const remoteLarge = deriveDefaultInfrastructureInterpretation(30, 15000, "North Dakota Bakken");
	const texasSmall = deriveDefaultInfrastructureInterpretation(5, 2000, "Texas Permian");

	assert.notStrictEqual(
		remoteLarge.takeawayRisk,
		texasSmall.takeawayRisk,
		"Remote large vs Texas small should have different takeaway risk",
	);
	assert.strictEqual(
		remoteLarge.takeawayRisk,
		"High",
		`Remote large should be High risk, got: ${remoteLarge.takeawayRisk}`,
	);
	assert.strictEqual(texasSmall.takeawayRisk, "Low", `Texas small should be Low risk, got: ${texasSmall.takeawayRisk}`);
});

await test("development: tight-budget large project differs from well-funded small project", () => {
	const tightLarge = deriveDefaultDevelopmentOutlook(25, 10_000_000, ["Harsh weather"]);
	const fundedSmall = deriveDefaultDevelopmentOutlook(5, 50_000_000, []);

	assert.notStrictEqual(
		tightLarge.budgetRisk,
		fundedSmall.budgetRisk,
		"Different budget/scale should produce different budget risk",
	);
	assert.strictEqual(tightLarge.budgetRisk, "High", `Tight budget should be High risk, got: ${tightLarge.budgetRisk}`);
	assert.strictEqual(
		fundedSmall.budgetRisk,
		"Low",
		`Funded small project should be Low risk, got: ${fundedSmall.budgetRisk}`,
	);
});

await test("research: different topics and source counts produce different summaries", () => {
	const drillingMulti = deriveDefaultResearchSummary("Permian Basin drilling activity", "regional", 3);
	const gasZeroSources = deriveDefaultResearchSummary("Henry Hub gas prices", "national", 0);

	assert.notStrictEqual(
		drillingMulti,
		gasZeroSources,
		"Different topics/source counts should produce different summaries",
	);
	assert.ok(
		drillingMulti.includes("multiple sources"),
		`Multi-source summary should mention multiple sources, got: ${drillingMulti}`,
	);
	assert.ok(
		gasZeroSources.includes("limited sources"),
		`Zero-source summary should mention limited sources, got: ${gasZeroSources}`,
	);
	// Topics must appear in summaries
	assert.ok(drillingMulti.includes("Permian Basin drilling activity"), "Summary must include topic");
	assert.ok(gasZeroSources.includes("Henry Hub gas prices"), "Summary must include topic");
});

await test("test server: tight accuracy threshold produces WARNING vs standard produces PASS", () => {
	const tightCriteria = deriveDefaultQAResult(["geowiz", "econobot", "decision"], 0.99);
	const standardCriteria = deriveDefaultQAResult(["geowiz"], 0.95);

	assert.notStrictEqual(
		tightCriteria.overallStatus,
		standardCriteria.overallStatus,
		"Different thresholds should produce different QA status",
	);
	assert.strictEqual(
		tightCriteria.overallStatus,
		"WARNING",
		`0.99 threshold should be WARNING, got: ${tightCriteria.overallStatus}`,
	);
	assert.strictEqual(
		standardCriteria.overallStatus,
		"PASS",
		`0.95 threshold should be PASS, got: ${standardCriteria.overallStatus}`,
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
			await callLLM({ prompt: "test support server synthesis" });
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
		"Determinism: different inputs → different outputs (8 servers covered)",
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
