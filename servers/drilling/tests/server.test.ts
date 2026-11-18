/**
 * Drilling Server Unit Tests
 * Tests deriveDefaultDrillingInterpretation — no API key required.
 */

import { deriveDefaultDrillingInterpretation } from "../src/index.js";

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

console.log("\n=== Drilling Server — deriveDefaultDrillingInterpretation ===\n");

// Shallow vertical well — lowest risk combo
const shallowVertical = deriveDefaultDrillingInterpretation("vertical", 5000, "sandstone");
assert(typeof shallowVertical.programRisk === "string", "output has programRisk");
assert(Array.isArray(shallowVertical.keyConsiderations), "output has keyConsiderations array");
assert(shallowVertical.keyConsiderations.length > 0, "keyConsiderations is non-empty");
assert(typeof shallowVertical.recommendation === "string", "output has recommendation");
assert(shallowVertical.programRisk === "Low", "shallow vertical → Low risk");
assert(shallowVertical.keyConsiderations[0].includes("vertical"), "keyConsiderations mentions well type");
assert(shallowVertical.keyConsiderations[0].includes("5000"), "keyConsiderations mentions depth");
assert(shallowVertical.keyConsiderations[0].includes("sandstone"), "keyConsiderations mentions formation");

// Deep vertical — medium risk (deep but not horizontal)
const deepVertical = deriveDefaultDrillingInterpretation("vertical", 15000, "granite");
assert(deepVertical.programRisk === "Medium", "deep vertical → Medium risk");
assert(
	deepVertical.keyConsiderations.some((c) => c.includes("pore pressure")),
	"deep well → pore pressure consideration",
);

// Shallow horizontal — medium risk (horizontal but not deep)
const shallowHorizontal = deriveDefaultDrillingInterpretation("horizontal", 8000, "shale");
assert(shallowHorizontal.programRisk === "Medium", "shallow horizontal → Medium risk");
assert(
	shallowHorizontal.keyConsiderations.some((c) => c.includes("torque")),
	"horizontal → torque and drag consideration",
);

// Deep horizontal — highest risk combo
const deepHorizontal = deriveDefaultDrillingInterpretation("horizontal", 14000, "wolfcamp");
assert(deepHorizontal.programRisk === "High", "deep horizontal → High risk");

// Different inputs produce different outputs (determinism check)
const a = deriveDefaultDrillingInterpretation("vertical", 4000, "limestone");
const b = deriveDefaultDrillingInterpretation("horizontal", 16000, "shale");
assert(a.programRisk !== b.programRisk, "different inputs → different risk levels");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
