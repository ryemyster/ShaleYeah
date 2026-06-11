/**
 * Legal Server — domain logic unit tests.
 * Tests real logic in deriveRegulatoryAssessment, deriveContractReview, deriveComplianceRequirements.
 * No API key required.
 */

import assert from "node:assert";
import { deriveRegulatoryAssessment } from "../src/tools/regulatory.js";
import { deriveContractReview } from "../src/tools/contract.js";
import { deriveComplianceRequirements } from "../src/tools/compliance.js";

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

// ── deriveRegulatoryAssessment ─────────────────────────────────────────────────

console.log("\n=== RegulatoryAssessment ===\n");

test("California → High risk (high-risk jurisdiction)", () => {
	const r = deriveRegulatoryAssessment("California", "production");
	assert.strictEqual(r.regulatoryRisk, "High");
});

test("exploration project → High risk regardless of jurisdiction", () => {
	const r = deriveRegulatoryAssessment("Texas", "exploration");
	assert.strictEqual(r.regulatoryRisk, "High");
});

test("Texas development → Medium risk", () => {
	const r = deriveRegulatoryAssessment("Texas", "development");
	assert.strictEqual(r.regulatoryRisk, "Medium");
});

test("Texas production → Low risk", () => {
	const r = deriveRegulatoryAssessment("Texas", "production");
	assert.strictEqual(r.regulatoryRisk, "Low");
});

test("High risk → 12 month approval timeline", () => {
	const r = deriveRegulatoryAssessment("California", "production");
	assert.strictEqual(r.approvalTimelineMonths, 12);
});

test("Medium risk → 6 month approval timeline", () => {
	const r = deriveRegulatoryAssessment("Texas", "development");
	assert.strictEqual(r.approvalTimelineMonths, 6);
});

test("Low risk → 3 month approval timeline", () => {
	const r = deriveRegulatoryAssessment("Texas", "production");
	assert.strictEqual(r.approvalTimelineMonths, 3);
});

test("requiredPermits is non-empty", () => {
	const r = deriveRegulatoryAssessment("Texas", "production");
	assert.ok(r.requiredPermits.length > 0);
});

test("exploration adds Exploration License permit", () => {
	const r = deriveRegulatoryAssessment("Texas", "exploration");
	assert.ok(r.requiredPermits.some((p) => p.includes("Exploration")));
});

test("California adds state-specific filing", () => {
	const r = deriveRegulatoryAssessment("California", "production");
	assert.ok(r.requiredPermits.some((p) => p.toLowerCase().includes("state")));
});

test("keyRisks is non-empty", () => {
	const r = deriveRegulatoryAssessment("Texas", "production");
	assert.ok(r.keyRisks.length > 0);
});

test("recommendations is non-empty", () => {
	const r = deriveRegulatoryAssessment("Texas", "production");
	assert.ok(r.recommendations.length > 0);
});

// ── deriveContractReview ────────────────────────────────────────────────────────

console.log("\n=== ContractReview ===\n");

test("conservative risk profile → Low overall risk", () => {
	const r = deriveContractReview("lease", [], "conservative");
	assert.strictEqual(r.overallRisk, "Low");
});

test("aggressive risk profile → High overall risk", () => {
	const r = deriveContractReview("lease", [], "aggressive");
	assert.strictEqual(r.overallRisk, "High");
});

test("JOA with moderate profile → High overall risk", () => {
	const r = deriveContractReview("JOA", [], "moderate");
	assert.strictEqual(r.overallRisk, "High");
});

test("farmout with moderate profile → High overall risk", () => {
	const r = deriveContractReview("farmout", [], "moderate");
	assert.strictEqual(r.overallRisk, "High");
});

test("service contract with moderate profile → Medium overall risk", () => {
	const r = deriveContractReview("service", [], "moderate");
	assert.strictEqual(r.overallRisk, "Medium");
});

test("royalty term classified as financial", () => {
	const r = deriveContractReview("lease", ["royalty clause 20%"], "moderate");
	assert.ok(r.financialTerms.some((t) => t.includes("royalty")));
});

test("drilling term classified as operational", () => {
	const r = deriveContractReview("JOA", ["drilling obligations by operator"], "moderate");
	assert.ok(r.operationalTerms.some((t) => t.includes("drilling")));
});

test("indemnity term classified as legal", () => {
	const r = deriveContractReview("lease", ["mutual indemnity clause"], "moderate");
	assert.ok(r.legalTerms.some((t) => t.includes("indemnity")));
});

test("recommendations is non-empty", () => {
	const r = deriveContractReview("lease", [], "moderate");
	assert.ok(r.recommendations.length > 0);
});

// ── deriveComplianceRequirements ────────────────────────────────────────────────

console.log("\n=== ComplianceRequirements ===\n");

test("California → High compliance risk", () => {
	const r = deriveComplianceRequirements("California", "production", 3);
	assert.strictEqual(r.complianceRisk, "High");
});

test("exploration → High compliance risk regardless of jurisdiction", () => {
	const r = deriveComplianceRequirements("Texas", "exploration", 1);
	assert.strictEqual(r.complianceRisk, "High");
});

test("Texas production, 1 asset → Low compliance risk", () => {
	const r = deriveComplianceRequirements("Texas", "production", 1);
	assert.strictEqual(r.complianceRisk, "Low");
});

test("Texas development → Medium compliance risk", () => {
	const r = deriveComplianceRequirements("Texas", "development", 2);
	assert.strictEqual(r.complianceRisk, "Medium");
});

test("High risk → High cost estimate", () => {
	const r = deriveComplianceRequirements("California", "production", 1);
	assert.ok(r.estimatedComplianceCost.includes("High"));
});

test("Low risk → Low cost estimate", () => {
	const r = deriveComplianceRequirements("Texas", "production", 1);
	assert.ok(r.estimatedComplianceCost.includes("Low"));
});

test("environmentalRequirements includes NEPA review", () => {
	const r = deriveComplianceRequirements("Texas", "production", 1);
	assert.ok(r.environmentalRequirements.some((req) => req.includes("NEPA")));
});

test("safetyRequirements includes OSHA", () => {
	const r = deriveComplianceRequirements("Texas", "production", 1);
	assert.ok(r.safetyRequirements.some((req) => req.includes("OSHA")));
});

test("taxObligations includes severance taxes", () => {
	const r = deriveComplianceRequirements("Texas", "production", 1);
	assert.ok(r.taxObligations.some((t) => t.toLowerCase().includes("severance")));
});

test("California adds air quality monitoring", () => {
	const r = deriveComplianceRequirements("California", "production", 1);
	assert.ok(r.environmentalRequirements.some((req) => req.toLowerCase().includes("air quality")));
});

test("exploration adds baseline environmental survey", () => {
	const r = deriveComplianceRequirements("Texas", "exploration", 1);
	assert.ok(r.environmentalRequirements.some((req) => req.toLowerCase().includes("baseline")));
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
