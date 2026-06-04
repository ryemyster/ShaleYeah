/**
 * Reporter Server Unit Tests
 * Tests countWordsInSummary and deriveDefaultExecutiveSummary — no API key required.
 */

import { countWordsInSummary, deriveDefaultExecutiveSummary } from "../src/index.js";

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

console.log("\n=== Reporter Server — countWordsInSummary ===\n");

assert(countWordsInSummary("") === 0, "empty string → 0 words");
assert(countWordsInSummary("   ") === 0, "whitespace only → 0 words");
assert(countWordsInSummary("hello world") === 2, "two words → 2");
assert(countWordsInSummary("one two three four five") === 5, "five words → 5");
assert(countWordsInSummary("  leading and trailing  ") === 3, "extra whitespace doesn't add words");

console.log("\n=== Reporter Server — deriveDefaultExecutiveSummary ===\n");

const proceed = deriveDefaultExecutiveSummary({
	tractName: "Wolfcamp A",
	recommendation: "PROCEED",
	npv: 15_000_000,
	irr: 0.28,
	paybackMonths: 18,
	confidence: 85,
});
assert(typeof proceed === "string", "PROCEED → returns string");
assert(proceed.includes("PROCEED"), "PROCEED summary mentions recommendation");
assert(proceed.includes("Wolfcamp A"), "summary includes tract name");
assert(proceed.includes("15.0"), "summary includes NPV value");
assert(proceed.includes("28.0"), "summary includes IRR value");
assert(proceed.includes("18 months"), "summary includes payback");
assert(countWordsInSummary(proceed) < 500, "PROCEED summary is under 500 words");

const reject = deriveDefaultExecutiveSummary({
	tractName: "Austin Chalk",
	recommendation: "REJECT",
	npv: -2_000_000,
	irr: 0.05,
	paybackMonths: 48,
	confidence: 90,
});
assert(reject.includes("REJECT"), "REJECT summary mentions recommendation");
assert(reject.includes("Austin Chalk"), "REJECT summary includes tract name");
assert(countWordsInSummary(reject) < 500, "REJECT summary is under 500 words");

const defer = deriveDefaultExecutiveSummary({
	tractName: "Eagle Ford",
	recommendation: "DEFER",
	npv: 3_000_000,
	irr: 0.12,
	paybackMonths: 30,
	confidence: 70,
});
assert(defer.includes("DEFER"), "DEFER summary mentions recommendation");
assert(defer.includes("Eagle Ford"), "DEFER summary includes tract name");

// Undefined metrics → N/A in output (not crash, not zero)
const noMetrics = deriveDefaultExecutiveSummary({
	tractName: "Unknown",
	recommendation: "DEFER",
	npv: undefined,
	irr: undefined,
	paybackMonths: undefined,
	confidence: 50,
});
assert(noMetrics.includes("N/A"), "undefined metrics → N/A in summary");
assert(!noMetrics.includes("undefined"), "undefined not leaked into summary text");

// Different recommendations → different outputs
assert(proceed !== reject, "PROCEED and REJECT produce different summaries");
assert(proceed !== defer, "PROCEED and DEFER produce different summaries");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
