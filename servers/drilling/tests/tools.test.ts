/**
 * Drilling Server — domain logic unit tests.
 * Tests real math in deriveDrillingProgram, deriveWellCostBreakdown, deriveDrillingRiskProfile.
 * No API key required.
 */

import assert from "node:assert";
import { deriveWellCostBreakdown } from "../src/tools/costs.js";
import { deriveDrillingProgram } from "../src/tools/program.js";
import { deriveDrillingRiskProfile } from "../src/tools/risks.js";

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

// ── deriveDrillingProgram ─────────────────────────────────────────────────────

console.log("\n=== DrillingProgram ===\n");

test("shallow vertical → Low risk", () => {
	const p = deriveDrillingProgram("vertical", 5000, "sandstone");
	assert.strictEqual(p.programRisk, "Low");
});

test("deep vertical → Medium risk (deep but not horizontal)", () => {
	const p = deriveDrillingProgram("vertical", 14000, "granite");
	assert.strictEqual(p.programRisk, "Medium");
});

test("shallow horizontal → Medium risk (horizontal but not deep)", () => {
	const p = deriveDrillingProgram("horizontal", 8000, "shale");
	assert.strictEqual(p.programRisk, "Medium");
});

test("deep horizontal → High risk", () => {
	const p = deriveDrillingProgram("horizontal", 14000, "wolfcamp");
	assert.strictEqual(p.programRisk, "High");
});

test("estimated days: horizontal = depth / 400", () => {
	const p = deriveDrillingProgram("horizontal", 8000, "shale");
	assert.strictEqual(p.estimatedDays, 20); // ceil(8000/400)
});

test("estimated days: vertical = depth / 600", () => {
	const p = deriveDrillingProgram("vertical", 6000, "limestone");
	assert.strictEqual(p.estimatedDays, 10); // ceil(6000/600)
});

test("horizontal → multi-stage fracturing completion", () => {
	const p = deriveDrillingProgram("horizontal", 8000, "shale");
	assert.ok(p.completionType.toLowerCase().includes("frac"));
});

test("vertical → conventional completion", () => {
	const p = deriveDrillingProgram("vertical", 5000, "sandstone");
	assert.ok(p.completionType.toLowerCase().includes("conventional"));
});

test("casing program has 3 strings", () => {
	const p = deriveDrillingProgram("vertical", 5000, "sandstone");
	assert.strictEqual(p.casingProgram.length, 3);
});

test("mud program mentions formation name", () => {
	const p = deriveDrillingProgram("vertical", 5000, "sandstone");
	assert.ok(p.mudProgram.includes("sandstone"));
});

test("keyConsiderations is non-empty", () => {
	const p = deriveDrillingProgram("vertical", 5000, "sandstone");
	assert.ok(p.keyConsiderations.length > 0);
});

test("horizontal → torque consideration in keyConsiderations", () => {
	const p = deriveDrillingProgram("horizontal", 8000, "shale");
	assert.ok(p.keyConsiderations.some((c) => c.includes("torque")));
});

test("deep → pore pressure in keyConsiderations", () => {
	const p = deriveDrillingProgram("vertical", 14000, "granite");
	assert.ok(p.keyConsiderations.some((c) => c.includes("pore pressure")));
});

// ── deriveWellCostBreakdown ───────────────────────────────────────────────────

console.log("\n=== WellCostBreakdown ===\n");

test("horizontal drilling cost = depth × $180/ft", () => {
	const c = deriveWellCostBreakdown("horizontal", 10000);
	assert.strictEqual(c.drillingCost, 10000 * 180);
});

test("directional drilling cost = depth × $140/ft", () => {
	const c = deriveWellCostBreakdown("directional", 10000);
	assert.strictEqual(c.drillingCost, 10000 * 140);
});

test("vertical drilling cost = depth × $120/ft", () => {
	const c = deriveWellCostBreakdown("vertical", 10000);
	assert.strictEqual(c.drillingCost, 10000 * 120);
});

test("completion cost = 60% of drilling cost", () => {
	const c = deriveWellCostBreakdown("vertical", 10000);
	assert.strictEqual(c.completionCost, Math.round(c.drillingCost * 0.6));
});

test("facilities cost = 20% of drilling cost", () => {
	const c = deriveWellCostBreakdown("vertical", 10000);
	assert.strictEqual(c.facilitiesCost, Math.round(c.drillingCost * 0.2));
});

test("horizontal costs more than vertical at same depth", () => {
	const h = deriveWellCostBreakdown("horizontal", 10000);
	const v = deriveWellCostBreakdown("vertical", 10000);
	assert.ok(h.totalCost > v.totalCost);
});

test("costPerFoot matches well type rate", () => {
	const c = deriveWellCostBreakdown("horizontal", 10000);
	assert.strictEqual(c.costPerFoot, 180);
});

// ── deriveDrillingRiskProfile ─────────────────────────────────────────────────

console.log("\n=== DrillingRiskProfile ===\n");

test("shale formation → geological Medium", () => {
	const r = deriveDrillingRiskProfile("vertical", 5000, "wolfcamp shale", []);
	assert.strictEqual(r.geologicalRisk, "Medium");
});

test("sandstone formation → geological Low", () => {
	const r = deriveDrillingRiskProfile("vertical", 5000, "sandstone", []);
	assert.strictEqual(r.geologicalRisk, "Low");
});

test("deep horizontal → operational High", () => {
	const r = deriveDrillingRiskProfile("horizontal", 14000, "sandstone", []);
	assert.strictEqual(r.operationalRisk, "High");
});

test("shallow vertical → operational Low", () => {
	const r = deriveDrillingRiskProfile("vertical", 5000, "sandstone", []);
	assert.strictEqual(r.operationalRisk, "Low");
});

test("environmental constraints present → environmental Medium", () => {
	const r = deriveDrillingRiskProfile("vertical", 5000, "sandstone", ["wetlands within 500ft"]);
	assert.strictEqual(r.environmentalRisk, "Medium");
});

test("no constraints → environmental Low", () => {
	const r = deriveDrillingRiskProfile("vertical", 5000, "sandstone", []);
	assert.strictEqual(r.environmentalRisk, "Low");
});

test("overallRisk is highest of the three sub-risks", () => {
	const r = deriveDrillingRiskProfile("horizontal", 14000, "shale", ["wetlands"]);
	// operational=High, geological=Medium, environmental=Medium → overall=High
	assert.strictEqual(r.overallRisk, "High");
});

test("mitigations is non-empty", () => {
	const r = deriveDrillingRiskProfile("vertical", 5000, "sandstone", []);
	assert.ok(r.mitigations.length > 0);
});

test("horizontal well → torque mitigation included", () => {
	const r = deriveDrillingRiskProfile("horizontal", 8000, "sandstone", []);
	assert.ok(r.mitigations.some((m) => m.toLowerCase().includes("torque")));
});

test("environmental constraints → compliance mitigation included", () => {
	const r = deriveDrillingRiskProfile("vertical", 5000, "sandstone", ["wetlands"]);
	assert.ok(r.mitigations.some((m) => m.toLowerCase().includes("compliance")));
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
