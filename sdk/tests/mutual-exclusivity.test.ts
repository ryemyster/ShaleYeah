/**
 * Mutual Exclusivity utility tests — Issue #453 (Arcade #9)
 *
 * Verifies checkMutualExclusivity and buildMutualExclusivityError exported from
 * the SDK. These run at the MCP tool-call layer to reject ambiguous calls where
 * the LLM provides two params that are XOR (exactly one must be present).
 *
 * Run: cd sdk && npx tsx tests/mutual-exclusivity.test.ts
 */

import assert from "node:assert";
import { buildMutualExclusivityError, checkMutualExclusivity } from "../src/index.js";

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
			console.log(`  ✗ ${name}`);
			console.log(`    ${err instanceof Error ? err.message : String(err)}`);
			failed++;
		});
}

async function runTests(): Promise<void> {
	console.log("\n🧪 Mutual Exclusivity Tests (#453 — Arcade #9)\n");

	// checkMutualExclusivity — null means no violation

	await test("no violation — only first param provided", () => {
		const result = checkMutualExclusivity({ formationName: "Permian" }, [["formationName", "formationId"]]);
		assert.strictEqual(result, null, "single param should not violate XOR");
	});

	await test("no violation — only second param provided", () => {
		const result = checkMutualExclusivity({ formationId: "f-001" }, [["formationName", "formationId"]]);
		assert.strictEqual(result, null, "single param should not violate XOR");
	});

	await test("no violation — neither param provided (both optional)", () => {
		const result = checkMutualExclusivity({ filePath: "/data/well.las" }, [["formationName", "formationId"]]);
		assert.strictEqual(result, null, "omitting both optional XOR params is valid");
	});

	await test("violation — both params in group provided", () => {
		const result = checkMutualExclusivity({ formationName: "Permian", formationId: "f-001" }, [
			["formationName", "formationId"],
		]);
		assert.notStrictEqual(result, null, "providing both XOR params must return an error string");
		assert.ok(typeof result === "string", "error must be a string");
		assert.ok(result.includes("formationName"), "error must name the offending params");
		assert.ok(result.includes("formationId"), "error must name the offending params");
	});

	await test("violation — reports the right group when multiple groups defined", () => {
		const result = checkMutualExclusivity({ wellName: "Wolf 12", wellId: "w-099" }, [
			["formationName", "formationId"],
			["wellName", "wellId"],
		]);
		assert.notStrictEqual(result, null, "violation in second group must be detected");
		assert.ok((result as string).includes("wellName"), "error must identify the second group");
	});

	await test("no violation — multiple groups, only one param per group", () => {
		const result = checkMutualExclusivity({ formationName: "Permian", wellId: "w-001" }, [
			["formationName", "formationId"],
			["wellName", "wellId"],
		]);
		assert.strictEqual(result, null, "one param per group is valid");
	});

	await test("null and undefined are treated as absent", () => {
		const result = checkMutualExclusivity({ formationName: "Permian", formationId: null }, [
			["formationName", "formationId"],
		]);
		assert.strictEqual(result, null, "null value must not count as provided");
	});

	// buildMutualExclusivityError — structured permanent error for the LLM

	await test("buildMutualExclusivityError returns error_type: permanent", () => {
		const err = buildMutualExclusivityError(["tractId", "legalDescription"], ["tractId", "legalDescription"]);
		assert.strictEqual(err.error_type, "permanent", "XOR violation is never retryable with same args");
	});

	await test("buildMutualExclusivityError includes both param names in error", () => {
		const err = buildMutualExclusivityError(["tractId", "legalDescription"], ["tractId", "legalDescription"]);
		assert.ok(err.error.includes("tractId"), "error must name tractId");
		assert.ok(err.error.includes("legalDescription"), "error must name legalDescription");
	});

	await test("buildMutualExclusivityError includes a hint field", () => {
		const err = buildMutualExclusivityError(["tractId", "legalDescription"], ["tractId", "legalDescription"]);
		assert.ok(typeof err.hint === "string" && err.hint.length > 0, "hint must be a non-empty string");
	});

	console.log(`\nMutual Exclusivity Tests: ${passed} passed, ${failed} failed`);
	if (failed > 0) process.exit(1);
}

await runTests();
