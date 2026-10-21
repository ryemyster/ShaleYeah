/**
 * Infrastructure Server Domain Logic Tests — Issue #375
 *
 * Tests the deterministic math in each tool module. No LLM calls, no server process.
 */

import assert from "node:assert";
import { deriveComplianceAssessment } from "../src/tools/compliance.js";
import { deriveInfrastructureCostEstimate } from "../src/tools/cost-estimation.js";
import { deriveFacilitySizing } from "../src/tools/facilities.js";
import { derivePipelinePlan } from "../src/tools/pipeline.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
	try {
		fn();
		console.log(`  ✅ ${name}`);
		passed++;
	} catch (err) {
		console.error(`  ❌ ${name}: ${err instanceof Error ? err.message : err}`);
		failed++;
	}
}

// ── Pipeline ─────────────────────────────────────────────────────────────────

console.log("\n📐 Pipeline planning...");

test("gathering miles = ceil(wellCount × 1.2)", () => {
	const plan = derivePipelinePlan(10, 5000, "Reeves County, Texas");
	assert.strictEqual(plan.gatheringMiles, 12); // ceil(10 × 1.2)
});

test("transmission miles is fixed at 12", () => {
	const plan = derivePipelinePlan(5, 2000, "Reeves County, Texas");
	assert.strictEqual(plan.transmissionMiles, 12);
});

test("capacity = round(expectedProduction × 1.1)", () => {
	const plan = derivePipelinePlan(10, 5000, "Reeves County, Texas");
	assert.strictEqual(plan.capacityBopd, 5500); // round(5000 × 1.1)
});

test("Texas location → Low takeaway risk for small project", () => {
	const plan = derivePipelinePlan(5, 2000, "Reeves County, Texas");
	assert.strictEqual(plan.takeawayRisk, "Low");
});

test("remote location → High takeaway risk", () => {
	const plan = derivePipelinePlan(5, 2000, "Uinta Basin, Utah");
	assert.strictEqual(plan.takeawayRisk, "High");
});

test("large project in Texas → Medium takeaway risk", () => {
	const plan = derivePipelinePlan(25, 15000, "Midland Basin, Texas");
	assert.strictEqual(plan.takeawayRisk, "Medium");
});

test("remote location → higher pressure requirement", () => {
	const remote = derivePipelinePlan(5, 2000, "Uinta Basin, Utah");
	const local = derivePipelinePlan(5, 2000, "Reeves County, Texas");
	assert.ok(remote.pressureRequirementPsi > local.pressureRequirementPsi);
});

// ── Facilities ───────────────────────────────────────────────────────────────

console.log("\n🏭 Facility sizing...");

test("batteries = ceil(wellCount / 8)", () => {
	const sizing = deriveFacilitySizing(16, 8000);
	assert.strictEqual(sizing.batteries, 2); // ceil(16 / 8)
});

test("separators = ceil(wellCount / 4)", () => {
	const sizing = deriveFacilitySizing(16, 8000);
	assert.strictEqual(sizing.separators, 4); // ceil(16 / 4)
});

test("compressors = ceil(production / 5000)", () => {
	const sizing = deriveFacilitySizing(20, 10001);
	assert.strictEqual(sizing.compressors, 3); // ceil(10001 / 5000)
});

test("SWD wells = max(1, ceil(wellCount / 10))", () => {
	const single = deriveFacilitySizing(5, 2000);
	assert.strictEqual(single.saltWaterDisposalWells, 1);

	const multi = deriveFacilitySizing(25, 10000);
	assert.strictEqual(multi.saltWaterDisposalWells, 3); // ceil(25 / 10)
});

test("water treatment capacity = round(production × 3)", () => {
	const sizing = deriveFacilitySizing(10, 5000);
	assert.strictEqual(sizing.treatmentCapacityBwpd, 15000);
});

test("notes array is non-empty", () => {
	const sizing = deriveFacilitySizing(8, 4000);
	assert.ok(sizing.notes.length >= 3);
});

// ── Cost Estimation ───────────────────────────────────────────────────────────

console.log("\n💰 Cost estimation...");

test("pipeline cost = wellCount × $250,000", () => {
	const est = deriveInfrastructureCostEstimate(10, 2, 1, "Reeves County, Texas");
	assert.strictEqual(est.pipelineCost, 2_500_000);
});

test("facilities cost = wellCount × $180,000", () => {
	const est = deriveInfrastructureCostEstimate(10, 2, 1, "Reeves County, Texas");
	assert.strictEqual(est.facilitiesCost, 1_800_000);
});

test("compressor cost = count × $400,000", () => {
	const est = deriveInfrastructureCostEstimate(10, 3, 1, "Reeves County, Texas");
	assert.strictEqual(est.compressorCost, 1_200_000);
});

test("SWD cost = count × $1,200,000", () => {
	const est = deriveInfrastructureCostEstimate(10, 2, 2, "Reeves County, Texas");
	assert.strictEqual(est.swdCost, 2_400_000);
});

test("Texas location → 10% contingency", () => {
	const est = deriveInfrastructureCostEstimate(10, 2, 1, "Reeves County, Texas");
	assert.strictEqual(est.contingencyPct, 10);
});

test("remote location → 15% contingency", () => {
	const est = deriveInfrastructureCostEstimate(10, 2, 1, "Uinta Basin, Utah");
	assert.strictEqual(est.contingencyPct, 15);
});

test("totalCost includes contingency", () => {
	const est = deriveInfrastructureCostEstimate(10, 2, 1, "Reeves County, Texas");
	const subtotal = est.pipelineCost + est.facilitiesCost + est.compressorCost + est.swdCost;
	assert.strictEqual(est.totalCost, Math.round(subtotal * 1.1));
});

test("costPerWell = round(totalCost / wellCount)", () => {
	const est = deriveInfrastructureCostEstimate(10, 2, 1, "Reeves County, Texas");
	assert.strictEqual(est.costPerWell, Math.round(est.totalCost / 10));
});

// ── Compliance ───────────────────────────────────────────────────────────────

console.log("\n📋 Compliance assessment...");

test("always includes core permits (ROW, construction, air quality)", () => {
	const result = deriveComplianceAssessment(10, "Reeves County, Texas", []);
	assert.ok(result.requiredPermits.some((p) => p.includes("Right-of-Way")));
	assert.ok(result.requiredPermits.some((p) => p.includes("Construction")));
	assert.ok(result.requiredPermits.some((p) => p.includes("Air Quality")));
});

test("remote location → federal permits added + High risk", () => {
	const result = deriveComplianceAssessment(10, "Uinta Basin, Utah", []);
	assert.strictEqual(result.complianceRisk, "High");
	assert.ok(result.requiredPermits.some((p) => p.includes("Federal")));
	assert.ok(result.requiredPermits.some((p) => p.includes("NEPA")));
});

test("large Texas project → Medium risk + SWPPP", () => {
	const result = deriveComplianceAssessment(25, "Midland Basin, Texas", []);
	assert.strictEqual(result.complianceRisk, "Medium");
	assert.ok(result.requiredPermits.some((p) => p.includes("SWPPP")));
});

test("small Texas project → Low risk + 6-month timeline", () => {
	const result = deriveComplianceAssessment(5, "Reeves County, Texas", []);
	assert.strictEqual(result.complianceRisk, "Low");
	assert.strictEqual(result.approvalTimelineMonths, 6);
});

test("remote location → 12-month approval timeline", () => {
	const result = deriveComplianceAssessment(10, "Uinta Basin, Utah", []);
	assert.strictEqual(result.approvalTimelineMonths, 12);
});

test("passed environmental constraints appear in result", () => {
	const constraints = ["endangered species habitat within 2 miles"];
	const result = deriveComplianceAssessment(10, "Reeves County, Texas", constraints);
	assert.ok(result.environmentalRisks.some((r) => r.includes("endangered")));
});

test("criticalPath is a non-empty string", () => {
	const result = deriveComplianceAssessment(10, "Reeves County, Texas", []);
	assert.ok(result.criticalPath.length > 0);
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log("\n══════════════════════════════════════════════");
console.log(`Infrastructure Server Domain Tests: ${passed} passed, ${failed} failed`);
console.log("══════════════════════════════════════════════");

if (failed > 0) process.exit(1);
