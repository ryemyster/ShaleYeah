/**
 * Cancellation Token Tests — Issue #130
 *
 * TDD: written BEFORE the implementation.
 * Tests should fail until CancellationToken is implemented.
 *
 * Validates:
 * - CancellationToken: starts uncancelled, cancel() flips isCancelled
 * - CancellationToken: throwIfCancelled() is a no-op when not cancelled
 * - CancellationToken: throwIfCancelled() throws when cancelled
 * - execute(): respects cancellation before execution starts
 * - execute(): returns cancelled response when token is cancelled mid-flight
 * - executeParallel(): skips all requests if cancelled before start
 * - executeParallel(): returns partial results if cancelled between chunks
 * - executeBundle(): stops after current phase if cancelled between phases
 * - executeBundle(): returns partial BundleResponse marked as cancelled
 * - Backward compat: all methods work normally without a token
 */

import assert from "node:assert";
import { Executor } from "../src/kernel/executor.js";
import type { ToolResponse } from "../src/kernel/types.js";
import { CancellationToken } from "../src/kernel/types.js";

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

// ---------------------------------------------------------------------------
// Mock executor factory
// ---------------------------------------------------------------------------

function makeSuccessExecutor(
	delayMs = 5,
): (serverName: string, args: Record<string, unknown>) => Promise<ToolResponse> {
	return async (serverName: string): Promise<ToolResponse> => {
		await new Promise((r) => setTimeout(r, delayMs));
		return {
			success: true,
			summary: `${serverName} done`,
			confidence: 90,
			data: { server: serverName },
			detailLevel: "standard",
			completeness: 100,
			metadata: {
				server: serverName,
				persona: "test",
				executionTimeMs: delayMs,
				timestamp: new Date().toISOString(),
			},
		};
	};
}

async function runTests(): Promise<void> {
	console.log("\n🧪 Cancellation Token Tests (Issue #130)\n");

	// ---------------------------------------------------------------------------
	// CancellationToken — unit tests
	// ---------------------------------------------------------------------------

	await test("CancellationToken: starts uncancelled", () => {
		const token = new CancellationToken();
		assert.strictEqual(token.isCancelled, false);
	});

	await test("CancellationToken: cancel() flips isCancelled to true", () => {
		const token = new CancellationToken();
		token.cancel();
		assert.strictEqual(token.isCancelled, true);
	});

	await test("CancellationToken: cancel() is idempotent", () => {
		const token = new CancellationToken();
		token.cancel();
		token.cancel();
		assert.strictEqual(token.isCancelled, true);
	});

	await test("CancellationToken: throwIfCancelled() does nothing when not cancelled", () => {
		const token = new CancellationToken();
		// Should not throw
		token.throwIfCancelled();
	});

	await test("CancellationToken: throwIfCancelled() throws when cancelled", () => {
		const token = new CancellationToken();
		token.cancel();
		assert.throws(() => token.throwIfCancelled(), /cancelled/i);
	});

	// ---------------------------------------------------------------------------
	// execute() with cancellation
	// ---------------------------------------------------------------------------

	await test("execute(): returns cancelled response when token is pre-cancelled", async () => {
		const executor = new Executor();
		executor.setExecutorFn(makeSuccessExecutor(10));
		const token = new CancellationToken();
		token.cancel();
		const resp = await executor.execute({ toolName: "geowiz.analyze", args: {} }, token);
		assert.strictEqual(resp.success, false);
		assert.ok(resp.summary.toLowerCase().includes("cancel"), `Expected 'cancel' in summary, got: ${resp.summary}`);
	});

	await test("execute(): succeeds normally when token is not cancelled", async () => {
		const executor = new Executor();
		executor.setExecutorFn(makeSuccessExecutor(5));
		const token = new CancellationToken();
		const resp = await executor.execute({ toolName: "geowiz.analyze", args: {} }, token);
		assert.strictEqual(resp.success, true);
	});

	await test("execute(): works without a token (backward compat)", async () => {
		const executor = new Executor();
		executor.setExecutorFn(makeSuccessExecutor(5));
		const resp = await executor.execute({ toolName: "geowiz.analyze", args: {} });
		assert.strictEqual(resp.success, true);
	});

	// ---------------------------------------------------------------------------
	// executeParallel() with cancellation
	// ---------------------------------------------------------------------------

	await test("executeParallel(): returns empty results when pre-cancelled", async () => {
		const executor = new Executor();
		executor.setExecutorFn(makeSuccessExecutor(5));
		const token = new CancellationToken();
		token.cancel();
		const result = await executor.executeParallel(
			[
				{ toolName: "geowiz.analyze", args: {} },
				{ toolName: "econobot.analyze", args: {} },
			],
			token,
		);
		assert.strictEqual(result.results.size, 0);
		assert.ok(result.cancelled, "Expected cancelled flag on result");
	});

	await test("executeParallel(): returns partial results when cancelled between chunks", async () => {
		// maxParallel=1 so chunks are processed one at a time; cancel after first chunk
		const executor = new Executor({ maxParallel: 1 });
		const token = new CancellationToken();
		let calls = 0;
		executor.setExecutorFn(async (serverName) => {
			calls++;
			if (calls === 1) {
				// Cancel after first tool executes
				token.cancel();
			}
			await new Promise((r) => setTimeout(r, 5));
			return {
				success: true,
				summary: `${serverName} done`,
				confidence: 90,
				data: {},
				detailLevel: "standard",
				completeness: 100,
				metadata: { server: serverName, persona: "test", executionTimeMs: 5, timestamp: new Date().toISOString() },
			};
		});

		const result = await executor.executeParallel(
			[
				{ toolName: "geowiz.analyze", args: {} },
				{ toolName: "econobot.analyze", args: {} },
				{ toolName: "curve-smith.analyze", args: {} },
			],
			token,
		);

		// At least the first chunk's result should be present; second chunk skipped
		assert.ok(result.results.size >= 1, "Expected at least one result from first chunk");
		assert.ok(result.results.size < 3, "Expected second/third chunk to be skipped after cancellation");
		assert.ok(result.cancelled, "Expected cancelled flag on partial result");
	});

	await test("executeParallel(): works without a token (backward compat)", async () => {
		const executor = new Executor();
		executor.setExecutorFn(makeSuccessExecutor(5));
		const result = await executor.executeParallel([
			{ toolName: "geowiz.analyze", args: {} },
			{ toolName: "econobot.analyze", args: {} },
		]);
		assert.strictEqual(result.results.size, 2);
		assert.strictEqual(result.cancelled, undefined);
	});

	// ---------------------------------------------------------------------------
	// executeBundle() with cancellation
	// ---------------------------------------------------------------------------

	await test("executeBundle(): stops after first phase and returns partial result when token cancelled between phases", async () => {
		const executor = new Executor();
		const token = new CancellationToken();
		let phaseOneComplete = false;

		executor.setExecutorFn(async (serverName) => {
			await new Promise((r) => setTimeout(r, 5));
			if (serverName === "geowiz") {
				phaseOneComplete = true;
				// Cancel after phase 1 completes
				token.cancel();
			}
			return {
				success: true,
				summary: `${serverName} done`,
				confidence: 90,
				data: {},
				detailLevel: "standard",
				completeness: 100,
				metadata: { server: serverName, persona: "test", executionTimeMs: 5, timestamp: new Date().toISOString() },
			};
		});

		const bundle = {
			name: "test-bundle",
			description: "test",
			gatherStrategy: "all" as const,
			steps: [
				{ toolName: "geowiz.analyze", args: {}, parallel: false, optional: false },
				{ toolName: "econobot.analyze", args: {}, parallel: false, optional: false, dependsOn: ["geowiz.analyze"] },
			],
		};

		const result = await executor.executeBundle(bundle, {}, undefined, token);
		assert.ok(phaseOneComplete, "Expected phase 1 to complete");
		assert.ok(result.results.has("geowiz.analyze"), "Expected phase-1 result to be present");
		assert.ok(!result.results.has("econobot.analyze"), "Expected phase-2 result to be absent (cancelled)");
		assert.ok(result.cancelled, "Expected cancelled flag on bundle result");
	});

	await test("executeBundle(): completes normally without a token (backward compat)", async () => {
		const executor = new Executor();
		executor.setExecutorFn(makeSuccessExecutor(5));

		const bundle = {
			name: "test-bundle",
			description: "test",
			gatherStrategy: "all" as const,
			steps: [
				{ toolName: "geowiz.analyze", args: {}, parallel: false, optional: false },
				{ toolName: "econobot.analyze", args: {}, parallel: false, optional: false },
			],
		};

		const result = await executor.executeBundle(bundle);
		assert.strictEqual(result.results.size, 2);
		assert.strictEqual(result.cancelled, undefined);
	});

	// ---------------------------------------------------------------------------
	// Summary
	// ---------------------------------------------------------------------------

	console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
	if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
	console.error("Test runner error:", err);
	process.exit(1);
});
