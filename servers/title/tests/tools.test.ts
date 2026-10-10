import assert from "node:assert";
import { calculateTotalBurden, deriveBurdenAssessment } from "../src/tools/burden-check.js";
import { assessChainRisk, deriveChainOfTitle } from "../src/tools/chain-of-title.js";
import { deriveLeaseAnalysis, parseLeaseTermMonths } from "../src/tools/lease-analysis.js";
import { calculateNRI, deriveOwnershipBreakdown } from "../src/tools/ownership.js";

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
			console.log(`  ✗ ${name}\n    ${err instanceof Error ? err.message : String(err)}`);
			failed++;
		});
}

// ── ownership ─────────────────────────────────────────────────────────────────

await test("calculateNRI: standard Permian 25% royalty, no ORRI", () => {
	const nri = calculateNRI(1.0, 0.25, 0);
	assert.strictEqual(nri, 0.75);
});

await test("calculateNRI: fractional WI with ORRI reduces NRI correctly", () => {
	const nri = calculateNRI(0.75, 0.25, 0.02);
	// 0.75 × (1 − 0.25 − 0.02) = 0.75 × 0.73 = 0.5475
	assert.ok(Math.abs(nri - 0.5475) < 1e-10, `expected 0.5475, got ${nri}`);
});

await test("deriveOwnershipBreakdown: Permian county uses 25% royalty", () => {
	const result = deriveOwnershipBreakdown("Section 12 Block A", "Reeves");
	assert.strictEqual(result.royaltyRate, 0.25);
	assert.strictEqual(result.workingInterest, 1.0);
	// NRI must equal WI × (1 − royalty − ORRI)
	const expectedNRI = calculateNRI(result.workingInterest, result.royaltyRate, result.orriRate);
	assert.ok(Math.abs(result.netRevenueInterest - expectedNRI) < 1e-10);
});

await test("deriveOwnershipBreakdown: multi-parcel description reduces WI", () => {
	const multi = deriveOwnershipBreakdown("Section 1, Section 2, Section 3", "Midland");
	const single = deriveOwnershipBreakdown("Section 12 Block A", "Midland");
	assert.ok(multi.workingInterest < single.workingInterest);
});

await test("deriveOwnershipBreakdown: ORRI detected in description", () => {
	const result = deriveOwnershipBreakdown("Section 5 with ORRI override", "Lea");
	assert.ok(result.orriRate > 0);
});

// ── lease-analysis ────────────────────────────────────────────────────────────

await test("parseLeaseTermMonths: year string parsed correctly", () => {
	assert.strictEqual(parseLeaseTermMonths("3 years"), 36);
	assert.strictEqual(parseLeaseTermMonths("2 year"), 24);
	assert.strictEqual(parseLeaseTermMonths("5 Years"), 60);
});

await test("parseLeaseTermMonths: month string parsed correctly", () => {
	assert.strictEqual(parseLeaseTermMonths("18 months"), 18);
	assert.strictEqual(parseLeaseTermMonths("24 month"), 24);
});

await test("parseLeaseTermMonths: unparseable defaults to 36", () => {
	assert.strictEqual(parseLeaseTermMonths("unknown"), 36);
	assert.strictEqual(parseLeaseTermMonths(""), 36);
});

await test("deriveLeaseAnalysis: <24 months is high expiry risk", () => {
	const result = deriveLeaseAnalysis("18 months", "Reeves", "20 years");
	assert.strictEqual(result.expiryRisk, "high");
	assert.strictEqual(result.primaryTermMonths, 18);
});

await test("deriveLeaseAnalysis: >36 months is low expiry risk", () => {
	const result = deriveLeaseAnalysis("5 years", "Midland", "20 years");
	assert.strictEqual(result.expiryRisk, "low");
	assert.strictEqual(result.primaryTermMonths, 60);
});

await test("deriveLeaseAnalysis: notes include county name", () => {
	const result = deriveLeaseAnalysis("3 years", "Weld", "20 years");
	assert.ok(result.notes.includes("Weld"));
});

// ── burden-check ──────────────────────────────────────────────────────────────

await test("calculateTotalBurden: royalty + ORRI sums correctly", () => {
	const burden = calculateTotalBurden(0.25, 0.02);
	assert.ok(Math.abs(burden - 0.27) < 1e-10);
});

await test("calculateTotalBurden: no ORRI returns just royalty", () => {
	const burden = calculateTotalBurden(0.1875, 0);
	assert.strictEqual(burden, 0.1875);
});

await test("deriveBurdenAssessment: ORRI keyword triggers nonzero orriRate", () => {
	const result = deriveBurdenAssessment("Section 5 with ORRI", "Reeves");
	assert.ok(result.orriRate > 0);
	assert.ok(result.totalBurdenFraction > 0.25);
});

await test("deriveBurdenAssessment: simple Permian property is low risk", () => {
	const result = deriveBurdenAssessment("Section 12 Block A", "Midland");
	assert.strictEqual(result.riskLevel, "low");
	assert.strictEqual(result.orriRate, 0);
});

await test("deriveBurdenAssessment: multi-parcel increases encumbrance count", () => {
	const multi = deriveBurdenAssessment("Section 1, Section 2", "Reeves");
	const single = deriveBurdenAssessment("Section 12", "Reeves");
	assert.ok(multi.encumbranceCount >= single.encumbranceCount);
});

// ── chain-of-title ────────────────────────────────────────────────────────────

await test("assessChainRisk: zero gaps = low risk regardless of exam period", () => {
	assert.strictEqual(assessChainRisk(20, 0), "low");
	assert.strictEqual(assessChainRisk(50, 0), "low");
});

await test("assessChainRisk: 1–2 gaps = medium risk", () => {
	assert.strictEqual(assessChainRisk(20, 1), "medium");
	assert.strictEqual(assessChainRisk(40, 2), "medium");
});

await test("assessChainRisk: >2 gaps = high risk", () => {
	assert.strictEqual(assessChainRisk(20, 3), "high");
});

await test("deriveChainOfTitle: simple property has continuous chain", () => {
	const result = deriveChainOfTitle("20 years", "Midland", "Section 12 Block A");
	assert.strictEqual(result.gapsFound, 0);
	assert.strictEqual(result.continuousChain, true);
	assert.deepStrictEqual(result.curative, []);
});

await test("deriveChainOfTitle: complex/long exam produces gap and curative", () => {
	const result = deriveChainOfTitle("40 years", "Reeves", "Section 1, Section 2, Section 3");
	assert.ok(result.gapsFound > 0);
	assert.strictEqual(result.continuousChain, false);
	assert.ok(result.curative.length > 0);
	assert.ok(result.curative[0].toLowerCase().includes("reeves"));
});

await test("deriveChainOfTitle: oldestRecordYear is approximately currentYear - examYears", () => {
	const currentYear = new Date().getFullYear();
	const result = deriveChainOfTitle("20 years", "Midland", "Section 5");
	assert.strictEqual(result.oldestRecordYear, currentYear - 20);
});

console.log(`\n  Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
