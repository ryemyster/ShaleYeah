/**
 * Kernel Executor Tests — Wave 3
 *
 * Tests for single execution, scatter-gather parallel execution,
 * task bundles, phase resolution, and idempotency keys.
 */

import { FULL_DUE_DILIGENCE_BUNDLE, QUICK_SCREEN_BUNDLE } from "../src/kernel/bundles.js";
import { DEMO_IDENTITY, Session, SessionManager } from "../src/kernel/context.js";
import { Executor } from "../src/kernel/executor.js";
import { Kernel } from "../src/kernel/index.js";
import type { TaskBundle, ToolRequest, ToolResponse } from "../src/kernel/types.js";

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

console.log("🧪 Starting Kernel Executor Tests (Wave 3)\n");

// ==========================================
// Mock tool executor
// ==========================================

/** Simulate a server call with configurable delay and optional failure */
function mockExecutorFn(
	delays: Record<string, number> = {},
	failures: Set<string> = new Set(),
): (serverName: string, args: Record<string, unknown>) => Promise<ToolResponse> {
	return async (serverName: string, args: Record<string, unknown>): Promise<ToolResponse> => {
		const delay = delays[serverName] ?? 5;
		await new Promise((resolve) => setTimeout(resolve, delay));

		if (failures.has(serverName)) {
			return {
				success: false,
				summary: `${serverName} failed`,
				confidence: 0,
				data: null,
				detailLevel: "standard",
				completeness: 0,
				metadata: {
					server: serverName,
					persona: `${serverName}-persona`,
					executionTimeMs: delay,
					timestamp: new Date().toISOString(),
				},
				error: {
					type: "permanent" as any,
					message: `Mock failure for ${serverName}`,
				},
			};
		}

		return {
			success: true,
			summary: `${serverName} analysis complete`,
			confidence: 85 + Math.floor(Math.random() * 10),
			data: { server: serverName, result: "mock-data", ...args },
			detailLevel: "standard",
			completeness: 100,
			metadata: {
				server: serverName,
				persona: `${serverName}-persona`,
				executionTimeMs: delay,
				timestamp: new Date().toISOString(),
			},
		};
	};
}

// ==========================================
// Test: Executor without executorFn returns error
// ==========================================

console.log("🚫 Testing executor without connection...");
{
	const executor = new Executor();
	const result = await executor.execute({
		toolName: "geowiz.analyze",
		args: {},
	});
	assert(result.success === false, "Returns error when not connected");
	assert(result.error?.message.includes("not connected"), "Error message mentions not connected");
}

// ==========================================
// Test: Single tool execution
// ==========================================

console.log("\n🔧 Testing single tool execution...");
{
	const executor = new Executor();
	executor.setExecutorFn(mockExecutorFn());

	const result = await executor.execute({
		toolName: "geowiz.analyze",
		args: { tract: "test-tract" },
	});

	assert(result.success === true, "Single execution succeeds");
	assert(result.metadata.server === "geowiz", "Server name extracted correctly");
	assert(result.confidence > 0, "Confidence is positive");
	const data = result.data as Record<string, unknown>;
	assert(data.server === "geowiz", "Data includes server name");
	assert(data.tract === "test-tract", "Args passed through to executor");
}

// ==========================================
// Test: Single tool execution failure
// ==========================================

console.log("\n💥 Testing single tool execution failure...");
{
	const executor = new Executor();
	executor.setExecutorFn(mockExecutorFn({}, new Set(["geowiz"])));

	const result = await executor.execute({
		toolName: "geowiz.analyze",
		args: {},
	});

	assert(result.success === false, "Failed execution returns success=false");
	assert(result.error !== undefined, "Error detail is present");
}

// ==========================================
// Test: Parallel execution (scatter-gather)
// ==========================================

console.log("\n⚡ Testing parallel execution (scatter-gather)...");
{
	const executor = new Executor();
	// Each server takes 20ms — parallel should be ~20ms total, sequential would be 80ms+
	executor.setExecutorFn(
		mockExecutorFn({
			geowiz: 20,
			econobot: 20,
			"curve-smith": 20,
			"risk-analysis": 20,
		}),
	);

	const requests: ToolRequest[] = [
		{ toolName: "geowiz.analyze", args: {} },
		{ toolName: "econobot.analyze", args: {} },
		{ toolName: "curve-smith.analyze", args: {} },
		{ toolName: "risk-analysis.analyze", args: {} },
	];

	const startMs = Date.now();
	const gathered = await executor.executeParallel(requests);
	const elapsed = Date.now() - startMs;

	assert(gathered.results.size === 4, `All 4 results collected (got ${gathered.results.size})`);
	assert(gathered.completeness === 100, `Completeness is 100% (got ${gathered.completeness})`);
	assert(gathered.failures.length === 0, "No failures");
	assert(gathered.totalTimeMs > 0, "Total time is tracked");

	// Parallel should be significantly less than 4 * 20ms = 80ms
	// Allow some overhead but it should be well under sequential time
	assert(elapsed < 70, `Parallel execution is faster than sequential (${elapsed}ms < 70ms)`);
}

// ==========================================
// Test: Scatter-gather with partial failure
// ==========================================

console.log("\n⚠️ Testing scatter-gather with partial failure...");
{
	const executor = new Executor();
	executor.setExecutorFn(mockExecutorFn({}, new Set(["econobot"])));

	const requests: ToolRequest[] = [
		{ toolName: "geowiz.analyze", args: {} },
		{ toolName: "econobot.analyze", args: {} },
		{ toolName: "curve-smith.analyze", args: {} },
		{ toolName: "risk-analysis.analyze", args: {} },
	];

	const gathered = await executor.executeParallel(requests);

	assert(gathered.results.size === 4, `All 4 results present (got ${gathered.results.size})`);
	assert(gathered.completeness === 75, `Completeness is 75% (got ${gathered.completeness})`);
	assert(gathered.failures.length === 1, `One failure reported (got ${gathered.failures.length})`);
	assert(gathered.failures[0].toolName === "econobot.analyze", "Failure identifies correct tool");

	// Successful tools still have their results
	const geowizResult = gathered.results.get("geowiz.analyze");
	assert(geowizResult?.success === true, "Successful tools are not blocked by failures");
}

// ==========================================
// Test: Idempotency key generation
// ==========================================

console.log("\n🔑 Testing idempotency key generation...");
{
	const executor = new Executor();

	const key1 = executor.generateIdempotencyKey("geowiz.analyze", { tract: "permian-123", depth: 5000 }, "session-abc");
	const key2 = executor.generateIdempotencyKey("geowiz.analyze", { tract: "permian-123", depth: 5000 }, "session-abc");
	const key3 = executor.generateIdempotencyKey(
		"geowiz.analyze",
		{ depth: 5000, tract: "permian-123" }, // args in different order
		"session-abc",
	);
	const key4 = executor.generateIdempotencyKey("geowiz.analyze", { tract: "permian-456" }, "session-abc");
	const key5 = executor.generateIdempotencyKey(
		"econobot.analyze",
		{ tract: "permian-123", depth: 5000 },
		"session-abc",
	);

	assert(key1.length === 16, `Key is 16 hex chars (got ${key1.length})`);
	assert(key1 === key2, "Same inputs produce same key (deterministic)");
	assert(key1 === key3, "Arg order doesn't matter (sorted internally)");
	assert(key1 !== key4, "Different args produce different key");
	assert(key1 !== key5, "Different tool name produces different key");
}

// ==========================================
// Test: Quick Screen bundle definition
// ==========================================

console.log("\n📋 Testing Quick Screen bundle definition...");
{
	assert(QUICK_SCREEN_BUNDLE.name === "quick_screen", "Bundle name is quick_screen");
	assert(QUICK_SCREEN_BUNDLE.steps.length === 4, `Bundle has 4 steps (got ${QUICK_SCREEN_BUNDLE.steps.length})`);
	assert(QUICK_SCREEN_BUNDLE.gatherStrategy === "all", "Gather strategy is all");

	const toolNames = QUICK_SCREEN_BUNDLE.steps.map((s) => s.toolName);
	assert(toolNames.includes("geowiz.analyze"), "Includes geowiz");
	assert(toolNames.includes("econobot.analyze"), "Includes econobot");
	assert(toolNames.includes("curve-smith.analyze"), "Includes curve-smith");
	assert(toolNames.includes("risk-analysis.analyze"), "Includes risk-analysis");

	assert(
		QUICK_SCREEN_BUNDLE.steps.every((s) => s.parallel),
		"All quick screen steps are parallel",
	);
	assert(
		QUICK_SCREEN_BUNDLE.steps.every((s) => !s.optional),
		"All quick screen steps are required",
	);
	assert(
		QUICK_SCREEN_BUNDLE.steps.every((s) => s.detailLevel === "summary"),
		"All quick screen steps use summary detail level",
	);
}

// ==========================================
// Test: Full Due Diligence bundle definition
// ==========================================

console.log("\n📋 Testing Full Due Diligence bundle definition...");
{
	assert(FULL_DUE_DILIGENCE_BUNDLE.name === "full_due_diligence", "Bundle name is full_due_diligence");
	assert(
		FULL_DUE_DILIGENCE_BUNDLE.steps.length === 14,
		`Bundle has 14 steps (got ${FULL_DUE_DILIGENCE_BUNDLE.steps.length})`,
	);
	assert(FULL_DUE_DILIGENCE_BUNDLE.gatherStrategy === "majority", "Gather strategy is majority");

	// Verify phase 1 steps have no dependencies
	const phase1Tools = [
		"geowiz.analyze",
		"econobot.analyze",
		"curve-smith.analyze",
		"market.analyze",
		"research.analyze",
	];
	for (const tool of phase1Tools) {
		const step = FULL_DUE_DILIGENCE_BUNDLE.steps.find((s) => s.toolName === tool);
		assert(step !== undefined, `Phase 1 includes ${tool}`);
		assert(!step?.dependsOn || step.dependsOn.length === 0, `${tool} has no dependencies (phase 1)`);
	}

	// Verify phase 2 depends on phase 1
	const riskStep = FULL_DUE_DILIGENCE_BUNDLE.steps.find((s) => s.toolName === "risk-analysis.analyze");
	assert(riskStep !== undefined, "Risk-analysis step exists");
	assert(riskStep!.dependsOn!.includes("geowiz.analyze"), "Risk-analysis depends on geowiz");
	assert(riskStep!.dependsOn!.includes("econobot.analyze"), "Risk-analysis depends on econobot");

	// Verify reporter/decision are sequential and depend on earlier phases
	const reporterStep = FULL_DUE_DILIGENCE_BUNDLE.steps.find((s) => s.toolName === "reporter.analyze");
	const decisionStep = FULL_DUE_DILIGENCE_BUNDLE.steps.find((s) => s.toolName === "decision.analyze");
	assert(reporterStep?.parallel === false, "Reporter is sequential");
	assert(decisionStep?.parallel === false, "Decision is sequential");
	assert(decisionStep!.dependsOn!.includes("reporter.analyze"), "Decision depends on reporter");
}

// ==========================================
// Test: Phase resolution from dependency graph
// ==========================================

console.log("\n🔀 Testing phase resolution...");
{
	const executor = new Executor();

	// Quick screen: all parallel with no deps → single phase
	const qsPhases = executor.resolvePhases(QUICK_SCREEN_BUNDLE.steps);
	assert(qsPhases.length === 1, `Quick screen resolves to 1 phase (got ${qsPhases.length})`);
	assert(qsPhases[0].length === 4, `Phase 1 has all 4 steps (got ${qsPhases[0].length})`);

	// Full due diligence: multiple phases
	const fddPhases = executor.resolvePhases(FULL_DUE_DILIGENCE_BUNDLE.steps);
	assert(fddPhases.length >= 4, `Full DD resolves to ≥4 phases (got ${fddPhases.length})`);

	// Phase 1 should include the 5 no-dependency tools
	const phase1Names = fddPhases[0].map((s) => s.toolName);
	assert(phase1Names.includes("geowiz.analyze"), "Phase 1 includes geowiz");
	assert(phase1Names.includes("econobot.analyze"), "Phase 1 includes econobot");
	assert(phase1Names.includes("curve-smith.analyze"), "Phase 1 includes curve-smith");

	// Last phase should include decision (depends on reporter)
	const lastPhase = fddPhases[fddPhases.length - 1];
	const lastPhaseNames = lastPhase.map((s) => s.toolName);
	assert(lastPhaseNames.includes("decision.analyze"), "Last phase includes decision");
}

// ==========================================
// Test: Bundle execution — Quick Screen
// ==========================================

console.log("\n🚀 Testing Quick Screen bundle execution...");
{
	const executor = new Executor();
	executor.setExecutorFn(
		mockExecutorFn({
			geowiz: 10,
			econobot: 10,
			"curve-smith": 10,
			"risk-analysis": 10,
		}),
	);

	const result = await executor.executeBundle(QUICK_SCREEN_BUNDLE, {
		tract: "permian-test",
	});

	assert(result.bundleName === "quick_screen", "Bundle name is correct");
	assert(result.results.size === 4, `All 4 results collected (got ${result.results.size})`);
	assert(result.completeness === 100, `Completeness is 100% (got ${result.completeness})`);
	assert(result.overallSuccess === true, "Overall success is true");
	assert(result.phases.length === 1, `1 execution phase (got ${result.phases.length})`);
	assert(result.totalTimeMs > 0, "Total time tracked");

	// Verify tract args were passed through
	const geowizData = result.results.get("geowiz.analyze")?.data as Record<string, unknown>;
	assert(geowizData?.tract === "permian-test", "Tract args passed through to tools");
}

// ==========================================
// Test: Bundle execution with partial failure
// ==========================================

console.log("\n⚠️ Testing bundle execution with partial failure...");
{
	const executor = new Executor();
	executor.setExecutorFn(mockExecutorFn({}, new Set(["econobot"])));

	const result = await executor.executeBundle(QUICK_SCREEN_BUNDLE);

	// Quick screen has gatherStrategy "all" and all steps required
	assert(result.overallSuccess === false, "Quick screen fails when a required step fails");
	assert(result.completeness === 75, `Completeness is 75% (got ${result.completeness})`);
	assert(result.results.size === 4, "All results still collected (success + failure)");

	// Successful tools are still available
	const geowiz = result.results.get("geowiz.analyze");
	assert(geowiz?.success === true, "Geowiz succeeded despite econobot failure");
}

// ==========================================
// Test: Kernel wires executor correctly
// ==========================================

console.log("\n🧠 Testing Kernel executor integration...");
{
	const kernel = new Kernel();
	kernel.setExecutorFn(mockExecutorFn());

	const result = await kernel.execute({
		toolName: "geowiz.analyze",
		args: { tract: "kernel-test" },
	});

	assert(result.success === true, "Kernel.execute() works");

	const data = result.data as Record<string, unknown>;
	assert(data.tract === "kernel-test", "Args passed through Kernel");
}

// ==========================================
// Test: Kernel quickScreen
// ==========================================

console.log("\n🏎️ Testing Kernel.quickScreen()...");
{
	const kernel = new Kernel();
	kernel.setExecutorFn(mockExecutorFn());

	const result = await kernel.quickScreen({ tract: "quick-test" });

	assert(result.bundleName === "quick_screen", "quickScreen uses correct bundle");
	assert(result.results.size === 4, `4 results from quickScreen (got ${result.results.size})`);
	assert(result.overallSuccess === true, "quickScreen succeeds");
}

// ==========================================
// Test: Kernel generateIdempotencyKey
// ==========================================

console.log("\n🔑 Testing Kernel.generateIdempotencyKey()...");
{
	const kernel = new Kernel();

	const key1 = kernel.generateIdempotencyKey("geowiz.analyze", { x: 1 }, "s1");
	const key2 = kernel.generateIdempotencyKey("geowiz.analyze", { x: 1 }, "s1");

	assert(key1 === key2, "Kernel idempotency keys are deterministic");
	assert(typeof key1 === "string" && key1.length === 16, "Key is 16 char hex string");
}

// ==========================================
// Test: Timeout handling
// ==========================================

console.log("\n⏱️ Testing timeout handling...");
{
	const executor = new Executor({ toolTimeoutMs: 30 });
	executor.setExecutorFn(async () => {
		// Simulate a slow server that takes 200ms
		await new Promise((resolve) => setTimeout(resolve, 200));
		return {
			success: true,
			summary: "should not reach",
			confidence: 100,
			data: {},
			detailLevel: "standard" as const,
			completeness: 100,
			metadata: {
				server: "slow",
				persona: "slow",
				executionTimeMs: 200,
				timestamp: new Date().toISOString(),
			},
		};
	});

	const result = await executor.execute({
		toolName: "slow.analyze",
		args: {},
	});

	assert(result.success === false, "Timed-out execution returns failure");
	assert(result.error?.message.includes("timed out"), "Error message mentions timeout");
	assert(result.error?.type === "retryable", "Timeout is classified as retryable");
}

// ==========================================
// Test: maxParallel chunking
// ==========================================

console.log("\n📦 Testing maxParallel chunking...");
{
	let concurrentCount = 0;
	let maxConcurrent = 0;

	const executor = new Executor({ maxParallel: 2 });
	executor.setExecutorFn(async (serverName, _args) => {
		concurrentCount++;
		if (concurrentCount > maxConcurrent) maxConcurrent = concurrentCount;
		await new Promise((resolve) => setTimeout(resolve, 20));
		concurrentCount--;
		return {
			success: true,
			summary: `${serverName} done`,
			confidence: 90,
			data: { server: serverName },
			detailLevel: "standard" as const,
			completeness: 100,
			metadata: {
				server: serverName,
				persona: serverName,
				executionTimeMs: 20,
				timestamp: new Date().toISOString(),
			},
		};
	});

	const requests: ToolRequest[] = [
		{ toolName: "a.analyze", args: {} },
		{ toolName: "b.analyze", args: {} },
		{ toolName: "c.analyze", args: {} },
		{ toolName: "d.analyze", args: {} },
	];

	const result = await executor.executeParallel(requests);

	assert(result.results.size === 4, "All 4 results collected with chunking");
	assert(maxConcurrent <= 2, `Max concurrency ≤ 2 (got ${maxConcurrent})`);
}

// ==========================================
// Test: Retry — retryable error retried up to maxRetries then fails
// ==========================================

console.log("\n🔄 Testing retry — retryable error exhausts max retries...");
{
	let callCount = 0;
	const executor = new Executor({ maxRetries: 2, retryBackoffMs: 10 });
	executor.setExecutorFn(async (serverName) => {
		callCount++;
		return {
			success: false,
			summary: `${serverName} rate limit exceeded`,
			confidence: 0,
			data: null,
			detailLevel: "standard" as const,
			completeness: 0,
			metadata: {
				server: serverName,
				persona: serverName,
				executionTimeMs: 0,
				timestamp: new Date().toISOString(),
			},
			error: {
				type: "retryable" as any,
				message: "429 too many requests",
			},
		};
	});

	const result = await executor.execute({ toolName: "geowiz.analyze", args: {} });

	assert(result.success === false, "Retry-exhausted execution returns failure");
	assert(callCount === 3, `Called 3 times (1 initial + 2 retries), got ${callCount}`);
	assert(result.metadata.retryAttempts !== undefined, "Retry metadata is present on failure");
	assert((result.metadata.totalRetryDelayMs ?? 0) > 0, "Total retry delay tracked");
}

// ==========================================
// Test: Retry — succeeds on 2nd attempt
// ==========================================

console.log("\n🔄 Testing retry — succeeds on second attempt...");
{
	let callCount = 0;
	const executor = new Executor({ maxRetries: 3, retryBackoffMs: 10 });
	executor.setExecutorFn(async (serverName) => {
		callCount++;
		if (callCount === 1) {
			return {
				success: false,
				summary: `${serverName} timeout`,
				confidence: 0,
				data: null,
				detailLevel: "standard" as const,
				completeness: 0,
				metadata: {
					server: serverName,
					persona: serverName,
					executionTimeMs: 0,
					timestamp: new Date().toISOString(),
				},
				error: {
					type: "retryable" as any,
					message: "timeout connecting to server",
				},
			};
		}
		return {
			success: true,
			summary: `${serverName} analysis complete`,
			confidence: 90,
			data: { server: serverName },
			detailLevel: "standard" as const,
			completeness: 100,
			metadata: {
				server: serverName,
				persona: serverName,
				executionTimeMs: 5,
				timestamp: new Date().toISOString(),
			},
		};
	});

	const result = await executor.execute({ toolName: "geowiz.analyze", args: {} });

	assert(result.success === true, "Succeeds after retry");
	assert(callCount === 2, `Called exactly 2 times, got ${callCount}`);
	assert(result.metadata.retryAttempts === 1, `retryAttempts is 1, got ${result.metadata.retryAttempts}`);
	assert((result.metadata.totalRetryDelayMs ?? 0) > 0, "Total retry delay tracked on success");
}

// ==========================================
// Test: Retry — permanent errors NOT retried
// ==========================================

console.log("\n🔄 Testing retry — permanent errors not retried...");
{
	let callCount = 0;
	const executor = new Executor({ maxRetries: 3, retryBackoffMs: 10 });
	executor.setExecutorFn(async (serverName) => {
		callCount++;
		return {
			success: false,
			summary: `${serverName} validation error`,
			confidence: 0,
			data: null,
			detailLevel: "standard" as const,
			completeness: 0,
			metadata: {
				server: serverName,
				persona: serverName,
				executionTimeMs: 0,
				timestamp: new Date().toISOString(),
			},
			error: {
				type: "permanent" as any,
				message: "invalid schema: missing required field",
			},
		};
	});

	const result = await executor.execute({ toolName: "geowiz.analyze", args: {} });

	assert(result.success === false, "Permanent error returns failure");
	assert(callCount === 1, `Permanent error not retried — called ${callCount} time(s)`);
}

// ==========================================
// Test: Retry — auth errors NOT retried
// ==========================================

console.log("\n🔄 Testing retry — auth errors not retried...");
{
	let callCount = 0;
	const executor = new Executor({ maxRetries: 3, retryBackoffMs: 10 });
	executor.setExecutorFn(async (serverName) => {
		callCount++;
		return {
			success: false,
			summary: `${serverName} auth failed`,
			confidence: 0,
			data: null,
			detailLevel: "standard" as const,
			completeness: 0,
			metadata: {
				server: serverName,
				persona: serverName,
				executionTimeMs: 0,
				timestamp: new Date().toISOString(),
			},
			error: {
				type: "auth_required" as any,
				message: "401 unauthorized — api key expired",
			},
		};
	});

	const result = await executor.execute({ toolName: "geowiz.analyze", args: {} });

	assert(result.success === false, "Auth error returns failure");
	assert(callCount === 1, `Auth error not retried — called ${callCount} time(s)`);
}

// ==========================================
// Test: Retry — user_action errors NOT retried
// ==========================================

console.log("\n🔄 Testing retry — user_action errors not retried...");
{
	let callCount = 0;
	const executor = new Executor({ maxRetries: 3, retryBackoffMs: 10 });
	executor.setExecutorFn(async (serverName) => {
		callCount++;
		return {
			success: false,
			summary: `${serverName} missing data`,
			confidence: 0,
			data: null,
			detailLevel: "standard" as const,
			completeness: 0,
			metadata: {
				server: serverName,
				persona: serverName,
				executionTimeMs: 0,
				timestamp: new Date().toISOString(),
			},
			error: {
				type: "user_action" as any,
				message: "file not found — please provide input data",
			},
		};
	});

	const result = await executor.execute({ toolName: "geowiz.analyze", args: {} });

	assert(result.success === false, "User action error returns failure");
	assert(callCount === 1, `User action error not retried — called ${callCount} time(s)`);
}

// ==========================================
// Test: Retry — exponential backoff timing
// ==========================================

console.log("\n🔄 Testing retry — exponential backoff increases delays...");
{
	const timestamps: number[] = [];
	const executor = new Executor({ maxRetries: 2, retryBackoffMs: 50 });
	executor.setExecutorFn(async (serverName) => {
		timestamps.push(Date.now());
		return {
			success: false,
			summary: `${serverName} connection reset`,
			confidence: 0,
			data: null,
			detailLevel: "standard" as const,
			completeness: 0,
			metadata: {
				server: serverName,
				persona: serverName,
				executionTimeMs: 0,
				timestamp: new Date().toISOString(),
			},
			error: {
				type: "retryable" as any,
				message: "ECONNRESET connection reset by peer",
			},
		};
	});

	await executor.execute({ toolName: "geowiz.analyze", args: {} });

	assert(timestamps.length === 3, `3 attempts recorded, got ${timestamps.length}`);

	// First retry delay (attempt 0): baseDelay * 2^0 + jitter = ~50-65ms
	// Second retry delay (attempt 1): baseDelay * 2^1 + jitter = ~100-130ms
	const delay1 = timestamps[1] - timestamps[0];
	const delay2 = timestamps[2] - timestamps[1];

	assert(delay1 >= 40, `First delay ≥ 40ms (got ${delay1}ms)`);
	assert(
		delay2 > delay1 * 1.3,
		`Second delay > 1.3x first delay (${delay2}ms > ${Math.round(delay1 * 1.3)}ms) — exponential backoff`,
	);
}

// ==========================================
// Test: Retry — thrown errors (exceptions) retried if retryable
// ==========================================

console.log("\n🔄 Testing retry — thrown timeout exceptions retried...");
{
	let callCount = 0;
	const executor = new Executor({ maxRetries: 1, retryBackoffMs: 10, toolTimeoutMs: 15 });
	executor.setExecutorFn(async (serverName) => {
		callCount++;
		if (callCount <= 1) {
			// First call times out
			await new Promise((resolve) => setTimeout(resolve, 200));
		}
		return {
			success: true,
			summary: `${serverName} done`,
			confidence: 90,
			data: { server: serverName },
			detailLevel: "standard" as const,
			completeness: 100,
			metadata: {
				server: serverName,
				persona: serverName,
				executionTimeMs: 5,
				timestamp: new Date().toISOString(),
			},
		};
	});

	const result = await executor.execute({ toolName: "geowiz.analyze", args: {} });

	assert(result.success === true, "Succeeds after timeout retry");
	assert(callCount === 2, `Called 2 times (timeout + success), got ${callCount}`);
}

// ==========================================
// Test: Retry — no retries when maxRetries is 0
// ==========================================

console.log("\n🔄 Testing retry — maxRetries=0 means no retries...");
{
	let callCount = 0;
	const executor = new Executor({ maxRetries: 0, retryBackoffMs: 10 });
	executor.setExecutorFn(async (serverName) => {
		callCount++;
		return {
			success: false,
			summary: `${serverName} timeout`,
			confidence: 0,
			data: null,
			detailLevel: "standard" as const,
			completeness: 0,
			metadata: {
				server: serverName,
				persona: serverName,
				executionTimeMs: 0,
				timestamp: new Date().toISOString(),
			},
			error: {
				type: "retryable" as any,
				message: "timeout — timed out",
			},
		};
	});

	const result = await executor.execute({ toolName: "geowiz.analyze", args: {} });

	assert(result.success === false, "Fails without retry when maxRetries=0");
	assert(callCount === 1, `Called exactly once, got ${callCount}`);
}

// ==========================================
// Test: Retry — Kernel wires retry config from resilience config
// ==========================================

console.log("\n🔄 Testing retry — Kernel passes resilience config to executor...");
{
	let callCount = 0;
	const kernel = new Kernel({
		resilience: { maxRetries: 1, retryBackoffMs: 10, gracefulDegradation: true, minCompleteness: 0.5 },
	});
	kernel.setExecutorFn(async (serverName) => {
		callCount++;
		if (callCount === 1) {
			return {
				success: false,
				summary: `${serverName} unavailable`,
				confidence: 0,
				data: null,
				detailLevel: "standard" as const,
				completeness: 0,
				metadata: {
					server: serverName,
					persona: serverName,
					executionTimeMs: 0,
					timestamp: new Date().toISOString(),
				},
				error: {
					type: "retryable" as any,
					message: "503 service unavailable",
				},
			};
		}
		return {
			success: true,
			summary: `${serverName} done`,
			confidence: 85,
			data: { server: serverName },
			detailLevel: "standard" as const,
			completeness: 100,
			metadata: {
				server: serverName,
				persona: serverName,
				executionTimeMs: 5,
				timestamp: new Date().toISOString(),
			},
		};
	});

	const result = await kernel.execute({ toolName: "geowiz.analyze", args: {} });

	assert(result.success === true, "Kernel retries via executor and succeeds");
	assert(callCount === 2, `Kernel executor retried — called ${callCount} times`);
}

// ==========================================
// Test: Retry — parallel execution retries individual failures
// ==========================================

console.log("\n🔄 Testing retry — parallel retries individual tool failures...");
{
	const callCounts: Record<string, number> = {};
	const executor = new Executor({ maxRetries: 1, retryBackoffMs: 10 });
	executor.setExecutorFn(async (serverName) => {
		callCounts[serverName] = (callCounts[serverName] ?? 0) + 1;
		// econobot fails once then succeeds, geowiz always succeeds
		if (serverName === "econobot" && callCounts[serverName] === 1) {
			return {
				success: false,
				summary: `${serverName} timeout`,
				confidence: 0,
				data: null,
				detailLevel: "standard" as const,
				completeness: 0,
				metadata: {
					server: serverName,
					persona: serverName,
					executionTimeMs: 0,
					timestamp: new Date().toISOString(),
				},
				error: {
					type: "retryable" as any,
					message: "timeout connecting",
				},
			};
		}
		return {
			success: true,
			summary: `${serverName} done`,
			confidence: 90,
			data: { server: serverName },
			detailLevel: "standard" as const,
			completeness: 100,
			metadata: {
				server: serverName,
				persona: serverName,
				executionTimeMs: 5,
				timestamp: new Date().toISOString(),
			},
		};
	});

	const requests: ToolRequest[] = [
		{ toolName: "geowiz.analyze", args: {} },
		{ toolName: "econobot.analyze", args: {} },
	];

	const gathered = await executor.executeParallel(requests);

	assert(gathered.completeness === 100, `Both succeed after retry — completeness ${gathered.completeness}%`);
	assert(gathered.failures.length === 0, `No failures after retry, got ${gathered.failures.length}`);
	assert(callCounts.geowiz === 1, "Geowiz called once (no retry needed)");
	assert(callCounts.econobot === 2, `Econobot retried — called ${callCounts.econobot} times`);
}

// ==========================================
// Test A: Session result forwarding — sequential phases
// ==========================================

console.log("\n🔗 Test A: Session result forwarding — sequential phase sees prior results...");
{
	const capturedArgs: Record<string, Record<string, unknown>> = {};

	const executor = new Executor();
	executor.setExecutorFn(async (serverName, args) => {
		capturedArgs[serverName] = { ...args };
		return {
			success: true,
			summary: `${serverName} complete`,
			confidence: 90,
			data: { server: serverName },
			detailLevel: "standard" as const,
			completeness: 100,
			metadata: {
				server: serverName,
				persona: `${serverName}-persona`,
				executionTimeMs: 5,
				timestamp: new Date().toISOString(),
			},
		};
	});

	const session = new Session(DEMO_IDENTITY);
	const twoStepBundle: TaskBundle = {
		name: "test_forward",
		gatherStrategy: "all",
		steps: [
			{ toolName: "geowiz.analyze", args: {}, parallel: false },
			{ toolName: "econobot.analyze", args: {}, parallel: false, dependsOn: ["geowiz.analyze"] },
		],
	};

	await executor.executeBundle(twoStepBundle, { tract: "forward-test" }, session);

	// Session stored both results
	assert(session.getResult("geowiz.analyze") !== undefined, "Session stored geowiz result");
	assert(session.getResult("econobot.analyze") !== undefined, "Session stored econobot result");
	assert(session.availableResults.includes("geowiz.analyze"), "availableResults includes geowiz");

	// Step 2 received _context with step 1 in availableResults
	const econobotContext = capturedArgs.econobot as Record<string, unknown> | undefined;
	const ctx = econobotContext?._context as Record<string, unknown> | undefined;
	assert(ctx !== undefined, "econobot received _context in args");
	const available = ctx?.availableResults as string[] | undefined;
	assert(
		Array.isArray(available) && available.includes("geowiz.analyze"),
		"_context.availableResults contains geowiz.analyze",
	);
}

// ==========================================
// Test B: Session result forwarding — parallel phase stores all results
// ==========================================

console.log("\n🔗 Test B: Session result forwarding — parallel phase stores all results...");
{
	const executor = new Executor();
	executor.setExecutorFn(mockExecutorFn());

	const session = new Session(DEMO_IDENTITY);
	await executor.executeBundle(QUICK_SCREEN_BUNDLE, {}, session);

	const expectedTools = ["geowiz.analyze", "econobot.analyze", "curve-smith.analyze", "risk-analysis.analyze"];
	for (const tool of expectedTools) {
		assert(session.getResult(tool) !== undefined, `Session stored result for ${tool}`);
	}
	assert(
		session.availableResults.length === 4,
		`Session has 4 stored results (got ${session.availableResults.length})`,
	);
}

// ==========================================
// Test C: Context injection — _context shape in step args
// ==========================================

console.log("\n🔗 Test C: Context injection — _context has sessionId and availableResults...");
{
	const capturedArgs: Record<string, Record<string, unknown>> = {};

	const executor = new Executor();
	executor.setExecutorFn(async (serverName, args) => {
		capturedArgs[serverName] = { ...args };
		return {
			success: true,
			summary: `${serverName} complete`,
			confidence: 90,
			data: { server: serverName },
			detailLevel: "standard" as const,
			completeness: 100,
			metadata: {
				server: serverName,
				persona: `${serverName}-persona`,
				executionTimeMs: 5,
				timestamp: new Date().toISOString(),
			},
		};
	});

	const session = new Session(DEMO_IDENTITY);
	const twoStepBundle: TaskBundle = {
		name: "test_context_shape",
		gatherStrategy: "all",
		steps: [
			{ toolName: "geowiz.analyze", args: {}, parallel: false },
			{ toolName: "econobot.analyze", args: {}, parallel: false, dependsOn: ["geowiz.analyze"] },
		],
	};

	await executor.executeBundle(twoStepBundle, {}, session);

	const ctx = (capturedArgs.econobot as Record<string, unknown>)?._context as Record<string, unknown> | undefined;
	assert(ctx !== undefined, "econobot received _context");
	assert(typeof ctx?.sessionId === "string" && ctx.sessionId.length > 0, "_context.sessionId is a non-empty string");
	assert(typeof ctx?.role === "string", "_context.role is present");
	assert(Array.isArray(ctx?.availableResults), "_context.availableResults is an array");
}

// ==========================================
// Test D: BundleStep.condition — step skipped when condition returns false
// ==========================================

console.log("\n🔀 Test D: BundleStep.condition — step skipped when condition is false...");
{
	const executor = new Executor();
	executor.setExecutorFn(mockExecutorFn());

	const conditionalBundle: TaskBundle = {
		name: "test_condition_skip",
		gatherStrategy: "all",
		steps: [
			{ toolName: "geowiz.analyze", args: {}, parallel: false },
			{
				toolName: "econobot.analyze",
				args: {},
				parallel: false,
				condition: () => false,
			},
		],
	};

	const result = await executor.executeBundle(conditionalBundle);

	assert(result.results.has("geowiz.analyze"), "geowiz ran normally");
	assert(!result.results.has("econobot.analyze"), "econobot was skipped (condition false)");
	assert(result.completeness === 100, `Completeness is 100% — skipped step excluded (got ${result.completeness})`);
	assert(result.overallSuccess === true, "Bundle succeeds despite skipped step");
}

// ==========================================
// Test E: BundleStep.condition — step runs when condition returns true
// ==========================================

console.log("\n🔀 Test E: BundleStep.condition — step runs when condition is satisfied...");
{
	const executor = new Executor();
	executor.setExecutorFn(mockExecutorFn());

	const conditionalBundle: TaskBundle = {
		name: "test_condition_pass",
		gatherStrategy: "all",
		steps: [
			{ toolName: "geowiz.analyze", args: {}, parallel: false },
			{
				toolName: "econobot.analyze",
				args: {},
				parallel: false,
				dependsOn: ["geowiz.analyze"],
				condition: (priorResults) => priorResults.has("geowiz.analyze"),
			},
		],
	};

	const result = await executor.executeBundle(conditionalBundle);

	assert(result.results.has("geowiz.analyze"), "geowiz ran");
	assert(result.results.has("econobot.analyze"), "econobot ran — condition was satisfied");
	assert(result.completeness === 100, `Both steps completed — completeness 100% (got ${result.completeness})`);
}

// ==========================================
// Test F: BundleStep.condition — conditional skip in parallel phase
// ==========================================

console.log("\n🔀 Test F: BundleStep.condition — parallel step skipped when prior result absent...");
{
	const executor = new Executor();
	executor.setExecutorFn(mockExecutorFn());

	// 3 parallel steps in phase 1 — one is gated on a result that doesn't exist yet
	const conditionalParallelBundle: TaskBundle = {
		name: "test_parallel_condition",
		gatherStrategy: "all",
		steps: [
			{ toolName: "geowiz.analyze", args: {}, parallel: true },
			{ toolName: "curve-smith.analyze", args: {}, parallel: true },
			{
				toolName: "econobot.analyze",
				args: {},
				parallel: true,
				// allResults is empty at parallel phase start — this will never be satisfied
				condition: (priorResults) => priorResults.has("nonexistent.step"),
			},
		],
	};

	const result = await executor.executeBundle(conditionalParallelBundle);

	assert(result.results.has("geowiz.analyze"), "geowiz ran in parallel phase");
	assert(result.results.has("curve-smith.analyze"), "curve-smith ran in parallel phase");
	assert(!result.results.has("econobot.analyze"), "econobot was skipped (condition unsatisfied at parallel start)");
	assert(result.completeness === 100, `Completeness 100% — skipped step excluded (got ${result.completeness})`);
}

// ==========================================
// Test G: Response marshaling round-trip
// ==========================================

console.log("\n📦 Test G: Response marshaling — ToolResponse fields preserved through session store/retrieve...");
{
	const session = new Session(DEMO_IDENTITY);
	const original: ToolResponse = {
		success: true,
		summary: "Geological analysis complete",
		confidence: 92,
		data: { formation: "Wolfcamp", depth: 8500, porosity: 0.12 },
		detailLevel: "full",
		completeness: 100,
		metadata: {
			server: "geowiz",
			persona: "Marcus Aurelius Geologicus",
			executionTimeMs: 42,
			timestamp: "2026-03-30T12:00:00.000Z",
		},
	};

	session.storeResult("geowiz.analyze", original);
	const retrieved = session.getResult("geowiz.analyze");

	assert(retrieved !== undefined, "Retrieved result is defined");
	assert(retrieved?.success === original.success, "success field preserved");
	assert(retrieved?.summary === original.summary, "summary field preserved");
	assert(retrieved?.confidence === original.confidence, "confidence field preserved");
	assert(retrieved?.detailLevel === original.detailLevel, "detailLevel field preserved");
	assert(retrieved?.completeness === original.completeness, "completeness field preserved");
	assert((retrieved?.data as Record<string, unknown>)?.formation === "Wolfcamp", "data payload preserved");
	assert(retrieved?.metadata.server === "geowiz", "metadata.server preserved");
	assert(retrieved?.metadata.persona === "Marcus Aurelius Geologicus", "metadata.persona preserved");
	assert(retrieved?.metadata.executionTimeMs === 42, "metadata.executionTimeMs preserved");
	assert(retrieved?.metadata.timestamp === "2026-03-30T12:00:00.000Z", "metadata.timestamp preserved");
}

// ==========================================
// Test H: shouldWeInvest() — decision.analyze in results exactly once
// ==========================================

console.log("\n⚖️ Test H: shouldWeInvest() — decision.analyze present once via confirmation gate...");
{
	const kernel = new Kernel();
	kernel.setExecutorFn(mockExecutorFn());

	const result = await kernel.shouldWeInvest({ tract: "investment-test" });

	assert(result.bundleName === "full_due_diligence", "Bundle name is full_due_diligence");
	assert(result.results.has("decision.analyze"), "decision.analyze is present in results");

	// decision.analyze goes through the confirmation gate, which returns requires_confirmation: true
	// without actually executing the tool — it is then added to results.set() by shouldWeInvest()
	const decisionResult = result.results.get("decision.analyze");
	assert(decisionResult !== undefined, "decision result is defined");
	const decisionData = decisionResult?.data as Record<string, unknown> | null | undefined;
	assert(
		decisionData?.requires_confirmation === true,
		"decision result has requires_confirmation: true (pending gate)",
	);

	// Verify total result count: 13 bundle steps + 1 decision = 14
	assert(result.results.size === 14, `Result map has 14 entries (13 bundle + 1 decision), got ${result.results.size}`);
}

// ==========================================
// Test: Fallback chain — Issue #149
// ==========================================

console.log("\n🔁 Testing fallback chain routing (Issue #149)...");

// Single fallback succeeds
{
	const { Registry } = await import("../src/kernel/registry.js");
	const reg = new Registry();
	reg.registerServer({
		name: "geowiz",
		description: "Geo",
		persona: "Marcus",
		domain: "geology",
		capabilities: ["geology"],
	});
	reg.registerServer({
		name: "risk-analysis",
		description: "Risk",
		persona: "Seneca",
		domain: "risk",
		capabilities: ["risk"],
	});
	reg.registerFallback("geowiz.analyze", "risk-analysis.analyze");

	const executor = new Executor({ maxRetries: 0, retryBackoffMs: 10 });
	executor.setRegistry(reg);
	executor.setExecutorFn(async (serverName) => {
		if (serverName === "geowiz") {
			return {
				success: false,
				summary: "geowiz down",
				confidence: 0,
				data: null,
				detailLevel: "standard" as const,
				completeness: 0,
				metadata: { server: serverName, persona: serverName, executionTimeMs: 1, timestamp: new Date().toISOString() },
				error: { type: "retryable" as any, message: "geowiz unavailable" },
			};
		}
		return {
			success: true,
			summary: `${serverName} fallback response`,
			confidence: 70,
			data: { fallback: true },
			detailLevel: "standard" as const,
			completeness: 100,
			metadata: { server: serverName, persona: serverName, executionTimeMs: 1, timestamp: new Date().toISOString() },
		};
	});

	const result = await executor.execute({ toolName: "geowiz.analyze", args: {} });
	assert(result.success === true, "Single fallback: succeeds when primary fails");
	assert(result.metadata.usedFallback === true, "Single fallback: usedFallback stamped on metadata");
	assert(result.metadata.originalTool === "geowiz.analyze", "Single fallback: originalTool correct");
	assert(result.metadata.fallbackTool === "risk-analysis.analyze", "Single fallback: fallbackTool correct");
	const usage = executor.getFallbackUsage();
	assert(usage.length === 1, `Single fallback: one FallbackUsageRecord (got ${usage.length})`);
	assert(usage[0].primaryTool === "geowiz.analyze", "FallbackUsageRecord: primaryTool correct");
	assert(usage[0].fallbackTool === "risk-analysis.analyze", "FallbackUsageRecord: fallbackTool correct");
}

// Fallback chain: first in chain succeeds, second not attempted
{
	const { Registry } = await import("../src/kernel/registry.js");
	const reg = new Registry();
	reg.registerServer({
		name: "geowiz",
		description: "Geo",
		persona: "Marcus",
		domain: "geology",
		capabilities: ["geology"],
	});
	reg.registerServer({
		name: "risk-analysis",
		description: "Risk",
		persona: "Seneca",
		domain: "risk",
		capabilities: ["risk"],
	});
	reg.registerServer({
		name: "econobot",
		description: "Econ",
		persona: "Pliny",
		domain: "economics",
		capabilities: ["economics"],
	});
	reg.registerFallback("geowiz.analyze", ["risk-analysis.analyze", "econobot.analyze"]);

	const attempted: string[] = [];
	const executor = new Executor({ maxRetries: 0, retryBackoffMs: 10 });
	executor.setRegistry(reg);
	executor.setExecutorFn(async (serverName) => {
		attempted.push(serverName);
		if (serverName === "geowiz") {
			return {
				success: false,
				summary: "geowiz down",
				confidence: 0,
				data: null,
				detailLevel: "standard" as const,
				completeness: 0,
				metadata: { server: serverName, persona: serverName, executionTimeMs: 1, timestamp: new Date().toISOString() },
				error: { type: "retryable" as any, message: "geowiz unavailable" },
			};
		}
		return {
			success: true,
			summary: `${serverName} ok`,
			confidence: 75,
			data: { server: serverName },
			detailLevel: "standard" as const,
			completeness: 100,
			metadata: { server: serverName, persona: serverName, executionTimeMs: 1, timestamp: new Date().toISOString() },
		};
	});

	const result = await executor.execute({ toolName: "geowiz.analyze", args: {} });
	assert(result.success === true, "Chain: first fallback succeeds");
	assert(result.metadata.fallbackTool === "risk-analysis.analyze", "Chain: fallbackTool is first in chain");
	assert(!attempted.includes("econobot"), "Chain: second fallback NOT attempted when first succeeds");
}

// Fallback chain: first fails, second succeeds
{
	const { Registry } = await import("../src/kernel/registry.js");
	const reg = new Registry();
	reg.registerServer({
		name: "geowiz",
		description: "Geo",
		persona: "Marcus",
		domain: "geology",
		capabilities: ["geology"],
	});
	reg.registerServer({
		name: "risk-analysis",
		description: "Risk",
		persona: "Seneca",
		domain: "risk",
		capabilities: ["risk"],
	});
	reg.registerServer({
		name: "econobot",
		description: "Econ",
		persona: "Pliny",
		domain: "economics",
		capabilities: ["economics"],
	});
	reg.registerFallback("geowiz.analyze", ["risk-analysis.analyze", "econobot.analyze"]);

	const executor = new Executor({ maxRetries: 0, retryBackoffMs: 10 });
	executor.setRegistry(reg);
	executor.setExecutorFn(async (serverName) => {
		if (serverName === "geowiz" || serverName === "risk-analysis") {
			return {
				success: false,
				summary: `${serverName} down`,
				confidence: 0,
				data: null,
				detailLevel: "standard" as const,
				completeness: 0,
				metadata: { server: serverName, persona: serverName, executionTimeMs: 1, timestamp: new Date().toISOString() },
				error: { type: "retryable" as any, message: `${serverName} unavailable` },
			};
		}
		return {
			success: true,
			summary: `${serverName} ok`,
			confidence: 75,
			data: { server: serverName },
			detailLevel: "standard" as const,
			completeness: 100,
			metadata: { server: serverName, persona: serverName, executionTimeMs: 1, timestamp: new Date().toISOString() },
		};
	});

	const result = await executor.execute({ toolName: "geowiz.analyze", args: {} });
	assert(result.success === true, "Chain: second fallback succeeds when first fails");
	assert(
		result.metadata.fallbackTool === "econobot.analyze",
		"Chain: fallbackTool is second in chain (the one that worked)",
	);
	const usage = executor.getFallbackUsage();
	// Both geowiz (primary failure) and risk-analysis (first fallback failure) should be recorded
	assert(usage.length >= 2, `Chain: at least 2 FallbackUsageRecords (got ${usage.length})`);
}

// All fallbacks exhausted — returns primary failure
{
	const { Registry } = await import("../src/kernel/registry.js");
	const reg = new Registry();
	reg.registerServer({
		name: "geowiz",
		description: "Geo",
		persona: "Marcus",
		domain: "geology",
		capabilities: ["geology"],
	});
	reg.registerServer({
		name: "risk-analysis",
		description: "Risk",
		persona: "Seneca",
		domain: "risk",
		capabilities: ["risk"],
	});
	reg.registerFallback("geowiz.analyze", "risk-analysis.analyze");

	const executor = new Executor({ maxRetries: 0, retryBackoffMs: 10 });
	executor.setRegistry(reg);
	executor.setExecutorFn(async (serverName) => ({
		success: false,
		summary: `${serverName} down`,
		confidence: 0,
		data: null,
		detailLevel: "standard" as const,
		completeness: 0,
		metadata: { server: serverName, persona: serverName, executionTimeMs: 1, timestamp: new Date().toISOString() },
		error: { type: "retryable" as any, message: `${serverName} unavailable` },
	}));

	const result = await executor.execute({ toolName: "geowiz.analyze", args: {} });
	assert(result.success === false, "All fallbacks exhausted: returns primary failure");
	assert(result.metadata.usedFallback !== true, "All fallbacks exhausted: usedFallback NOT stamped");
}

// No fallback registered — primary failure returned unchanged
{
	const executor = new Executor({ maxRetries: 0, retryBackoffMs: 10 });
	executor.setExecutorFn(async (serverName) => ({
		success: false,
		summary: `${serverName} down`,
		confidence: 0,
		data: null,
		detailLevel: "standard" as const,
		completeness: 0,
		metadata: { server: serverName, persona: serverName, executionTimeMs: 1, timestamp: new Date().toISOString() },
		error: { type: "retryable" as any, message: `${serverName} unavailable` },
	}));

	const result = await executor.execute({ toolName: "geowiz.analyze", args: {} });
	assert(result.success === false, "No fallback: primary failure returned");
	assert(result.metadata.usedFallback !== true, "No fallback: usedFallback not present");
}

// ==========================================
// Test: Canonical accumulation — mergeCanonical called after tool with canonicalOutput
// ==========================================

console.log("\n🗂 Testing canonical accumulation...");
{
	const sessionManager = new SessionManager();
	const session = sessionManager.createSession(DEMO_IDENTITY);

	const executor = new Executor();
	executor.setSessionManager(sessionManager);
	executor.setExecutorFn(async (_serverName, _args) => ({
		success: true,
		summary: "geowiz analysis complete",
		confidence: 88,
		data: { formations: ["Wolfcamp A"] },
		detailLevel: "standard" as const,
		completeness: 100,
		canonicalOutput: {
			formation: { name: "Wolfcamp A", netPay: 120, porosity: 0.1 },
		},
		metadata: {
			server: "geowiz",
			persona: "Marcus",
			executionTimeMs: 5,
			timestamp: new Date().toISOString(),
		},
	}));

	await executor.execute({
		toolName: "geowiz.analyze",
		args: {},
		sessionId: session.id,
	});

	const canonical = sessionManager.getCanonical(session.id);
	assert(canonical !== undefined, "Canonical context populated after tool call");
	assert(canonical?.formation?.name === "Wolfcamp A", "Formation name accumulated correctly");
	assert(canonical?.formation?.netPay === 120, "Formation netPay accumulated correctly");
	assert(canonical?.formation?.porosity === 0.1, "Formation porosity accumulated correctly");
}

// ==========================================
// Test: Canonical accumulation — no-op when canonicalOutput is absent
// ==========================================

console.log("\n🚫 Testing canonical no-op when canonicalOutput absent...");
{
	const sessionManager = new SessionManager();
	const session = sessionManager.createSession(DEMO_IDENTITY);

	const executor = new Executor();
	executor.setSessionManager(sessionManager);
	executor.setExecutorFn(async (_serverName, _args) => ({
		success: true,
		summary: "tool complete",
		confidence: 80,
		data: { result: "ok" },
		detailLevel: "standard" as const,
		completeness: 100,
		// No canonicalOutput field — older server that hasn't adopted the canonical model
		metadata: {
			server: "research",
			persona: "Cicero",
			executionTimeMs: 5,
			timestamp: new Date().toISOString(),
		},
	}));

	await executor.execute({
		toolName: "research.analyze",
		args: {},
		sessionId: session.id,
	});

	const canonical = sessionManager.getCanonical(session.id);
	assert(canonical === undefined, "No canonical context when server returns no canonicalOutput");
}

// ==========================================
// Test: Canonical accumulation — multiple sections accumulate independently
// ==========================================

console.log("\n📊 Testing multi-section canonical accumulation...");
{
	const sessionManager = new SessionManager();
	const session = sessionManager.createSession(DEMO_IDENTITY);

	const executor = new Executor();
	executor.setSessionManager(sessionManager);

	// First tool call: geowiz writes formation
	executor.setExecutorFn(async (_serverName, _args) => ({
		success: true,
		summary: "geowiz done",
		confidence: 88,
		data: {},
		detailLevel: "standard" as const,
		completeness: 100,
		canonicalOutput: { formation: { netPay: 150, porosity: 0.12 } },
		metadata: { server: "geowiz", persona: "Marcus", executionTimeMs: 5, timestamp: new Date().toISOString() },
	}));
	await executor.execute({ toolName: "geowiz.analyze", args: {}, sessionId: session.id });

	// Second tool call: econobot writes economics
	executor.setExecutorFn(async (_serverName, _args) => ({
		success: true,
		summary: "econobot done",
		confidence: 90,
		data: {},
		detailLevel: "standard" as const,
		completeness: 100,
		canonicalOutput: { economics: { npv: 5_000_000, irr: 0.22, paybackMonths: 18 } },
		metadata: { server: "econobot", persona: "Caesar", executionTimeMs: 5, timestamp: new Date().toISOString() },
	}));
	await executor.execute({ toolName: "econobot.analyze", args: {}, sessionId: session.id });

	const canonical = sessionManager.getCanonical(session.id);
	assert(canonical?.formation?.netPay === 150, "Formation section persists after second tool call");
	assert(canonical?.economics?.npv === 5_000_000, "Economics section accumulated from second tool call");
	assert(canonical?.economics?.irr === 0.22, "Economics IRR accumulated correctly");
}

// ==========================================
// Test: Canonical accumulation — no session manager means no-op (no crash)
// ==========================================

console.log("\n🔕 Testing canonical no-op without session manager...");
{
	const executor = new Executor();
	// No setSessionManager call — executor has no sessionManager
	executor.setExecutorFn(async (_serverName, _args) => ({
		success: true,
		summary: "tool done",
		confidence: 85,
		data: {},
		detailLevel: "standard" as const,
		completeness: 100,
		canonicalOutput: { formation: { netPay: 100 } },
		metadata: { server: "geowiz", persona: "Marcus", executionTimeMs: 5, timestamp: new Date().toISOString() },
	}));

	// Should complete without throwing even though there's no session manager to call
	const result = await executor.execute({ toolName: "geowiz.analyze", args: {}, sessionId: "some-session" });
	assert(result.success === true, "Canonical output ignored gracefully when no session manager");
}

// ==========================================
// Summary
// ==========================================

console.log(`\n${"=".repeat(70)}`);
console.log("📊 KERNEL EXECUTOR TEST SUMMARY");
console.log("=".repeat(70));
console.log(`📋 Tests Run: ${passed + failed}`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

if (failed > 0) {
	console.log("\n❌ SOME TESTS FAILED!");
	process.exit(1);
} else {
	console.log("\n🎉 ALL KERNEL EXECUTOR TESTS PASSED!");
}
