/**
 * Decision Server Unit Tests
 * Tests exported deterministic helpers — no API key required.
 */

import { calculateRecommendedBid, countDomainsPresent } from "../src/index.js";

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

console.log("\n=== Decision Server — countDomainsPresent ===\n");

assert(countDomainsPresent({}) === 0, "empty inputs → 0 domains");
assert(countDomainsPresent({ geological: {} as never }) === 1, "one domain → 1");
assert(countDomainsPresent({ geological: {} as never, economic: {} as never }) === 2, "two domains → 2");
assert(
	countDomainsPresent({
		geological: {} as never,
		economic: {} as never,
		curve: {} as never,
	}) === 3,
	"three domains → 3",
);
assert(
	countDomainsPresent({
		geological: {} as never,
		economic: {} as never,
		curve: {} as never,
		risk: {} as never,
	}) === 4,
	"all four domains → 4",
);
assert(countDomainsPresent({ geological: null as never }) === 0, "null geological → 0 (falsy)");

console.log("\n=== Decision Server — calculateRecommendedBid ===\n");

const proceedBid = calculateRecommendedBid(10_000_000, "PROCEED");
assert(typeof proceedBid === "number", "PROCEED bid is a number");
assert(proceedBid > 0, "PROCEED bid is positive");

const passBid = calculateRecommendedBid(10_000_000, "PASS");
assert(typeof passBid === "number", "PASS bid is a number");

// PROCEED should bid more aggressively than PASS for same NPV
assert(proceedBid > passBid, "PROCEED bid > PASS bid for same NPV");

// Negative NPV produces a negative bid (70% of NPV — caller decides whether to proceed)
const negativeBid = calculateRecommendedBid(-5_000_000, "REJECT");
assert(negativeBid < 0, "negative NPV → negative bid (70% of NPV, not clamped to zero)");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
