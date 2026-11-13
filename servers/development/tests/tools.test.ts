/**
 * Development Server — domain logic unit tests.
 * Tests deriveDefaultDevelopmentOutlook, deriveDevelopmentPhases, deriveProgressReport.
 * No API key required.
 */

import assert from "node:assert";
import { deriveProgressReport } from "../src/tools/monitoring.js";
import { deriveDevelopmentPhases } from "../src/tools/phases.js";
import { deriveDefaultDevelopmentOutlook } from "../src/tools/planning.js";

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

// ── deriveDefaultDevelopmentOutlook ──────────────────────────────────────────

console.log("\n=== DevelopmentOutlook ===\n");

test("small project → Low schedule risk", () => {
	const r = deriveDefaultDevelopmentOutlook(5, 20_000_000, []);
	assert.strictEqual(r.scheduleRisk, "Low");
});

test("large project (>20 wells) → Medium schedule risk", () => {
	const r = deriveDefaultDevelopmentOutlook(25, 100_000_000, []);
	assert.strictEqual(r.scheduleRisk, "Medium");
});

test("adequate budget → Low budget risk", () => {
	const r = deriveDefaultDevelopmentOutlook(5, 20_000_000, []);
	assert.strictEqual(r.budgetRisk, "Low");
});

test("tight budget (<$2M/well) → High budget risk", () => {
	const r = deriveDefaultDevelopmentOutlook(10, 15_000_000, []);
	assert.strictEqual(r.budgetRisk, "High");
});

test("constraints with adequate budget → Medium budget risk", () => {
	const r = deriveDefaultDevelopmentOutlook(5, 30_000_000, ["H2S environment"]);
	assert.strictEqual(r.budgetRisk, "Medium");
});

test("small project → single-phase recommendation", () => {
	const r = deriveDefaultDevelopmentOutlook(5, 20_000_000, []);
	assert.ok(r.recommendation.includes("Single-phase"));
});

test("large project → phased recommendation", () => {
	const r = deriveDefaultDevelopmentOutlook(25, 100_000_000, []);
	assert.ok(r.recommendation.includes("Phased"));
});

test("tight budget → budget warning in recommendation", () => {
	const r = deriveDefaultDevelopmentOutlook(10, 15_000_000, []);
	assert.ok(r.recommendation.includes("Budget is tight"));
});

test("criticalPath is non-empty", () => {
	const r = deriveDefaultDevelopmentOutlook(5, 20_000_000, []);
	assert.ok(r.criticalPath.length > 0);
});

test("large project → rig mobilization in critical path", () => {
	const r = deriveDefaultDevelopmentOutlook(25, 100_000_000, []);
	assert.ok(r.criticalPath.some((item) => item.includes("rig mobilization")));
});

test("different inputs → different outputs", () => {
	const a = deriveDefaultDevelopmentOutlook(3, 50_000_000, []);
	const b = deriveDefaultDevelopmentOutlook(30, 10_000_000, ["permafrost"]);
	assert.ok(a.scheduleRisk !== b.scheduleRisk || a.budgetRisk !== b.budgetRisk);
});

// ── deriveDevelopmentPhases ───────────────────────────────────────────────────

console.log("\n=== DevelopmentPhases ===\n");

test("phases is non-empty array", () => {
	const r = deriveDevelopmentPhases(10, 20_000_000);
	assert.ok(r.phases.length > 0);
});

test("small project (≤10 wells) → 1 phase", () => {
	const r = deriveDevelopmentPhases(8, 20_000_000);
	assert.strictEqual(r.totalPhases, 1);
});

test("medium project (11-20 wells) → 2 phases", () => {
	const r = deriveDevelopmentPhases(20, 40_000_000);
	assert.strictEqual(r.totalPhases, 2);
});

test("large project (>20 wells) → ≥3 phases", () => {
	const r = deriveDevelopmentPhases(30, 60_000_000);
	assert.ok(r.totalPhases >= 3);
});

test("capped at 4 phases maximum", () => {
	const r = deriveDevelopmentPhases(100, 200_000_000);
	assert.ok(r.totalPhases <= 4);
});

test("strategy is 'Single phase' for ≤20 wells", () => {
	const r = deriveDevelopmentPhases(10, 20_000_000);
	assert.strictEqual(r.strategy, "Single phase");
});

test("strategy is 'Phased development' for >20 wells", () => {
	const r = deriveDevelopmentPhases(25, 50_000_000);
	assert.strictEqual(r.strategy, "Phased development");
});

test("each phase has keyMilestones array", () => {
	const r = deriveDevelopmentPhases(15, 30_000_000);
	assert.ok(r.phases.every((p) => Array.isArray(p.keyMilestones) && p.keyMilestones.length > 0));
});

test("totalDuration is a non-empty string", () => {
	const r = deriveDevelopmentPhases(10, 20_000_000);
	assert.ok(typeof r.totalDuration === "string" && r.totalDuration.length > 0);
});

test("total wells across phases equals wellCount", () => {
	const wellCount = 22;
	const r = deriveDevelopmentPhases(wellCount, 44_000_000);
	const total = r.phases.reduce((sum, p) => sum + p.wells, 0);
	assert.strictEqual(total, wellCount);
});

// ── deriveProgressReport ─────────────────────────────────────────────────────

console.log("\n=== DevelopmentProgress ===\n");

test("project id is preserved in output", () => {
	const r = deriveProgressReport("PROJ-001", "monthly");
	assert.strictEqual(r.project, "PROJ-001");
});

test("period is preserved in output", () => {
	const r = deriveProgressReport("PROJ-001", "weekly");
	assert.strictEqual(r.period, "weekly");
});

test("schedule has status string", () => {
	const r = deriveProgressReport("PROJ-001", "monthly");
	assert.ok(typeof r.schedule.status === "string");
});

test("budget has variancePct number", () => {
	const r = deriveProgressReport("PROJ-001", "monthly");
	assert.ok(typeof r.budget.variancePct === "number");
});

test("safety incidents is a number", () => {
	const r = deriveProgressReport("PROJ-001", "monthly");
	assert.ok(typeof r.safety.incidents === "number");
});

test("quality wellSuccessPct is a number between 0 and 100", () => {
	const r = deriveProgressReport("PROJ-001", "monthly");
	assert.ok(r.quality.wellSuccessPct >= 0 && r.quality.wellSuccessPct <= 100);
});

test("recommendations is non-empty array", () => {
	const r = deriveProgressReport("PROJ-001", "monthly");
	assert.ok(r.recommendations.length > 0);
});

// ── Summary ────────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
