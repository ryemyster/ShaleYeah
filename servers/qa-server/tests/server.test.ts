import assert from "node:assert";
import { deriveDefaultQAResult } from "../src/index.js";

let passed = 0; let failed = 0;
function test(name: string, fn: () => void | Promise<void>): Promise<void> {
	return Promise.resolve().then(fn).then(() => { console.log(`  ✓ ${name}`); passed++; })
		.catch((err: unknown) => { console.log(`  ✗ ${name}\n    ${err instanceof Error ? err.message : String(err)}`); failed++; });
}

await test("qa-server: tight accuracy threshold produces WARNING vs standard produces PASS", () => {
	const tight = deriveDefaultQAResult(["geowiz", "econobot", "decision"], 0.99);
	const standard = deriveDefaultQAResult(["geowiz"], 0.95);
	assert.notStrictEqual(tight.overallStatus, standard.overallStatus);
	assert.strictEqual(tight.overallStatus, "WARNING");
	assert.strictEqual(standard.overallStatus, "PASS");
});

await test("qa-server: no hardcoded legacy constants in fallback output", () => {
	const result = deriveDefaultQAResult(["geowiz", "econobot"], 0.95);
	const s = JSON.stringify(result);
	assert.ok(!s.includes("145ms")); assert.ok(!s.includes("420 requests")); assert.ok(!s.includes('"score": 95'));
});

console.log(`\n  Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
