/**
 * Kernel Fallback Tool Tests — Issue #149
 *
 * Verifies that the kernel automatically routes to a registered fallback tool
 * when the primary server fails after retries are exhausted.
 *
 * Acceptance criteria:
 *   1. Registry supports fallback mappings per tool
 *   2. Kernel automatically routes to fallback when primary is unavailable
 *   3. Audit log records when a fallback was used and why
 *   4. Results metadata indicates when output came from a fallback tool
 *   5. Fallbacks are opt-in and configurable per tool
 */

import assert from "node:assert";
import { Executor } from "../src/kernel/executor.js";
import { Registry } from "../src/kernel/registry.js";
import type { ToolResponse } from "../src/kernel/types.js";
import { ErrorType } from "../src/kernel/types.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
	return Promise.resolve()
		.then(() => fn())
		.then(() => {
			console.log(`  ✅ ${name}`);
			passed++;
		})
		.catch((err: unknown) => {
			console.error(`  ❌ ${name}: ${err instanceof Error ? err.message : String(err)}`);
			failed++;
		});
}

console.log("🧪 Starting Kernel Fallback Tool Tests (#149)\n");

// ==========================================
// Helpers
// ==========================================

function makeSuccessResponse(server: string): ToolResponse {
	return {
		success: true,
		summary: `${server} analysis complete`,
		confidence: 90,
		data: { server },
		detailLevel: "standard",
		completeness: 100,
		metadata: {
			server,
			persona: "test",
			executionTimeMs: 1,
			timestamp: new Date().toISOString(),
		},
	};
}

function makeRegistry(): Registry {
	const r = new Registry();
	r.registerServer({
		name: "geowiz",
		description: "Geology analysis",
		persona: "Marcus",
		domain: "geology",
		capabilities: ["geology"],
	});
	r.registerServer({
		name: "risk-analysis",
		description: "Risk analysis",
		persona: "Riscius",
		domain: "risk",
		capabilities: ["risk"],
	});
	return r;
}

// ==========================================
// 1. Registry: fallback registration API
// ==========================================

console.log("📋 Registry — fallback mapping API...");

await test("registerFallback() registers a fallback for a tool", () => {
	const registry = makeRegistry();
	// Primary: geowiz.analyze, Fallback: risk-analysis.analyze
	registry.registerFallback("geowiz.analyze", "risk-analysis.analyze");
	const fallback = registry.getFallback("geowiz.analyze");
	assert.strictEqual(fallback, "risk-analysis.analyze", "getFallback returns the registered fallback tool");
});

await test("getFallback returns undefined when no fallback registered", () => {
	const registry = makeRegistry();
	const fallback = registry.getFallback("geowiz.analyze");
	assert.strictEqual(fallback, undefined, "No fallback returns undefined");
});

await test("registerFallback supports multiple tools independently", () => {
	const registry = makeRegistry();
	registry.registerServer({
		name: "curve-smith",
		description: "Curve fitting",
		persona: "Curvius",
		domain: "geology",
		capabilities: ["curves"],
	});
	registry.registerFallback("geowiz.analyze", "risk-analysis.analyze");
	registry.registerFallback("risk-analysis.analyze", "curve-smith.analyze");

	assert.strictEqual(registry.getFallback("geowiz.analyze"), "risk-analysis.analyze");
	assert.strictEqual(registry.getFallback("risk-analysis.analyze"), "curve-smith.analyze");
	assert.strictEqual(registry.getFallback("curve-smith.analyze"), undefined, "curve-smith has no fallback");
});

await test("registerFallback is opt-in — tools without it have no fallback", () => {
	const registry = makeRegistry();
	// Only register fallback for geowiz, not risk-analysis
	registry.registerFallback("geowiz.analyze", "risk-analysis.analyze");
	assert.strictEqual(registry.getFallback("geowiz.analyze"), "risk-analysis.analyze");
	assert.strictEqual(registry.getFallback("risk-analysis.analyze"), undefined, "opt-in: risk-analysis has no fallback");
});

// ==========================================
// 2. Executor: automatic fallback routing
// ==========================================

console.log("\n⚙️ Executor — automatic fallback routing...");

await test("executor routes to fallback when primary fails", async () => {
	const registry = makeRegistry();
	registry.registerFallback("geowiz.analyze", "risk-analysis.analyze");

	const executor = new Executor();
	executor.setRegistry(registry);

	let primaryCalled = false;
	let fallbackCalled = false;

	executor.setExecutorFn(async (serverName: string) => {
		if (serverName === "geowiz") {
			primaryCalled = true;
			// Primary fails with a permanent error
			return {
				success: false,
				summary: "geowiz is down",
				confidence: 0,
				data: null,
				detailLevel: "standard" as const,
				completeness: 0,
				metadata: {
					server: "geowiz",
					persona: "Marcus",
					executionTimeMs: 1,
					timestamp: new Date().toISOString(),
				},
				error: { type: ErrorType.PERMANENT, message: "geowiz is down" },
			};
		}
		// Fallback succeeds
		fallbackCalled = true;
		return makeSuccessResponse(serverName);
	});

	const result = await executor.execute({ toolName: "geowiz.analyze", args: {} });

	assert.ok(primaryCalled, "Primary (geowiz) was attempted");
	assert.ok(fallbackCalled, "Fallback (risk-analysis) was called after primary failed");
	assert.ok(result.success, "Result is successful (from fallback)");
});

await test("result metadata flags usedFallback = true when fallback was invoked", async () => {
	const registry = makeRegistry();
	registry.registerFallback("geowiz.analyze", "risk-analysis.analyze");

	const executor = new Executor();
	executor.setRegistry(registry);

	executor.setExecutorFn(async (serverName: string) => {
		if (serverName === "geowiz") {
			return {
				success: false,
				summary: "down",
				confidence: 0,
				data: null,
				detailLevel: "standard" as const,
				completeness: 0,
				metadata: { server: "geowiz", persona: "Marcus", executionTimeMs: 1, timestamp: new Date().toISOString() },
				error: { type: ErrorType.PERMANENT, message: "down" },
			};
		}
		return makeSuccessResponse(serverName);
	});

	const result = await executor.execute({ toolName: "geowiz.analyze", args: {} });

	assert.ok(result.metadata.usedFallback === true, "metadata.usedFallback is true");
	assert.ok(
		typeof result.metadata.originalTool === "string",
		`metadata.originalTool is set (got ${result.metadata.originalTool})`,
	);
	assert.strictEqual(result.metadata.originalTool, "geowiz.analyze", "originalTool records the primary tool name");
});

await test("result metadata flags fallbackTool with the actual fallback used", async () => {
	const registry = makeRegistry();
	registry.registerFallback("geowiz.analyze", "risk-analysis.analyze");

	const executor = new Executor();
	executor.setRegistry(registry);

	executor.setExecutorFn(async (serverName: string) => {
		if (serverName === "geowiz") {
			return {
				success: false,
				summary: "down",
				confidence: 0,
				data: null,
				detailLevel: "standard" as const,
				completeness: 0,
				metadata: { server: "geowiz", persona: "Marcus", executionTimeMs: 1, timestamp: new Date().toISOString() },
				error: { type: ErrorType.PERMANENT, message: "down" },
			};
		}
		return makeSuccessResponse(serverName);
	});

	const result = await executor.execute({ toolName: "geowiz.analyze", args: {} });

	assert.strictEqual(result.metadata.fallbackTool, "risk-analysis.analyze", "metadata.fallbackTool is set correctly");
});

await test("executor does NOT use fallback when primary succeeds", async () => {
	const registry = makeRegistry();
	registry.registerFallback("geowiz.analyze", "risk-analysis.analyze");

	const executor = new Executor();
	executor.setRegistry(registry);

	let fallbackCalled = false;
	executor.setExecutorFn(async (serverName: string) => {
		if (serverName === "risk-analysis") fallbackCalled = true;
		return makeSuccessResponse(serverName);
	});

	const result = await executor.execute({ toolName: "geowiz.analyze", args: {} });

	assert.ok(result.success, "Result is successful");
	assert.ok(!fallbackCalled, "Fallback was NOT called when primary succeeded");
	assert.ok(!result.metadata.usedFallback, "metadata.usedFallback is falsy when primary succeeded");
});

await test("executor returns primary failure when no fallback is registered", async () => {
	const registry = makeRegistry();
	// No fallback registered for geowiz

	const executor = new Executor();
	executor.setRegistry(registry);

	executor.setExecutorFn(async (_serverName: string) => {
		return {
			success: false,
			summary: "down",
			confidence: 0,
			data: null,
			detailLevel: "standard" as const,
			completeness: 0,
			metadata: { server: "geowiz", persona: "Marcus", executionTimeMs: 1, timestamp: new Date().toISOString() },
			error: { type: ErrorType.PERMANENT, message: "down" },
		};
	});

	const result = await executor.execute({ toolName: "geowiz.analyze", args: {} });

	assert.ok(!result.success, "Returns failure when no fallback available");
	assert.ok(!result.metadata.usedFallback, "usedFallback is not set on primary-only failure");
});

await test("executor passes original args to fallback", async () => {
	const registry = makeRegistry();
	registry.registerFallback("geowiz.analyze", "risk-analysis.analyze");

	const executor = new Executor();
	executor.setRegistry(registry);

	let capturedArgs: Record<string, unknown> = {};
	executor.setExecutorFn(async (serverName: string, args: Record<string, unknown>) => {
		if (serverName === "geowiz") {
			return {
				success: false,
				summary: "down",
				confidence: 0,
				data: null,
				detailLevel: "standard" as const,
				completeness: 0,
				metadata: { server: "geowiz", persona: "Marcus", executionTimeMs: 1, timestamp: new Date().toISOString() },
				error: { type: ErrorType.PERMANENT, message: "down" },
			};
		}
		capturedArgs = args;
		return makeSuccessResponse(serverName);
	});

	await executor.execute({ toolName: "geowiz.analyze", args: { well_name: "test-well-1" } });
	assert.strictEqual(capturedArgs.well_name, "test-well-1", "Fallback receives original args");
});

// ==========================================
// 3. Fallback with retries — fallback fires after retries exhausted
// ==========================================

console.log("\n🔁 Fallback fires after retries exhausted...");

await test("fallback is tried only after all retries on primary are exhausted", async () => {
	const registry = makeRegistry();
	registry.registerFallback("geowiz.analyze", "risk-analysis.analyze");

	const executor = new Executor({ maxRetries: 2, retryBackoffMs: 0 });
	executor.setRegistry(registry);

	let primaryAttempts = 0;
	let fallbackCalled = false;

	executor.setExecutorFn(async (serverName: string) => {
		if (serverName === "geowiz") {
			primaryAttempts++;
			return {
				success: false,
				summary: "retryable failure",
				confidence: 0,
				data: null,
				detailLevel: "standard" as const,
				completeness: 0,
				metadata: { server: "geowiz", persona: "Marcus", executionTimeMs: 1, timestamp: new Date().toISOString() },
				// Retryable so retry logic kicks in before fallback
				error: { type: ErrorType.RETRYABLE, message: "retryable failure" },
			};
		}
		fallbackCalled = true;
		return makeSuccessResponse(serverName);
	});

	const result = await executor.execute({ toolName: "geowiz.analyze", args: {} });

	// maxRetries=2 means 3 attempts total (0, 1, 2)
	assert.strictEqual(primaryAttempts, 3, `Primary attempted 3 times (got ${primaryAttempts})`);
	assert.ok(fallbackCalled, "Fallback called after retries exhausted");
	assert.ok(result.success, "Final result is successful (from fallback)");
});

// ==========================================
// 4. Audit: fallback usage recorded
// ==========================================

console.log("\n📜 Audit — fallback usage surfaced...");

await test("getFallbackUsage() returns an empty array when no fallbacks have fired", () => {
	const executor = new Executor();
	assert.deepStrictEqual(executor.getFallbackUsage(), [], "No fallback usage initially");
});

await test("getFallbackUsage() records each fallback invocation with tool names and reason", async () => {
	const registry = makeRegistry();
	registry.registerFallback("geowiz.analyze", "risk-analysis.analyze");

	const executor = new Executor();
	executor.setRegistry(registry);

	executor.setExecutorFn(async (serverName: string) => {
		if (serverName === "geowiz") {
			return {
				success: false,
				summary: "down",
				confidence: 0,
				data: null,
				detailLevel: "standard" as const,
				completeness: 0,
				metadata: { server: "geowiz", persona: "Marcus", executionTimeMs: 1, timestamp: new Date().toISOString() },
				error: { type: ErrorType.PERMANENT, message: "service unavailable" },
			};
		}
		return makeSuccessResponse(serverName);
	});

	await executor.execute({ toolName: "geowiz.analyze", args: {} });

	const usage = executor.getFallbackUsage();
	assert.strictEqual(usage.length, 1, "One fallback usage recorded");
	assert.strictEqual(usage[0].primaryTool, "geowiz.analyze", "primaryTool recorded");
	assert.strictEqual(usage[0].fallbackTool, "risk-analysis.analyze", "fallbackTool recorded");
	assert.ok(typeof usage[0].reason === "string" && usage[0].reason.length > 0, "reason is non-empty string");
	assert.ok(typeof usage[0].timestamp === "string", "timestamp recorded");
});

await test("getFallbackUsage() accumulates across multiple execute() calls", async () => {
	const registry = makeRegistry();
	registry.registerFallback("geowiz.analyze", "risk-analysis.analyze");

	const executor = new Executor();
	executor.setRegistry(registry);

	executor.setExecutorFn(async (serverName: string) => {
		if (serverName === "geowiz") {
			return {
				success: false,
				summary: "down",
				confidence: 0,
				data: null,
				detailLevel: "standard" as const,
				completeness: 0,
				metadata: { server: "geowiz", persona: "Marcus", executionTimeMs: 1, timestamp: new Date().toISOString() },
				error: { type: ErrorType.PERMANENT, message: "down" },
			};
		}
		return makeSuccessResponse(serverName);
	});

	await executor.execute({ toolName: "geowiz.analyze", args: {} });
	await executor.execute({ toolName: "geowiz.analyze", args: {} });

	assert.strictEqual(executor.getFallbackUsage().length, 2, "Two fallback usages recorded");
});

// ==========================================
// Summary
// ==========================================

console.log(`\n${"=".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
	process.exit(1);
}
