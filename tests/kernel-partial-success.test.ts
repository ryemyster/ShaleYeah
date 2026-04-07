/**
 * Partial Success Tests — Issue #148
 *
 * TDD: written BEFORE the implementation.
 * Tests should fail until partial success features are implemented.
 *
 * Validates:
 * - toPartialSuccessResult(): splits GatheredResponse into succeeded[]/failed[]/errors[]
 * - toBundlePartialSuccessResult(): same for BundleResponse
 * - OutputShaper.shapeGathered(): natural language formatting at all detail levels
 * - OutputShaper.shapeBundle(): natural language formatting at all detail levels
 */

import assert from "node:assert";
import { toBundlePartialSuccessResult, toPartialSuccessResult } from "../src/kernel/executor.js";
import { OutputShaper } from "../src/kernel/middleware/output.js";
import type { BundleResponse, FailureDetail, GatheredResponse, ToolResponse } from "../src/kernel/types.js";
import { ErrorType } from "../src/kernel/types.js";

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
// Helpers — build minimal GatheredResponse / BundleResponse fixtures
// ---------------------------------------------------------------------------

function successResponse(serverName: string): ToolResponse {
	return {
		success: true,
		summary: `${serverName} done`,
		confidence: 90,
		data: { server: serverName },
		detailLevel: "standard",
		completeness: 100,
		metadata: { server: serverName, persona: "test", executionTimeMs: 5, timestamp: new Date().toISOString() },
	};
}

function failureResponse(serverName: string): ToolResponse {
	return {
		success: false,
		summary: `${serverName} failed`,
		confidence: 0,
		data: null,
		detailLevel: "standard",
		completeness: 0,
		metadata: { server: serverName, persona: "test", executionTimeMs: 5, timestamp: new Date().toISOString() },
		error: { type: ErrorType.RETRYABLE, message: `${serverName} connection error` },
	};
}

function makeGathered(successNames: string[], failureNames: string[], withRecoveryGuide = false): GatheredResponse {
	const results = new Map<string, ToolResponse>();
	for (const name of successNames) {
		results.set(`${name}.analyze`, successResponse(name));
	}
	for (const name of failureNames) {
		results.set(`${name}.analyze`, failureResponse(name));
	}

	const failures: FailureDetail[] = failureNames.map((name) => ({
		toolName: `${name}.analyze`,
		error: { type: ErrorType.RETRYABLE, message: `${name} connection error` },
		...(withRecoveryGuide
			? {
					recoveryGuide: {
						errorType: ErrorType.RETRYABLE,
						message: "err",
						reason: "conn",
						recoverySteps: ["Retry in 30s"],
					},
				}
			: {}),
	}));

	const total = successNames.length + failureNames.length;
	const completeness = total > 0 ? Math.round((successNames.length / total) * 100) : 100;

	return {
		results,
		completeness,
		totalTimeMs: 50,
		failures,
		degraded: failureNames.length > 0 || undefined,
	};
}

function makeBundle(successNames: string[], failureNames: string[]): BundleResponse {
	const results = new Map<string, ToolResponse>();
	for (const name of successNames) {
		results.set(`${name}.analyze`, successResponse(name));
	}
	for (const name of failureNames) {
		results.set(`${name}.analyze`, failureResponse(name));
	}

	const phaseFailures: FailureDetail[] = failureNames.map((name) => ({
		toolName: `${name}.analyze`,
		error: { type: ErrorType.RETRYABLE, message: `${name} connection error` },
	}));

	const total = successNames.length + failureNames.length;
	const completeness = total > 0 ? Math.round((successNames.length / total) * 100) : 100;

	return {
		bundleName: "test-bundle",
		results,
		completeness,
		totalTimeMs: 100,
		phases: [
			{
				phase: 1,
				tools: [...successNames, ...failureNames].map((n) => `${n}.analyze`),
				completeness,
				timeMs: 100,
				failures: phaseFailures,
			},
		],
		overallSuccess: failureNames.length === 0,
		degraded: failureNames.length > 0 || undefined,
	};
}

// ---------------------------------------------------------------------------
// toPartialSuccessResult()
// ---------------------------------------------------------------------------

async function runTests(): Promise<void> {
	console.log("\n🧪 Partial Success Tests (Issue #148)\n");

	await test("toPartialSuccessResult(): succeeded[] contains tools with success:true", () => {
		const gathered = makeGathered(["geowiz", "econobot"], ["risk"]);
		const result = toPartialSuccessResult(gathered);
		assert.strictEqual(result.succeeded.length, 2);
		assert.ok(result.succeeded.some((s) => s.toolName === "geowiz.analyze"));
		assert.ok(result.succeeded.some((s) => s.toolName === "econobot.analyze"));
	});

	await test("toPartialSuccessResult(): failed[] contains tools with success:false", () => {
		const gathered = makeGathered(["geowiz"], ["risk", "market"]);
		const result = toPartialSuccessResult(gathered);
		assert.strictEqual(result.failed.length, 2);
		assert.ok(result.failed.some((f) => f.toolName === "risk.analyze"));
		assert.ok(result.failed.some((f) => f.toolName === "market.analyze"));
	});

	await test("toPartialSuccessResult(): errors[] is same array as failed[]", () => {
		const gathered = makeGathered(["geowiz"], ["risk"]);
		const result = toPartialSuccessResult(gathered);
		assert.strictEqual(result.errors, result.failed);
	});

	await test("toPartialSuccessResult(): completeness matches ratio of succeeded/total", () => {
		const gathered = makeGathered(["geowiz", "econobot"], ["risk"]);
		const result = toPartialSuccessResult(gathered);
		// 2 succeeded of 3 total = 67%
		assert.ok(result.completeness > 60 && result.completeness < 70, `Expected ~67%, got ${result.completeness}`);
		assert.strictEqual(result.total, 3);
	});

	await test("toPartialSuccessResult(): recoveryHint from recoveryGuide.recoverySteps[0] when present", () => {
		const gathered = makeGathered(["geowiz"], ["risk"], true);
		const result = toPartialSuccessResult(gathered);
		assert.strictEqual(result.failed[0].recoveryHint, "Retry in 30s");
	});

	await test("toPartialSuccessResult(): recoveryHint falls back to error message when no guide", () => {
		const gathered = makeGathered(["geowiz"], ["risk"], false);
		const result = toPartialSuccessResult(gathered);
		assert.ok(result.failed[0].recoveryHint.includes("connection error"));
	});

	await test("toPartialSuccessResult(): serverName derived from toolName prefix", () => {
		const gathered = makeGathered(["geowiz"], []);
		const result = toPartialSuccessResult(gathered);
		assert.strictEqual(result.succeeded[0].serverName, "geowiz");
	});

	// ---------------------------------------------------------------------------
	// toBundlePartialSuccessResult()
	// ---------------------------------------------------------------------------

	await test("toBundlePartialSuccessResult(): succeeded[] from bundle results where success:true", () => {
		const bundle = makeBundle(["geowiz", "econobot"], ["risk"]);
		const result = toBundlePartialSuccessResult(bundle);
		assert.strictEqual(result.succeeded.length, 2);
	});

	await test("toBundlePartialSuccessResult(): failed[] from bundle phase failures", () => {
		const bundle = makeBundle(["geowiz"], ["risk", "market"]);
		const result = toBundlePartialSuccessResult(bundle);
		assert.strictEqual(result.failed.length, 2);
		assert.ok(result.failed.some((f) => f.toolName === "risk.analyze"));
	});

	await test("toBundlePartialSuccessResult(): completeness correct", () => {
		const bundle = makeBundle(["geowiz"], ["risk"]);
		const result = toBundlePartialSuccessResult(bundle);
		assert.strictEqual(result.total, 2);
		assert.strictEqual(result.completeness, 50);
	});

	// ---------------------------------------------------------------------------
	// OutputShaper.shapeGathered()
	// ---------------------------------------------------------------------------

	const shaper = new OutputShaper();

	await test("shapeGathered() summary: one-line with counts and missing tools", () => {
		const gathered = makeGathered(["geowiz", "econobot"], ["risk"]);
		const text = shaper.shapeGathered(gathered, "summary");
		assert.ok(typeof text === "string" && text.length > 0, "Expected non-empty string");
		assert.ok(text.includes("2") && text.includes("3"), `Expected counts in: ${text}`);
		assert.ok(text.includes("risk"), `Expected missing tool name in: ${text}`);
	});

	await test("shapeGathered() standard: includes error type and recovery hint per failure", () => {
		const gathered = makeGathered(["geowiz"], ["risk"], true);
		const text = shaper.shapeGathered(gathered, "standard");
		assert.ok(text.includes("risk"), `Expected failed tool name in: ${text}`);
		assert.ok(
			text.toLowerCase().includes("retry") || text.toLowerCase().includes("retryable"),
			`Expected retry/retryable in: ${text}`,
		);
	});

	await test("shapeGathered() full: includes succeeded tool names too", () => {
		const gathered = makeGathered(["geowiz", "econobot"], ["risk"]);
		const text = shaper.shapeGathered(gathered, "full");
		assert.ok(text.includes("geowiz") || text.includes("econobot"), `Expected success tool in full output: ${text}`);
	});

	// ---------------------------------------------------------------------------
	// OutputShaper.shapeBundle()
	// ---------------------------------------------------------------------------

	await test("shapeBundle() summary: one-line with bundle name and counts", () => {
		const bundle = makeBundle(["geowiz", "econobot"], ["risk"]);
		const text = shaper.shapeBundle(bundle, "summary");
		assert.ok(typeof text === "string" && text.length > 0, "Expected non-empty string");
		assert.ok(text.includes("test-bundle"), `Expected bundle name in: ${text}`);
		assert.ok(text.includes("2") || text.includes("3"), `Expected counts in: ${text}`);
	});

	await test("shapeBundle() standard: includes phase breakdown and failure details", () => {
		const bundle = makeBundle(["geowiz"], ["risk"]);
		const text = shaper.shapeBundle(bundle, "standard");
		assert.ok(text.includes("Phase") || text.includes("phase"), `Expected phase info in: ${text}`);
		assert.ok(text.includes("risk"), `Expected failed tool name in: ${text}`);
	});

	// ---------------------------------------------------------------------------
	// Summary
	// ---------------------------------------------------------------------------

	console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
	if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
	console.error("Test runner error:", err);
	process.exit(1);
});
