/**
 * QA Server — domain logic unit tests.
 * Tests deriveDefaultQAResult and deriveQualityReport.
 * No API key required.
 */

import assert from "node:assert";
import { deriveQualityReport } from "../src/tools/reporting.js";
import { deriveDefaultQAResult } from "../src/tools/validation.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
	try {
		fn();
		console.log(`  ✅ ${name}`);
		passed++;
	} catch (err) {
		console.error(`  ❌ ${name}: ${err instanceof Error ? err.message : String(err)}`);
		failed++;
	}
}

// ── deriveDefaultQAResult ─────────────────────────────────────────────────────

console.log("\n=== QAValidationResult ===\n");

test("standard threshold (0.95) → PASS status", () => {
	const r = deriveDefaultQAResult(["geowiz"], 0.95);
	assert.strictEqual(r.overallStatus, "PASS");
});

test("tight threshold (>0.97) → WARNING status", () => {
	const r = deriveDefaultQAResult(["geowiz"], 0.99);
	assert.strictEqual(r.overallStatus, "WARNING");
});

test("tight threshold at exactly 0.97 → PASS (boundary)", () => {
	const r = deriveDefaultQAResult(["geowiz"], 0.97);
	assert.strictEqual(r.overallStatus, "PASS");
});

test("tight threshold → issues array is non-empty", () => {
	const r = deriveDefaultQAResult(["geowiz", "econobot"], 0.98);
	assert.ok(r.issues.length > 0, "Tight threshold must produce at least one issue");
});

test("standard threshold → issues array is empty", () => {
	const r = deriveDefaultQAResult(["geowiz"], 0.95);
	assert.strictEqual(r.issues.length, 0);
});

test("tight threshold → issue message references the threshold value", () => {
	const r = deriveDefaultQAResult(["geowiz"], 0.99);
	assert.ok(r.issues[0].includes("99"), `Expected '99' in issue, got: ${r.issues[0]}`);
});

test("≤3 targets → standard recommendation", () => {
	const r = deriveDefaultQAResult(["geowiz", "econobot"], 0.95);
	assert.ok(r.recommendation.includes("Standard"), `Expected 'Standard' in recommendation`);
});

test(">3 targets → per-target recommendation", () => {
	const r = deriveDefaultQAResult(["geowiz", "econobot", "decision", "legal"], 0.95);
	assert.ok(r.recommendation.includes("4"), `Expected target count in recommendation`);
});

test("recommendation is a non-empty string", () => {
	const r = deriveDefaultQAResult(["geowiz"], 0.95);
	assert.ok(typeof r.recommendation === "string" && r.recommendation.length > 0);
});

test("no hardcoded legacy constants in output", () => {
	const r = deriveDefaultQAResult(["geowiz", "econobot"], 0.95);
	const s = JSON.stringify(r);
	assert.ok(!s.includes("145ms"), "Must not contain legacy '145ms'");
	assert.ok(!s.includes("420 requests"), "Must not contain legacy '420 requests'");
	assert.ok(!s.includes('"score": 95'), "Must not contain legacy fixed score");
});

test("different inputs → different outputs", () => {
	const a = deriveDefaultQAResult(["geowiz"], 0.95);
	const b = deriveDefaultQAResult(["geowiz", "econobot", "decision", "legal", "market"], 0.99);
	assert.ok(a.overallStatus !== b.overallStatus || a.recommendation !== b.recommendation);
});

// ── deriveQualityReport ───────────────────────────────────────────────────────

console.log("\n=== QAReport ===\n");

test("report type is preserved", () => {
	const r = deriveQualityReport("summary", "current", ["accuracy"]);
	assert.strictEqual(r.report.type, "summary");
});

test("period is preserved", () => {
	const r = deriveQualityReport("detailed", "Q2-2026", ["accuracy"]);
	assert.strictEqual(r.report.period, "Q2-2026");
});

test("generated is an ISO timestamp string", () => {
	const r = deriveQualityReport("summary", "current", ["accuracy"]);
	assert.ok(typeof r.report.generated === "string" && r.report.generated.includes("T"));
});

test("dataSource is 'llm-validation'", () => {
	const r = deriveQualityReport("summary", "current", ["accuracy"]);
	assert.strictEqual(r.dataSource, "llm-validation");
});

test("accuracy metric present when requested", () => {
	const r = deriveQualityReport("summary", "current", ["accuracy"]);
	assert.ok(r.metrics.accuracy !== undefined);
});

test("performance metric present when requested", () => {
	const r = deriveQualityReport("summary", "current", ["performance"]);
	assert.ok(r.metrics.performance !== undefined);
});

test("reliability metric present when requested", () => {
	const r = deriveQualityReport("summary", "current", ["reliability"]);
	assert.ok(r.metrics.reliability !== undefined);
});

test("metric absent when not requested", () => {
	const r = deriveQualityReport("summary", "current", ["accuracy"]);
	assert.strictEqual(r.metrics.performance, undefined);
	assert.strictEqual(r.metrics.reliability, undefined);
});

test("accuracy metric values are N/A (no live telemetry)", () => {
	const r = deriveQualityReport("summary", "current", ["accuracy"]);
	assert.ok(r.metrics.accuracy!.current.includes("N/A"));
});

test("compliance status references LLM assessment", () => {
	const r = deriveQualityReport("summary", "current", []);
	assert.ok(r.compliance.status.includes("LLM-assessed"));
});

test("compliance gaps is an array", () => {
	const r = deriveQualityReport("summary", "current", []);
	assert.ok(Array.isArray(r.compliance.gaps));
});

test("recommendations is a non-empty array", () => {
	const r = deriveQualityReport("summary", "current", ["accuracy"]);
	assert.ok(r.recommendations.length > 0);
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
