import assert from "node:assert";
import { callLLM } from "@shaleyeah/sdk";
import { deriveDefaultTitleFindings } from "../src/index.js";

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

await test("callLLM: reaches Anthropic SDK", async () => {
	const saved = process.env.ANTHROPIC_API_KEY;
	try {
		process.env.ANTHROPIC_API_KEY = "sk-ant-api03-fake-key-for-testing-purposes-only-00000000000000000000000000";
		let err: Error | null = null;
		try {
			await callLLM({ prompt: "Analyze title for Section 12 Reeves County.", maxTokens: 200 });
		} catch (e: unknown) {
			err = e instanceof Error ? e : new Error(String(e));
		}
		assert.ok(err !== null);
		assert.ok(!err.message.includes("environment variable is not set"));
	} finally {
		if (saved !== undefined) {
			process.env.ANTHROPIC_API_KEY = saved;
		} else {
			delete process.env.ANTHROPIC_API_KEY;
		}
	}
});

await test("title: complex multi-parcel description differs from simple single parcel", () => {
	const complex = deriveDefaultTitleFindings("Section 1, Section 2, Section 3", "Reeves", "40 years");
	const simple = deriveDefaultTitleFindings("Section 12 Block A", "Midland", "20 years");
	assert.notStrictEqual(complex.ownershipPercentage, simple.ownershipPercentage);
	assert.ok(complex.ownershipPercentage < simple.ownershipPercentage);
	assert.ok(complex.notes.includes("Reeves"));
});

await test("callLLM: throws when ANTHROPIC_API_KEY absent", async () => {
	const saved = process.env.ANTHROPIC_API_KEY;
	try {
		delete process.env.ANTHROPIC_API_KEY;
		let threw = false;
		try {
			await callLLM({ prompt: "test" });
		} catch {
			threw = true;
		}
		assert.ok(threw);
	} finally {
		if (saved !== undefined) {
			process.env.ANTHROPIC_API_KEY = saved;
		}
	}
});

console.log(`\n  Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
