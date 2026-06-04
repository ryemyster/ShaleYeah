/**
 * Development Server Unit Tests
 * Tests deriveDefaultDevelopmentOutlook — no API key required.
 */

import { deriveDefaultDevelopmentOutlook } from "../src/index.js";

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

console.log("\n=== Development Server — deriveDefaultDevelopmentOutlook ===\n");

// Small project, generous budget, no constraints
const small = deriveDefaultDevelopmentOutlook(5, 20_000_000, []);
assert(typeof small.scheduleRisk === "string", "output has scheduleRisk");
assert(typeof small.budgetRisk === "string", "output has budgetRisk");
assert(Array.isArray(small.criticalPath), "output has criticalPath array");
assert(small.criticalPath.length > 0, "criticalPath is non-empty");
assert(typeof small.recommendation === "string", "output has recommendation");
assert(small.scheduleRisk === "Low", "small project → Low schedule risk");
assert(small.budgetRisk === "Low", "adequate budget → Low budget risk");
assert(small.recommendation.includes("Single-phase"), "small project → single-phase recommendation");

// Large project (> 20 wells)
const large = deriveDefaultDevelopmentOutlook(25, 100_000_000, []);
assert(large.scheduleRisk === "Medium", "large project (25 wells) → Medium schedule risk");
assert(large.recommendation.includes("Phased"), "large project → phased recommendation");
assert(large.criticalPath.includes("Phased rig mobilization"), "large project → rig mobilization in critical path");

// Tight budget (< $2M per well)
const tight = deriveDefaultDevelopmentOutlook(10, 15_000_000, []); // $1.5M/well < $2M threshold
assert(tight.budgetRisk === "High", "tight budget → High budget risk");
assert(tight.recommendation.includes("Budget is tight"), "tight budget → budget warning in recommendation");

// Has constraints, adequate budget → Medium budget risk
const constrained = deriveDefaultDevelopmentOutlook(5, 30_000_000, ["H2S environment", "shallow aquifer"]);
assert(constrained.budgetRisk === "Medium", "constraints with adequate budget → Medium budget risk");

// Different inputs produce different outputs (determinism check)
const a = deriveDefaultDevelopmentOutlook(3, 50_000_000, []);
const b = deriveDefaultDevelopmentOutlook(30, 10_000_000, ["permafrost"]);
assert(a.scheduleRisk !== b.scheduleRisk || a.budgetRisk !== b.budgetRisk, "different inputs → different outputs");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
