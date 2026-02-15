/**
 * Kernel Output Shaping Tests — Wave 2
 *
 * Tests for progressive detail levels and response shaping.
 */

import { OutputShaper } from "../src/kernel/middleware/output.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
	if (condition) {
		console.log(`  ✅ ${message}`);
		passed++;
	} else {
		console.error(`  ❌ ${message}`);
		failed++;
	}
}

console.log("🧪 Starting Kernel Output Shaping Tests (Wave 2)\n");

const shaper = new OutputShaper();

// ==========================================
// Test data: realistic mock analysis results
// ==========================================

const geoData = {
	geological: {
		formationQuality: {
			reservoirQuality: "good",
			porosityAssessment: "Good porosity for completion",
			permeabilityAssessment: "Moderate permeability",
			hydrocarbonPotential: "medium",
			completionEffectiveness: "Standard completion recommended",
		},
		drillingRecommendations: {
			optimalLandingZones: ["Wolfcamp A", "Wolfcamp B"],
			lateralLengthRecommendation: "7500 ft lateral",
			completionStrategy: "Standard multi-stage frac",
			drillingRisks: ["Standard completion risk"],
		},
		investmentPerspective: {
			geologicalConfidence: 87,
			developmentPotential: "Good development potential",
			keyRisks: ["Commodity price risk"],
			comparableAnalogues: ["Nearby wells"],
			recommendedAction: "drill",
		},
		professionalSummary: "Good geological prospect",
		confidenceLevel: 87,
	},
	confidence: 87,
};

const econData = {
	economic: {
		npv: 3500000,
		irr: 28.5,
		roi: 1.8,
		paybackPeriod: 10,
		paybackMonths: 10,
		assumptions: {
			oilPrice: 78,
			gasPrice: 3.5,
			drillingCost: 9000000,
			completionCost: 4500000,
		},
		sensitivityAnalysis: [{ variable: "oil_price", scenarios: { low: 1500000, base: 3500000, high: 5000000 } }],
		confidence: 82,
	},
	confidence: 82,
};

const curveData = {
	curve: {
		initialRate: { oil: 1100, gas: 2200, water: 80 },
		declineRate: 10.5,
		bFactor: 0.72,
		eur: { oil: 520000, gas: 1100000 },
		typeCurve: "Tier 1 horizontal well",
		confidence: 90,
		qualityGrade: "Good",
	},
	confidence: 90,
};

const riskData = {
	risk: {
		overallRiskScore: 45,
		overallRisk: 45,
		riskFactors: [
			{
				category: "Technical",
				description: "Standard drilling risk",
				probability: 0.3,
				impact: 0.4,
				mitigationStrategies: ["Use experienced drilling contractor"],
			},
		],
		confidence: 78,
	},
	confidence: 78,
};

const minimalData = {
	confidence: 85,
};

const baseOpts = {
	server: "test-server",
	persona: "Test Persona",
	executionTimeMs: 42,
};

// ==========================================
// Test: shape() produces valid AgentOSResponse
// ==========================================

console.log("📦 Testing AgentOSResponse structure...");
const resp = shaper.shape(geoData, { ...baseOpts, detailLevel: "standard" });
assert(resp.success === true, "Response success is true");
assert(typeof resp.summary === "string" && resp.summary.length > 0, "Summary is non-empty string");
assert(resp.confidence === 87, `Confidence extracted correctly (got ${resp.confidence})`);
assert(resp.detailLevel === "standard", "Detail level is standard");
assert(resp.completeness === 100, "Completeness is 100");
assert(resp.metadata.server === "test-server", "Metadata server correct");
assert(resp.metadata.persona === "Test Persona", "Metadata persona correct");
assert(resp.metadata.executionTimeMs === 42, "Metadata execution time correct");
assert(typeof resp.metadata.timestamp === "string", "Metadata timestamp present");

// ==========================================
// Test: Summary level — geological
// ==========================================

console.log("\n🗺️ Testing summary level — geological...");
const geoSummary = shaper.shape(geoData, { ...baseOpts, detailLevel: "summary" });
const geoSumData = geoSummary.data as Record<string, unknown>;
assert(geoSummary.detailLevel === "summary", "Detail level is summary");
assert("confidence" in geoSumData, "Summary includes confidence");
assert("geological" in geoSumData, "Summary includes geological domain");

const geoInner = geoSumData.geological as Record<string, unknown>;
const geoKeys = Object.keys(geoInner);
assert(geoKeys.length <= 6, `Geological summary has ≤6 fields (got ${geoKeys.length})`);
assert("reservoirQuality" in geoInner, "Summary includes reservoirQuality");
assert("recommendedAction" in geoInner, "Summary includes recommendedAction");
assert("professionalSummary" in geoInner, "Summary includes professionalSummary");

// Should NOT include verbose nested objects
assert(!("drillingRecommendations" in geoSumData), "Summary excludes drillingRecommendations at top level");

// ==========================================
// Test: Summary level — economic
// ==========================================

console.log("\n💰 Testing summary level — economic...");
const econSummary = shaper.shape(econData, { ...baseOpts, detailLevel: "summary" });
const econSumData = econSummary.data as Record<string, unknown>;
const econInner = econSumData.economic as Record<string, unknown>;
assert("npv" in econInner, "Economic summary includes npv");
assert("irr" in econInner, "Economic summary includes irr");
assert("paybackMonths" in econInner, "Economic summary includes paybackMonths");
assert("confidence" in econInner, "Economic summary includes confidence");
assert(!("assumptions" in econInner), "Economic summary excludes assumptions");
assert(!("sensitivityAnalysis" in econInner), "Economic summary excludes sensitivityAnalysis");

// ==========================================
// Test: Summary level — curve
// ==========================================

console.log("\n📈 Testing summary level — curve...");
const curveSummary = shaper.shape(curveData, { ...baseOpts, detailLevel: "summary" });
const curveSumData = curveSummary.data as Record<string, unknown>;
const curveInner = curveSumData.curve as Record<string, unknown>;
assert("eur" in curveInner, "Curve summary includes eur");
assert("initialRate" in curveInner, "Curve summary includes initialRate");
assert("qualityGrade" in curveInner, "Curve summary includes qualityGrade");
assert("confidence" in curveInner, "Curve summary includes confidence");
assert(!("bFactor" in curveInner), "Curve summary excludes bFactor");
assert(!("declineRate" in curveInner), "Curve summary excludes declineRate");

// ==========================================
// Test: Summary level — risk
// ==========================================

console.log("\n⚠️ Testing summary level — risk...");
const riskSummary = shaper.shape(riskData, { ...baseOpts, detailLevel: "summary" });
const riskSumData = riskSummary.data as Record<string, unknown>;
const riskInner = riskSumData.risk as Record<string, unknown>;
assert("overallRiskScore" in riskInner, "Risk summary includes overallRiskScore");
assert("confidence" in riskInner, "Risk summary includes confidence");
assert(!("riskFactors" in riskInner), "Risk summary excludes riskFactors array");

// ==========================================
// Test: Standard level — strips verbose fields
// ==========================================

console.log("\n📊 Testing standard level...");
const econStandard = shaper.shape(econData, { ...baseOpts, detailLevel: "standard" });
const econStdData = econStandard.data as Record<string, unknown>;
const econStdInner = econStdData.economic as Record<string, unknown>;
assert("npv" in econStdInner, "Standard includes npv");
assert("irr" in econStdInner, "Standard includes irr");
assert("assumptions" in econStdInner, "Standard includes assumptions");
assert(!("sensitivityAnalysis" in econStdInner), "Standard strips sensitivityAnalysis");

// ==========================================
// Test: Full level — returns everything
// ==========================================

console.log("\n📋 Testing full level...");
const econFull = shaper.shape(econData, { ...baseOpts, detailLevel: "full" });
const econFullData = econFull.data as Record<string, unknown>;
const econFullInner = econFullData.economic as Record<string, unknown>;
assert("npv" in econFullInner, "Full includes npv");
assert("sensitivityAnalysis" in econFullInner, "Full includes sensitivityAnalysis");
assert("assumptions" in econFullInner, "Full includes assumptions");
assert(econFull.detailLevel === "full", "Detail level is full");

// ==========================================
// Test: Default detail level is standard
// ==========================================

console.log("\n🔧 Testing default detail level...");
const defaultResp = shaper.shape(econData, baseOpts);
assert(defaultResp.detailLevel === "standard", "Default detail level is standard");

// ==========================================
// Test: Natural language summaries
// ==========================================

console.log("\n💬 Testing natural language summaries...");
const geoNl = shaper.shape(geoData, { ...baseOpts, detailLevel: "summary" });
assert(geoNl.summary.includes("Good"), `Geo summary mentions quality (${geoNl.summary})`);
assert(geoNl.summary.includes("drill"), "Geo summary mentions recommended action");
assert(geoNl.summary.includes("87%"), "Geo summary includes confidence");

const econNl = shaper.shape(econData, { ...baseOpts, detailLevel: "summary" });
assert(econNl.summary.includes("$3.5M"), `Econ summary includes NPV (${econNl.summary})`);
assert(econNl.summary.includes("28.5%"), "Econ summary includes IRR");

const curveNl = shaper.shape(curveData, { ...baseOpts, detailLevel: "summary" });
assert(curveNl.summary.includes("520K BOE"), `Curve summary includes EUR (${curveNl.summary})`);
assert(curveNl.summary.includes("Good"), "Curve summary includes grade");

const riskNl = shaper.shape(riskData, { ...baseOpts, detailLevel: "summary" });
assert(riskNl.summary.includes("45"), `Risk summary includes score (${riskNl.summary})`);

// ==========================================
// Test: Minimal data (no domain key)
// ==========================================

console.log("\n🔹 Testing minimal/unknown data...");
const minResp = shaper.shape(minimalData, baseOpts);
assert(minResp.confidence === 85, "Extracts confidence from minimal data");
assert(minResp.summary.includes("85%"), "Summary includes confidence for unknown domain");

// ==========================================
// Test: Confidence extraction from nested data
// ==========================================

console.log("\n🎯 Testing confidence extraction...");
assert(shaper.shape(geoData, baseOpts).confidence === 87, "Extracts confidence from geo data");
assert(shaper.shape(econData, baseOpts).confidence === 82, "Extracts confidence from econ data");
assert(shaper.shape(curveData, baseOpts).confidence === 90, "Extracts confidence from curve data");
assert(shaper.shape(riskData, baseOpts).confidence === 78, "Extracts confidence from risk data");

// Explicit confidence override
const overrideResp = shaper.shape(geoData, { ...baseOpts, confidence: 99 });
assert(overrideResp.confidence === 99, "Explicit confidence overrides extracted value");

// ==========================================
// Summary
// ==========================================

console.log(`\n${"=".repeat(70)}`);
console.log("📊 KERNEL OUTPUT SHAPING TEST SUMMARY");
console.log("=".repeat(70));
console.log(`📋 Tests Run: ${passed + failed}`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

if (failed > 0) {
	console.log("\n❌ SOME TESTS FAILED!");
	process.exit(1);
} else {
	console.log("\n🎉 ALL KERNEL OUTPUT SHAPING TESTS PASSED!");
}
