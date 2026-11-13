/**
 * SDK error classification tests — Issue #363
 *
 * Verifies RetryableToolError and PermanentToolError are exported correctly
 * and carry the right retryable flag for the runtime to surface in AgentExecutionResult.
 *
 * Run: cd sdk && npx tsx tests/errors.test.ts
 */

import assert from "node:assert";
import { PermanentToolError, RetryableToolError } from "../src/index.js";

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
	console.log("\n🧪 SDK Error Classification Tests (#363)\n");

	await test("RetryableToolError is exported", () => {
		assert.strictEqual(typeof RetryableToolError, "function", "RetryableToolError must be exported");
	});

	await test("PermanentToolError is exported", () => {
		assert.strictEqual(typeof PermanentToolError, "function", "PermanentToolError must be exported");
	});

	await test("RetryableToolError.retryable is true", () => {
		const err = new RetryableToolError("timeout");
		assert.strictEqual(err.retryable, true, "RetryableToolError.retryable must be true");
	});

	await test("PermanentToolError.retryable is false", () => {
		const err = new PermanentToolError("bad args");
		assert.strictEqual(err.retryable, false, "PermanentToolError.retryable must be false");
	});

	await test("RetryableToolError is instanceof Error", () => {
		const err = new RetryableToolError("timeout");
		assert.ok(err instanceof Error, "RetryableToolError must extend Error");
	});

	await test("PermanentToolError is instanceof Error", () => {
		const err = new PermanentToolError("bad args");
		assert.ok(err instanceof Error, "PermanentToolError must extend Error");
	});

	await test("RetryableToolError.name is 'RetryableToolError'", () => {
		const err = new RetryableToolError("timeout");
		assert.strictEqual(err.name, "RetryableToolError");
	});

	await test("PermanentToolError.name is 'PermanentToolError'", () => {
		const err = new PermanentToolError("bad args");
		assert.strictEqual(err.name, "PermanentToolError");
	});

	await test("RetryableToolError preserves cause", () => {
		const cause = new Error("root cause");
		const err = new RetryableToolError("timeout", cause);
		assert.strictEqual(err.cause, cause, "cause must be stored");
	});

	await test("PermanentToolError preserves cause", () => {
		const cause = new Error("root cause");
		const err = new PermanentToolError("bad args", cause);
		assert.strictEqual(err.cause, cause, "cause must be stored");
	});

	await test("RetryableToolError is distinguishable via instanceof check", () => {
		const err = new RetryableToolError("timeout");
		assert.ok(err instanceof RetryableToolError);
		assert.ok(!(err instanceof PermanentToolError));
	});

	await test("PermanentToolError is distinguishable via instanceof check", () => {
		const err = new PermanentToolError("bad args");
		assert.ok(err instanceof PermanentToolError);
		assert.ok(!(err instanceof RetryableToolError));
	});

	console.log(`\nSDK Error Classification Tests: ${passed} passed, ${failed} failed`);
	if (failed > 0) process.exit(1);
}

await runTests();
