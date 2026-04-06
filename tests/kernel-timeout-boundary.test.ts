/**
 * Timeout Boundary Tests — Issue #146
 *
 * TDD: written BEFORE the implementation.
 * Tests should fail until timeout boundary features are implemented.
 *
 * Validates:
 * - Per-call timeout already works (existing behaviour, regression guard)
 * - Per-server timeout overrides global toolTimeoutMs
 * - KERNEL_TIMEOUT_MS env var sets default toolTimeoutMs
 * - executeParallel(): aggregateTimeoutMs cuts off slow operations and returns partial results
 * - executeParallel(): timedOut flag set when aggregate timeout fires
 * - executeBundle(): aggregateTimeoutMs stops new phases from starting after deadline
 * - executeBundle(): timedOut flag set on partial bundle result
 * - Backward compat: all methods work normally without aggregate timeout
 */

import assert from "node:assert";
import { Executor } from "../src/kernel/executor.js";
import type { BundleResponse, GatheredResponse, ToolResponse } from "../src/kernel/types.js";

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
// Mock executor factory — configurable per-server delay
// ---------------------------------------------------------------------------

function makeDelayedExecutor(
	delays: Record<string, number>,
	defaultDelay = 5,
): (serverName: string, args: Record<string, unknown>) => Promise<ToolResponse> {
	return async (serverName: string): Promise<ToolResponse> => {
		const delay = delays[serverName] ?? defaultDelay;
		await new Promise((r) => setTimeout(r, delay));
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
				executionTimeMs: delay,
				timestamp: new Date().toISOString(),
			},
		};
	};
}

async function runTests(): Promise<void> {
	console.log("\n🧪 Timeout Boundary Tests (Issue #146)\n");

	// ---------------------------------------------------------------------------
	// Per-call timeout (existing behaviour — regression guard)
	// ---------------------------------------------------------------------------

	await test("execute(): times out slow call and returns error response", async () => {
		const executor = new Executor({ toolTimeoutMs: 30 });
		executor.setExecutorFn(makeDelayedExecutor({ geowiz: 200 }));
		const resp = await executor.execute({ toolName: "geowiz.analyze", args: {} });
		assert.strictEqual(resp.success, false);
		assert.ok(resp.summary.toLowerCase().includes("timed out"), `Expected timeout message, got: ${resp.summary}`);
	});

	await test("execute(): fast call succeeds within timeout", async () => {
		const executor = new Executor({ toolTimeoutMs: 500 });
		executor.setExecutorFn(makeDelayedExecutor({ geowiz: 5 }));
		const resp = await executor.execute({ toolName: "geowiz.analyze", args: {} });
		assert.strictEqual(resp.success, true);
	});

	// ---------------------------------------------------------------------------
	// Per-server timeout overrides
	// ---------------------------------------------------------------------------

	await test("execute(): per-server timeout overrides global toolTimeoutMs", async () => {
		// Global = 500ms (generous), but econobot override = 30ms; econobot takes 200ms → should timeout
		const executor = new Executor({
			toolTimeoutMs: 500,
			serverTimeouts: { econobot: 30 },
		});
		executor.setExecutorFn(makeDelayedExecutor({ econobot: 200 }));
		const resp = await executor.execute({ toolName: "econobot.analyze", args: {} });
		assert.strictEqual(resp.success, false);
		assert.ok(resp.summary.toLowerCase().includes("timed out"), `Expected timeout message, got: ${resp.summary}`);
	});

	await test("execute(): per-server timeout does not affect other servers", async () => {
		// econobot has a tight override but geowiz uses global (generous)
		const executor = new Executor({
			toolTimeoutMs: 500,
			serverTimeouts: { econobot: 30 },
		});
		executor.setExecutorFn(makeDelayedExecutor({ geowiz: 5 }));
		const resp = await executor.execute({ toolName: "geowiz.analyze", args: {} });
		assert.strictEqual(resp.success, true);
	});

	// ---------------------------------------------------------------------------
	// KERNEL_TIMEOUT_MS env var
	// ---------------------------------------------------------------------------

	await test("KERNEL_TIMEOUT_MS env var sets default toolTimeoutMs", async () => {
		process.env.KERNEL_TIMEOUT_MS = "30";
		// Executor reads env at construction time
		const executor = new Executor();
		delete process.env.KERNEL_TIMEOUT_MS;
		executor.setExecutorFn(makeDelayedExecutor({ geowiz: 200 }));
		const resp = await executor.execute({ toolName: "geowiz.analyze", args: {} });
		assert.strictEqual(resp.success, false);
		assert.ok(resp.summary.toLowerCase().includes("timed out"), `Expected timeout message, got: ${resp.summary}`);
	});

	// ---------------------------------------------------------------------------
	// executeParallel() aggregate timeout
	// ---------------------------------------------------------------------------

	await test("executeParallel(): returns partial results when aggregate timeout fires", async () => {
		// geowiz takes 30ms; aggregate deadline = 20ms.
		// geowiz chunk starts (pre-chunk check: 0ms < 20ms → ok), takes 30ms.
		// Post-chunk check: ~30ms >= 20ms → timedOut, econobot never starts.
		const executor = new Executor({ maxParallel: 1 }); // serialize chunks
		executor.setExecutorFn(makeDelayedExecutor({ geowiz: 30, econobot: 300 }));

		const result: GatheredResponse = await executor.executeParallel(
			[
				{ toolName: "geowiz.analyze", args: {} },
				{ toolName: "econobot.analyze", args: {} },
			],
			undefined,
			{ aggregateTimeoutMs: 20 },
		);

		assert.ok(result.results.has("geowiz.analyze"), "Expected first server result to be present");
		assert.ok(!result.results.has("econobot.analyze"), "Expected slow server result to be absent");
		assert.ok(result.timedOut, "Expected timedOut flag on result");
	});

	await test("executeParallel(): timedOut is not set when all complete in time", async () => {
		const executor = new Executor();
		executor.setExecutorFn(makeDelayedExecutor({}, 5));

		const result: GatheredResponse = await executor.executeParallel(
			[
				{ toolName: "geowiz.analyze", args: {} },
				{ toolName: "econobot.analyze", args: {} },
			],
			undefined,
			{ aggregateTimeoutMs: 500 },
		);

		assert.strictEqual(result.timedOut, undefined);
		assert.strictEqual(result.results.size, 2);
	});

	await test("executeParallel(): works without aggregateTimeoutMs (backward compat)", async () => {
		const executor = new Executor();
		executor.setExecutorFn(makeDelayedExecutor({}, 5));

		const result = await executor.executeParallel([{ toolName: "geowiz.analyze", args: {} }]);

		assert.strictEqual(result.results.size, 1);
		assert.strictEqual(result.timedOut, undefined);
	});

	// ---------------------------------------------------------------------------
	// executeBundle() aggregate timeout
	// ---------------------------------------------------------------------------

	await test("executeBundle(): stops after completed phases when aggregate timeout fires", async () => {
		// Phase 1: geowiz (30ms). Phase 2: econobot depends on geowiz (300ms).
		// Aggregate deadline = 20ms — geowiz starts (0ms < 20ms), takes 30ms.
		// Post-phase check: ~30ms >= 20ms → timedOut, phase 2 never starts.
		const executor = new Executor();
		executor.setExecutorFn(makeDelayedExecutor({ geowiz: 30, econobot: 300 }));

		const bundle = {
			name: "test-bundle",
			description: "test",
			gatherStrategy: "all" as const,
			steps: [
				{ toolName: "geowiz.analyze", args: {}, parallel: false, optional: false },
				{
					toolName: "econobot.analyze",
					args: {},
					parallel: false,
					optional: false,
					dependsOn: ["geowiz.analyze"],
				},
			],
		};

		const result: BundleResponse = await executor.executeBundle(bundle, {}, undefined, undefined, {
			aggregateTimeoutMs: 20,
		});

		assert.ok(result.results.has("geowiz.analyze"), "Expected phase-1 result present");
		assert.ok(!result.results.has("econobot.analyze"), "Expected phase-2 skipped due to timeout");
		assert.ok(result.timedOut, "Expected timedOut flag on bundle result");
	});

	await test("executeBundle(): timedOut not set when bundle completes in time", async () => {
		const executor = new Executor();
		executor.setExecutorFn(makeDelayedExecutor({}, 5));

		const bundle = {
			name: "test-bundle",
			description: "test",
			gatherStrategy: "all" as const,
			steps: [
				{ toolName: "geowiz.analyze", args: {}, parallel: false, optional: false },
				{ toolName: "econobot.analyze", args: {}, parallel: false, optional: false },
			],
		};

		const result: BundleResponse = await executor.executeBundle(bundle, {}, undefined, undefined, {
			aggregateTimeoutMs: 500,
		});

		assert.strictEqual(result.timedOut, undefined);
		assert.strictEqual(result.results.size, 2);
	});

	await test("executeBundle(): works without aggregateTimeoutMs (backward compat)", async () => {
		const executor = new Executor();
		executor.setExecutorFn(makeDelayedExecutor({}, 5));

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
		assert.strictEqual(result.timedOut, undefined);
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
