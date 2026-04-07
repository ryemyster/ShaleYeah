/**
 * Graceful Degradation Tests — Issue #147
 *
 * TDD: written BEFORE the implementation.
 * Tests should fail until graceful degradation features are implemented.
 *
 * Validates:
 * - executeParallel(): degraded flag set when some servers fail but within threshold
 * - executeParallel(): degradationManifest lists missing tools and reasons
 * - executeParallel(): overallFailure when failures exceed minSuccessRatio threshold
 * - executeBundle(): degraded flag set when some phases/steps fail within threshold
 * - executeBundle(): degradationManifest populated on partial bundle result
 * - Backward compat: no degraded flag when all succeed
 * - Backward compat: works without minSuccessRatio option
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
// Mock executor factory — configurable per-server success/failure
// ---------------------------------------------------------------------------

function makeSelectiveExecutor(
	failServers: Set<string>,
): (serverName: string, args: Record<string, unknown>) => Promise<ToolResponse> {
	return async (serverName: string): Promise<ToolResponse> => {
		await new Promise((r) => setTimeout(r, 5));
		if (failServers.has(serverName)) {
			return {
				success: false,
				summary: `${serverName} failed`,
				confidence: 0,
				data: null,
				detailLevel: "standard",
				completeness: 0,
				metadata: {
					server: serverName,
					persona: "test",
					executionTimeMs: 5,
					timestamp: new Date().toISOString(),
				},
				error: { type: "permanent" as const, message: `${serverName} failed` },
			};
		}
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
				executionTimeMs: 5,
				timestamp: new Date().toISOString(),
			},
		};
	};
}

async function runTests(): Promise<void> {
	console.log("\n🧪 Graceful Degradation Tests (Issue #147)\n");

	// ---------------------------------------------------------------------------
	// executeParallel() — degraded flag and manifest
	// ---------------------------------------------------------------------------

	await test("executeParallel(): degraded flag set when 1 of 3 servers fails", async () => {
		const executor = new Executor();
		executor.setExecutorFn(makeSelectiveExecutor(new Set(["risk"])));

		const result: GatheredResponse = await executor.executeParallel([
			{ toolName: "geowiz.analyze", args: {} },
			{ toolName: "econobot.analyze", args: {} },
			{ toolName: "risk.analyze", args: {} },
		]);

		assert.ok(result.degraded, "Expected degraded flag");
		assert.strictEqual(result.results.size, 3); // all results present (including failed)
		assert.strictEqual(result.failures.length, 1);
	});

	await test("executeParallel(): degradationManifest lists missing tool and reason", async () => {
		const executor = new Executor();
		executor.setExecutorFn(makeSelectiveExecutor(new Set(["risk"])));

		const result: GatheredResponse = await executor.executeParallel([
			{ toolName: "geowiz.analyze", args: {} },
			{ toolName: "risk.analyze", args: {} },
		]);

		assert.ok(result.degradationManifest, "Expected degradationManifest");
		assert.ok(
			result.degradationManifest!.missingSections.includes("risk.analyze"),
			`Expected risk.analyze in missingSections, got: ${JSON.stringify(result.degradationManifest!.missingSections)}`,
		);
		assert.ok(result.degradationManifest!.reasons.length > 0, "Expected at least one reason");
	});

	await test("executeParallel(): no degraded flag when all succeed", async () => {
		const executor = new Executor();
		executor.setExecutorFn(makeSelectiveExecutor(new Set()));

		const result: GatheredResponse = await executor.executeParallel([
			{ toolName: "geowiz.analyze", args: {} },
			{ toolName: "econobot.analyze", args: {} },
		]);

		assert.strictEqual(result.degraded, undefined);
		assert.strictEqual(result.degradationManifest, undefined);
	});

	await test("executeParallel(): works without minSuccessRatio (backward compat)", async () => {
		const executor = new Executor();
		executor.setExecutorFn(makeSelectiveExecutor(new Set(["risk"])));

		const result = await executor.executeParallel([
			{ toolName: "geowiz.analyze", args: {} },
			{ toolName: "risk.analyze", args: {} },
		]);

		// Should still return results, no throw
		assert.ok(result.results.size > 0);
	});

	// ---------------------------------------------------------------------------
	// minSuccessRatio threshold
	// ---------------------------------------------------------------------------

	await test("executeParallel(): within minSuccessRatio threshold — degraded but not overallFailure", async () => {
		const executor = new Executor();
		executor.setExecutorFn(makeSelectiveExecutor(new Set(["risk"])));

		// 2 of 3 succeed = 66% success; minSuccessRatio = 0.5 → within threshold
		const result: GatheredResponse = await executor.executeParallel(
			[
				{ toolName: "geowiz.analyze", args: {} },
				{ toolName: "econobot.analyze", args: {} },
				{ toolName: "risk.analyze", args: {} },
			],
			undefined,
			{ minSuccessRatio: 0.5 },
		);

		assert.ok(result.degraded, "Expected degraded flag");
		assert.strictEqual(result.overallFailure, undefined, "Should NOT be overallFailure within threshold");
	});

	await test("executeParallel(): exceeds minSuccessRatio threshold — overallFailure set", async () => {
		const executor = new Executor();
		executor.setExecutorFn(makeSelectiveExecutor(new Set(["risk", "econobot"])));

		// 1 of 3 succeeds = 33% success; minSuccessRatio = 0.5 → exceeds threshold
		const result: GatheredResponse = await executor.executeParallel(
			[
				{ toolName: "geowiz.analyze", args: {} },
				{ toolName: "econobot.analyze", args: {} },
				{ toolName: "risk.analyze", args: {} },
			],
			undefined,
			{ minSuccessRatio: 0.5 },
		);

		assert.ok(result.degraded, "Expected degraded flag");
		assert.ok(result.overallFailure, "Expected overallFailure flag when threshold exceeded");
	});

	// ---------------------------------------------------------------------------
	// executeBundle() — degraded flag and manifest
	// ---------------------------------------------------------------------------

	await test("executeBundle(): degraded flag set when 1 optional step fails", async () => {
		const executor = new Executor();
		executor.setExecutorFn(makeSelectiveExecutor(new Set(["risk"])));

		const bundle = {
			name: "test-bundle",
			description: "test",
			gatherStrategy: "all" as const,
			steps: [
				{ toolName: "geowiz.analyze", args: {}, parallel: false, optional: false },
				{ toolName: "risk.analyze", args: {}, parallel: false, optional: true }, // optional — won't fail overallSuccess
			],
		};

		const result: BundleResponse = await executor.executeBundle(bundle);

		assert.ok(result.degraded, "Expected degraded flag on bundle result");
		assert.ok(result.degradationManifest, "Expected degradationManifest on bundle result");
		assert.ok(result.degradationManifest!.missingSections.includes("risk.analyze"));
	});

	await test("executeBundle(): no degraded flag when all steps succeed", async () => {
		const executor = new Executor();
		executor.setExecutorFn(makeSelectiveExecutor(new Set()));

		const bundle = {
			name: "test-bundle",
			description: "test",
			gatherStrategy: "all" as const,
			steps: [
				{ toolName: "geowiz.analyze", args: {}, parallel: false, optional: false },
				{ toolName: "econobot.analyze", args: {}, parallel: false, optional: false },
			],
		};

		const result: BundleResponse = await executor.executeBundle(bundle);

		assert.strictEqual(result.degraded, undefined);
		assert.strictEqual(result.degradationManifest, undefined);
	});

	await test("executeBundle(): works without options (backward compat)", async () => {
		const executor = new Executor();
		executor.setExecutorFn(makeSelectiveExecutor(new Set()));

		const bundle = {
			name: "test-bundle",
			description: "test",
			gatherStrategy: "all" as const,
			steps: [{ toolName: "geowiz.analyze", args: {}, parallel: false, optional: false }],
		};

		const result = await executor.executeBundle(bundle);
		assert.strictEqual(result.results.size, 1);
	});

	// ---------------------------------------------------------------------------
	// degradationManifest content
	// ---------------------------------------------------------------------------

	await test("degradationManifest includes completeness percentage", async () => {
		const executor = new Executor();
		executor.setExecutorFn(makeSelectiveExecutor(new Set(["risk"])));

		const result: GatheredResponse = await executor.executeParallel([
			{ toolName: "geowiz.analyze", args: {} },
			{ toolName: "econobot.analyze", args: {} },
			{ toolName: "risk.analyze", args: {} },
		]);

		assert.ok(result.degradationManifest, "Expected degradationManifest");
		assert.ok(
			typeof result.degradationManifest!.completeness === "number",
			"Expected numeric completeness in manifest",
		);
		// 2 of 3 succeeded = ~67%
		assert.ok(
			result.degradationManifest!.completeness > 60 && result.degradationManifest!.completeness < 70,
			`Expected ~67% completeness, got ${result.degradationManifest!.completeness}`,
		);
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
